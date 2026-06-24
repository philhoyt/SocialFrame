<?php
/**
 * REST controller for SocialFrame design preview generation.
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
 * Handles POST /designs/:id/preview.
 *
 * Receives a base64-encoded PNG data URI, resizes it to 400 px wide, writes
 * it to uploads/socialframe/previews/ at a fixed per-design path (overwrites
 * on each call), and stores the relative path in socialframe_preview_path meta.
 */
class PreviewController extends AbstractController {

	const PREVIEW_WIDTH = 400;

	/**
	 * Register REST routes and the delete-cleanup hook.
	 */
	public function register(): void {
		parent::register();
		add_action( 'before_delete_post', [ $this, 'delete_preview_file' ] );
	}

	/**
	 * Register REST routes.
	 */
	public function register_routes(): void {
		register_rest_route(
			self::NAMESPACE,
			'/designs/(?P<id>\d+)/preview',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'handle_preview' ],
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
				],
			]
		);
	}

	/**
	 * POST /designs/:id/preview — generate and save a preview thumbnail.
	 *
	 * @param WP_REST_Request $request Full request data.
	 */
	public function handle_preview( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id         = (int) $request->get_param( 'id' );
		$image_data = $request->get_param( 'imageData' );

		$post = get_post( $id );
		if ( ! $post || 'socialframe_graphic' !== $post->post_type ) {
			return new WP_Error( 'not_found', __( 'Design not found.', 'socialframe' ), [ 'status' => 404 ] );
		}

		$base64 = preg_replace( '/^data:image\/png;base64,/', '', $image_data );
		$binary = base64_decode( $base64, true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode

		if ( false === $binary ) {
			return new WP_Error( 'invalid_image', __( 'Invalid image data.', 'socialframe' ), [ 'status' => 400 ] );
		}

		// Verify the decoded bytes are actually a PNG before trusting them.
		// resize_png() returns sub-width images verbatim, so without this an
		// edit_posts user could store a valid non-PNG image (e.g. a small JPEG)
		// under a .png name. Mirrors the SEC-02 guard in ExportController.
		// The leading @ suppresses the read-error notice getimagesizefromstring()
		// emits on malformed/truncated data; the false return is handled below.
		$image_info = @getimagesizefromstring( $binary ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		if ( false === $image_info || IMAGETYPE_PNG !== $image_info[2] ) {
			return new WP_Error( 'invalid_image', __( 'Invalid image data.', 'socialframe' ), [ 'status' => 400 ] );
		}

		$binary = $this->resize_png( $binary, self::PREVIEW_WIDTH );
		if ( ! $binary ) {
			return new WP_Error( 'resize_failed', __( 'Could not generate preview.', 'socialframe' ), [ 'status' => 500 ] );
		}

		$upload   = wp_upload_dir();
		$rel_path = 'socialframe/previews/sf-' . $id . '-preview.png';
		$abs_path = $upload['basedir'] . '/' . $rel_path;

		// Ensure the directory exists.
		wp_mkdir_p( dirname( $abs_path ) );

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		$bytes = file_put_contents( $abs_path, $binary );

		if ( false === $bytes ) {
			return new WP_Error( 'write_failed', __( 'Could not write preview file.', 'socialframe' ), [ 'status' => 500 ] );
		}

		update_post_meta( $id, 'socialframe_preview_path', $rel_path );

		return $this->respond(
			[ 'previewUrl' => $upload['baseurl'] . '/' . $rel_path ],
			201
		);
	}

	/**
	 * Clean up the preview file when a design post is permanently deleted.
	 *
	 * @param int $post_id The post being deleted.
	 */
	public function delete_preview_file( int $post_id ): void {
		$post = get_post( $post_id );
		if ( ! $post || 'socialframe_graphic' !== $post->post_type ) {
			return;
		}

		$rel_path = get_post_meta( $post_id, 'socialframe_preview_path', true );
		if ( empty( $rel_path ) ) {
			return;
		}

		$abs_path = wp_upload_dir()['basedir'] . '/' . $rel_path;
		if ( file_exists( $abs_path ) ) {
			wp_delete_file( $abs_path );
		}
	}
}
