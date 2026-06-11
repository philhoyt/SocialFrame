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
	 * Build a standard design object shape from a WP_Post.
	 *
	 * @param \WP_Post $post The post object.
	 * @return array<string, mixed>
	 */
	protected function format_design( \WP_Post $post ): array {
		$image_id     = (int) get_post_meta( $post->ID, 'socialframe_image_id', true );
		$preview_path = (string) get_post_meta( $post->ID, 'socialframe_preview_path', true );
		$preview_url  = $preview_path ? wp_upload_dir()['baseurl'] . '/' . $preview_path : '';

		return [
			'id'           => $post->ID,
			'title'        => $post->post_title,
			'format'       => (string) get_post_meta( $post->ID, 'socialframe_format', true ),
			'type'         => (string) get_post_meta( $post->ID, 'socialframe_type', true ),
			'fabricJson'   => (string) get_post_meta( $post->ID, 'socialframe_fabric_json', true ),
			// Custom canvas size in pixels (0 for preset formats; the editor
			// falls back to the format's preset dimensions).
			'width'        => (int) get_post_meta( $post->ID, 'socialframe_width', true ),
			'height'       => (int) get_post_meta( $post->ID, 'socialframe_height', true ),
			'imageId'      => $image_id,
			'thumbnailUrl' => $image_id ? wp_get_attachment_url( $image_id ) : $preview_url,
			'modified'     => $post->post_modified_gmt,
			'editUrl'      => admin_url( 'admin.php?page=socialframe-editor&id=' . $post->ID ),
			'canDelete'    => current_user_can( 'delete_post', $post->ID ),
		];
	}
}
