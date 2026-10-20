<?php
/**
 * Abstract base controller for SocialFrame REST endpoints.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

namespace SocialFrame\REST;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}


use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

/**
 * Provides shared namespace, permission callbacks, and response helpers.
 */
abstract class AbstractController {

	const NAMESPACE = 'socialframe/v1';

	/**
	 * Register REST routes. Implemented by each controller.
	 */
	abstract public function register_routes(): void;

	/**
	 * Hook register_routes into rest_api_init.
	 */
	public function register(): void {
		add_action( 'rest_api_init', [ $this, 'register_routes' ] );
	}

	/**
	 * Wrap data in a WP_REST_Response.
	 *
	 * @param mixed $data   Response data.
	 * @param int   $status HTTP status code.
	 */
	protected function respond( mixed $data, int $status = 200 ): WP_REST_Response {
		return new WP_REST_Response( $data, $status );
	}

	/**
	 * Permission callback requiring edit_posts capability.
	 */
	public function require_edit_posts(): bool {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * Permission callback for routes that create Media Library attachments.
	 *
	 * Exporting writes a file into uploads and creates an attachment, so it
	 * also requires upload_files — Contributors have edit_posts but not this.
	 */
	public function require_upload_files(): bool {
		return current_user_can( 'edit_posts' ) && current_user_can( 'upload_files' );
	}

	/**
	 * Resize a PNG binary to a given width using GD, preserving aspect ratio.
	 *
	 * @param string $binary    Raw PNG binary.
	 * @param int    $max_width Target width in pixels.
	 * @return string|false Resized PNG binary, or false on failure.
	 */
	protected function resize_png( string $binary, int $max_width ): string|false {
		if ( ! function_exists( 'imagecreatefromstring' ) ) {
			return false;
		}

		$src = imagecreatefromstring( $binary );
		if ( ! $src ) {
			return false;
		}

		$orig_w = imagesx( $src );
		$orig_h = imagesy( $src );

		if ( $orig_w <= $max_width ) {
			return $binary;
		}

		$ratio = $max_width / $orig_w;
		$new_h = (int) round( $orig_h * $ratio );
		$dst   = imagescale( $src, $max_width, $new_h, IMG_BILINEAR_FIXED );

		if ( ! $dst ) {
			return false;
		}

		ob_start();
		imagepng( $dst );
		$output = ob_get_clean();

		return ( ! empty( $output ) ) ? $output : false;
	}

	/**
	 * Permission callback for deleting a specific design.
	 *
	 * Listing and editing designs is open to any edit_posts user (the shared
	 * workspace model), but deletion is gated per-post: owners can delete their
	 * own designs, while deleting another user's design requires
	 * delete_others_posts (Editor and above). This is resolved by the
	 * delete_post meta capability via map_meta_cap.
	 *
	 * @param WP_REST_Request $request Full request data.
	 */
	public function require_delete_graphic( WP_REST_Request $request ): bool {
		return current_user_can( 'delete_post', (int) $request->get_param( 'id' ) );
	}

	/**
	 * Fetch a graphic the current user may work with, or a 404.
	 *
	 * @param int $id Post ID.
	 * @return \WP_Post|WP_Error
	 */
	protected function get_graphic( int $id ): \WP_Post|WP_Error {
		$post = get_post( $id );

		if ( ! $post || 'socialframe_graphic' !== $post->post_type || ! self::can_access_graphic( $post ) ) {
			return new WP_Error( 'not_found', __( 'Design not found.', 'socialframe' ), [ 'status' => 404 ] );
		}

		return $post;
	}

	/**
	 * Whether the current user may see a graphic.
	 *
	 * Designs are a shared workspace, except a design generated from a post:
	 * it carries that post's content, which may be a draft, so only users who
	 * can edit the source post see it. Once the source post is gone the
	 * design is an ordinary one.
	 *
	 * @param \WP_Post $graphic Graphic post.
	 */
	public static function can_access_graphic( \WP_Post $graphic ): bool {
		$source_id = (int) get_post_meta( $graphic->ID, 'socialframe_source_post', true );

		if ( $source_id < 1 || ! get_post( $source_id ) ) {
			return true;
		}

		return current_user_can( 'edit_post', $source_id );
	}

	/**
	 * Copy a graphic and its meta into a new design post.
	 *
	 * Format, custom size and Fabric JSON are copied; the copy is always a
	 * design and has no export yet. Pass $fabric_json to store a different
	 * canvas on the copy. If the canvas cannot be stored, the copy is deleted
	 * so no empty design is left behind.
	 *
	 * @param \WP_Post    $source      Graphic to copy.
	 * @param string      $title       Title for the copy.
	 * @param string|null $fabric_json Canvas JSON for the copy, or null to copy the source's.
	 * @return int|WP_Error New post ID.
	 */
	protected function duplicate_graphic( \WP_Post $source, string $title, ?string $fabric_json = null ): int|WP_Error {
		$new_post_id = wp_insert_post(
			[
				'post_title'  => $title,
				'post_type'   => 'socialframe_graphic',
				'post_status' => 'publish',
			],
			true
		);

		if ( is_wp_error( $new_post_id ) ) {
			return $new_post_id;
		}

		foreach ( [ 'socialframe_format', 'socialframe_width', 'socialframe_height' ] as $key ) {
			$value = get_post_meta( $source->ID, $key, true );
			if ( '' !== $value ) {
				update_post_meta( $new_post_id, $key, $value );
			}
		}

		$fabric_json ??= (string) get_post_meta( $source->ID, 'socialframe_fabric_json', true );
		// update_post_meta() unslashes its input; slash first so JSON escapes
		// (\" \n \uXXXX) survive the copy (ARC-01).
		if ( '' !== $fabric_json && ! update_post_meta( $new_post_id, 'socialframe_fabric_json', wp_slash( $fabric_json ) ) ) {
			wp_delete_post( $new_post_id, true );
			return new WP_Error( 'copy_failed', __( 'Could not save the new design.', 'socialframe' ), [ 'status' => 500 ] );
		}

		update_post_meta( $new_post_id, 'socialframe_type', 'design' );

		return $new_post_id;
	}

	/**
	 * Build a standard design object shape from a WP_Post.
	 *
	 * List responses omit fabricJson (PRF-01): it can be large and only the
	 * editor needs it, which fetches the single design.
	 *
	 * @param \WP_Post $post      The post object.
	 * @param bool     $with_json Whether to include the Fabric JSON.
	 * @return array<string, mixed>
	 */
	protected function format_design( \WP_Post $post, bool $with_json = true ): array {
		$image_id = (int) get_post_meta( $post->ID, 'socialframe_image_id', true );

		$design = [
			'id'           => $post->ID,
			'title'        => $post->post_title,
			'format'       => (string) get_post_meta( $post->ID, 'socialframe_format', true ),
			'type'         => (string) get_post_meta( $post->ID, 'socialframe_type', true ),
			// Custom canvas size in pixels (0 for preset formats; the editor
			// falls back to the format's preset dimensions).
			'width'        => (int) get_post_meta( $post->ID, 'socialframe_width', true ),
			'height'       => (int) get_post_meta( $post->ID, 'socialframe_height', true ),
			'imageId'      => $image_id,
			'thumbnailUrl' => $image_id ? wp_get_attachment_url( $image_id ) : PreviewController::preview_url( $post->ID ),
			'modified'     => $post->post_modified_gmt,
			'editUrl'      => admin_url( 'admin.php?page=socialframe-editor&id=' . $post->ID ),
			'canDelete'    => current_user_can( 'delete_post', $post->ID ),
			'postTypes'    => array_values( array_map( 'strval', get_post_meta( $post->ID, 'socialframe_post_types', false ) ) ),
			'sourcePost'   => (int) get_post_meta( $post->ID, 'socialframe_source_post', true ),
		];

		if ( $with_json ) {
			$design['fabricJson'] = (string) get_post_meta( $post->ID, 'socialframe_fabric_json', true );
		}

		return $design;
	}
}
