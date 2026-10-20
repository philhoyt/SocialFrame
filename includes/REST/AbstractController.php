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

use SocialFrame\Fields\FieldFiller;
use SocialFrame\Fields\PostSource;
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
	 * Load a graphic and its decoded canvas.
	 *
	 * @param int $id Post ID.
	 * @return array{0: \WP_Post, 1: array<string, mixed>}|WP_Error
	 */
	protected function get_canvas( int $id ): array|WP_Error {
		$post = $this->get_graphic( $id );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		$decoded = json_decode( (string) get_post_meta( $post->ID, 'socialframe_fabric_json', true ), true );
		if ( ! is_array( $decoded ) ) {
			return new WP_Error( 'empty_design', __( 'This design has no saved canvas yet.', 'socialframe' ), [ 'status' => 400 ] );
		}

		return [ $post, $decoded ];
	}

	/**
	 * Fill a decoded canvas from a post and explicit values.
	 *
	 * Values from the post come first; explicit values win for the same name.
	 * Text values are sanitized, image values are cast to attachment IDs.
	 *
	 * @param array<string, mixed>      $canvas Decoded Fabric JSON.
	 * @param \WP_Post|null             $source Post to read field values from.
	 * @param array<string, string|int> $values Explicit values by field name.
	 * @return array{canvas: array<string, mixed>, filled: string[], unmatched: string[]}
	 */
	protected function fill_canvas( array $canvas, ?\WP_Post $source, array $values ): array {
		$all = [];

		if ( $source ) {
			$all = PostSource::values_for( $source, array_column( FieldFiller::collect( $canvas ), 'name' ) );
		}

		foreach ( $values as $name => $value ) {
			$all[ (string) $name ] = is_string( $value ) ? sanitize_textarea_field( $value ) : (int) $value;
		}

		return FieldFiller::fill( $canvas, $all );
	}

	/**
	 * Default title for a design filled from a post, or from values alone.
	 *
	 * @param \WP_Post      $design Design that was filled.
	 * @param \WP_Post|null $source Post the values came from.
	 */
	protected function filled_title( \WP_Post $design, ?\WP_Post $source ): string {
		return $source
			/* translators: 1: design title, 2: title of the post the design was filled from. */
			? sprintf( __( '%1$s: %2$s', 'socialframe' ), $design->post_title, PostSource::title( $source ) )
			/* translators: %s: design title. */
			: sprintf( __( '%s (Filled)', 'socialframe' ), $design->post_title );
	}

	/**
	 * Save a PNG data URI to the Media Library and link it to a design.
	 *
	 * With $replace_id, an image attachment already belonging to this design
	 * keeps its ID and gets the new file; the old files are deleted only once
	 * the new metadata is in place. Any other $replace_id is ignored and a new
	 * attachment is created.
	 *
	 * @param \WP_Post $design     Design the image belongs to.
	 * @param string   $image_data PNG data URI.
	 * @param bool     $thumbnail  Resize to a 400px thumbnail first.
	 * @param int      $replace_id Attachment to replace, or 0.
	 * @return array{attachmentId: int, url: string, libraryUrl: string}|WP_Error
	 */
	protected function store_png( \WP_Post $design, string $image_data, bool $thumbnail = false, int $replace_id = 0 ): array|WP_Error {
		// Strip the data URI prefix.
		$base64 = preg_replace( '/^data:image\/png;base64,/', '', $image_data );
		$binary = base64_decode( (string) $base64, true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode

		if ( false === $binary ) {
			return new WP_Error( 'invalid_image', __( 'Invalid image data.', 'socialframe' ), [ 'status' => 400 ] );
		}

		// Verify the decoded bytes are actually a PNG before trusting them.
		// base64_decode() only proves the string was valid base64, not that it
		// is an image — without this an edit_posts user could store arbitrary
		// bytes under a .png name.
		// The leading @ suppresses the read-error notice getimagesizefromstring()
		// emits on malformed/truncated data; the false return is handled below.
		$image_info = @getimagesizefromstring( $binary ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		if ( false === $image_info || IMAGETYPE_PNG !== $image_info[2] ) {
			return new WP_Error( 'invalid_image', __( 'Invalid image data.', 'socialframe' ), [ 'status' => 400 ] );
		}

		// If thumbnail requested, resize via GD.
		if ( $thumbnail ) {
			$binary = $this->resize_png( $binary, 400 );
			if ( ! $binary ) {
				return new WP_Error( 'resize_failed', __( 'Could not generate thumbnail.', 'socialframe' ), [ 'status' => 500 ] );
			}
		}

		$replace = $replace_id > 0 ? get_post( $replace_id ) : null;
		if ( ! $replace
			|| 'attachment' !== $replace->post_type
			|| $replace->post_parent !== $design->ID
			|| ! wp_attachment_is_image( $replace )
			|| ! current_user_can( 'edit_post', $replace->ID )
		) {
			$replace = null;
		}

		// Write to the uploads directory via the WordPress filesystem API.
		// wp_upload_bits() handles the path, unique filename, and extension
		// validation that a raw file_put_contents() would bypass.
		$suffix   = $thumbnail ? '-thumb' : '';
		$filename = 'socialframe-' . $design->ID . $suffix . '-' . time() . '.png';

		$upload = wp_upload_bits( $filename, null, $binary );

		if ( ! empty( $upload['error'] ) ) {
			return new WP_Error( 'write_failed', __( 'Could not write image file.', 'socialframe' ), [ 'status' => 500 ] );
		}

		$filepath = $upload['file'];

		require_once ABSPATH . 'wp-admin/includes/image.php';

		if ( $replace ) {
			$attachment_id = $replace->ID;
			$old_file      = (string) get_attached_file( $attachment_id );
			$old_meta      = wp_get_attachment_metadata( $attachment_id );
			$old_backups   = get_post_meta( $attachment_id, '_wp_attachment_backup_sizes', true );

			update_attached_file( $attachment_id, $filepath );
			$metadata = wp_generate_attachment_metadata( $attachment_id, $filepath );

			if ( empty( $metadata ) ) {
				update_attached_file( $attachment_id, $old_file );
				wp_delete_file( $filepath );
				return new WP_Error( 'write_failed', __( 'Could not write image file.', 'socialframe' ), [ 'status' => 500 ] );
			}

			wp_update_attachment_metadata( $attachment_id, $metadata );
			delete_post_meta( $attachment_id, '_wp_attachment_backup_sizes' );

			if ( '' !== $old_file && $old_file !== $filepath ) {
				wp_delete_attachment_files(
					$attachment_id,
					is_array( $old_meta ) ? $old_meta : [],
					is_array( $old_backups ) ? $old_backups : [],
					$old_file
				);
			}
		} else {
			// Create the media library attachment.
			$attachment_id = wp_insert_attachment(
				[
					'post_mime_type' => 'image/png',
					'post_title'     => sprintf(
						$thumbnail
							/* translators: %s: design title. */
							? __( '%s Thumbnail', 'socialframe' )
							/* translators: %s: design title. */
							: __( '%s Export', 'socialframe' ),
						$design->post_title
					),
					'post_status'    => 'inherit',
					'post_parent'    => $design->ID,
					'guid'           => $upload['url'],
				],
				$filepath,
				$design->ID,
				true
			);

			if ( is_wp_error( $attachment_id ) ) {
				wp_delete_file( $filepath );
				return $attachment_id;
			}

			wp_update_attachment_metadata( $attachment_id, wp_generate_attachment_metadata( $attachment_id, $filepath ) );
		}

		// Store reference on the design post.
		update_post_meta( $design->ID, 'socialframe_image_id', $attachment_id );

		return [
			'attachmentId' => $attachment_id,
			'url'          => (string) wp_get_attachment_url( $attachment_id ),
			'libraryUrl'   => admin_url( 'upload.php?item=' . $attachment_id ),
		];
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
