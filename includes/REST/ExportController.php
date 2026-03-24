<?php
/**
 * REST controller for SocialFrame design export.
 */

declare( strict_types=1 );

namespace SocialFrame\REST;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

/**
 * Handles POST /designs/:id/export.
 *
 * Receives a base64-encoded PNG data URI, saves it to the uploads directory,
 * creates a media library attachment, and links it to the design post.
 */
class ExportController extends AbstractController {

	/**
	 * Register REST routes.
	 */
	public function register_routes(): void {
		register_rest_route(
			self::NAMESPACE,
			'/designs/(?P<id>\d+)/export',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'handle_export' ],
				'permission_callback' => [ $this, 'require_edit_posts' ],
				'args'                => [
					'id'        => [
						'type'    => 'integer',
						'minimum' => 1,
					],
					'imageData' => [
						'type'     => 'string',
						'required' => true,
					],
					'thumbnail' => [
						'type'    => 'boolean',
						'default' => false,
					],
				],
			]
		);
	}

	/**
	 * POST /designs/:id/export — generate and save PNG to media library.
	 */
	public function handle_export( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id         = (int) $request->get_param( 'id' );
		$image_data = $request->get_param( 'imageData' );
		$is_thumb   = (bool) $request->get_param( 'thumbnail' );

		$post = get_post( $id );
		if ( ! $post || 'socialframe_graphic' !== $post->post_type ) {
			return new WP_Error( 'not_found', __( 'Design not found.', 'socialframe' ), [ 'status' => 404 ] );
		}

		// Strip the data URI prefix.
		$base64 = preg_replace( '/^data:image\/png;base64,/', '', $image_data );
		$binary = base64_decode( $base64, true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode

		if ( false === $binary ) {
			return new WP_Error( 'invalid_image', __( 'Invalid image data.', 'socialframe' ), [ 'status' => 400 ] );
		}

		// If thumbnail requested, resize via GD.
		if ( $is_thumb ) {
			$binary = $this->resize_png( $binary, 400 );
			if ( ! $binary ) {
				return new WP_Error( 'resize_failed', __( 'Could not generate thumbnail.', 'socialframe' ), [ 'status' => 500 ] );
			}
		}

		// Write to the uploads directory.
		$upload_dir = wp_upload_dir();
		$suffix     = $is_thumb ? '-thumb' : '';
		$filename   = 'socialframe-' . $id . $suffix . '-' . time() . '.png';
		$filepath   = $upload_dir['path'] . '/' . $filename;
		$file_url   = $upload_dir['url'] . '/' . $filename;

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		$bytes = file_put_contents( $filepath, $binary );

		if ( false === $bytes ) {
			return new WP_Error( 'write_failed', __( 'Could not write image file.', 'socialframe' ), [ 'status' => 500 ] );
		}

		// Create the media library attachment.
		$attachment_id = wp_insert_attachment(
			[
				'post_mime_type' => 'image/png',
				'post_title'     => $post->post_title . ( $is_thumb ? ' Thumbnail' : ' Export' ),
				'post_status'    => 'inherit',
				'post_parent'    => $id,
				'guid'           => $file_url,
			],
			$filepath,
			$id,
			true
		);

		if ( is_wp_error( $attachment_id ) ) {
			return $attachment_id;
		}

		require_once ABSPATH . 'wp-admin/includes/image.php';
		$metadata = wp_generate_attachment_metadata( $attachment_id, $filepath );
		wp_update_attachment_metadata( $attachment_id, $metadata );

		// Store reference on the design post.
		update_post_meta( $id, 'socialframe_image_id', $attachment_id );

		return $this->respond(
			[
				'attachmentId' => $attachment_id,
				'url'          => wp_get_attachment_url( $attachment_id ),
				'libraryUrl'   => admin_url( 'upload.php?item=' . $attachment_id ),
			],
			201
		);
	}

	/**
	 * Resize a PNG binary to a given width using GD, preserving aspect ratio.
	 *
	 * @param string $binary     Raw PNG binary.
	 * @param int    $max_width  Target width in pixels.
	 * @return string|false Resized PNG binary, or false on failure.
	 */
	private function resize_png( string $binary, int $max_width ): string|false {
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
			imagedestroy( $src );
			return $binary;
		}

		$ratio  = $max_width / $orig_w;
		$new_h  = (int) round( $orig_h * $ratio );
		$dst    = imagescale( $src, $max_width, $new_h, IMG_BILINEAR_FIXED );
		imagedestroy( $src );

		if ( ! $dst ) {
			return false;
		}

		ob_start();
		imagepng( $dst );
		$output = ob_get_clean();
		imagedestroy( $dst );

		return $output ?: false;
	}
}
