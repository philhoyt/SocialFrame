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

		// Each design gets a random, unguessable token in its preview filename
		// so previews are not enumerable by post ID (PRV-01).
		$token = self::preview_token( $id );
		if ( '' === $token ) {
			$token = strtolower( wp_generate_password( 16, false ) );
			update_post_meta( $id, 'socialframe_preview_token', $token );
		}

		$upload   = wp_upload_dir();
		$rel_path = self::preview_rel_path( $id, $token );
		$abs_path = $upload['basedir'] . '/' . $rel_path;
		$dir      = dirname( $abs_path );

		// Ensure the directory exists and does not allow directory listing.
		wp_mkdir_p( $dir );
		if ( ! file_exists( $dir . '/index.php' ) ) {
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
			file_put_contents( $dir . '/index.php', "<?php\n// Silence is golden.\n" );
		}

		// Direct write, like core's wp_upload_bits(): uploads is always
		// PHP-writable, and WP_Filesystem may need credentials in REST.
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		$bytes = file_put_contents( $abs_path, $binary );

		if ( false === $bytes ) {
			return new WP_Error( 'write_failed', __( 'Could not write preview file.', 'socialframe' ), [ 'status' => 500 ] );
		}

		// Remove a preview left at the pre-token (guessable) path.
		$legacy = $upload['basedir'] . '/' . self::preview_rel_path( $id );
		if ( file_exists( $legacy ) ) {
			wp_delete_file( $legacy );
		}

		update_post_meta( $id, 'socialframe_preview_path', $rel_path );

		return $this->respond(
			[ 'previewUrl' => $upload['baseurl'] . '/' . $rel_path ],
			201
		);
	}

	/**
	 * Relative path (from the uploads basedir) of a design's preview PNG.
	 *
	 * The path is always derived from the post ID and a validated token —
	 * never read back from meta as a path — so a tampered meta value cannot
	 * redirect a write or delete outside the previews directory (SEC-01).
	 * Without a valid token this returns the legacy pre-token path.
	 *
	 * @param int    $id    Design post ID.
	 * @param string $token Preview token (16 lowercase alphanumerics), or ''.
	 */
	public static function preview_rel_path( int $id, string $token = '' ): string {
		if ( 1 === preg_match( '/^[a-z0-9]{16}$/', $token ) ) {
			return 'socialframe/previews/sf-' . $id . '-' . $token . '-preview.png';
		}
		return 'socialframe/previews/sf-' . $id . '-preview.png';
	}

	/**
	 * A design's stored preview token, or '' if missing or malformed.
	 *
	 * @param int $id Design post ID.
	 */
	public static function preview_token( int $id ): string {
		$token = (string) get_post_meta( $id, 'socialframe_preview_token', true );
		return 1 === preg_match( '/^[a-z0-9]{16}$/', $token ) ? $token : '';
	}

	/**
	 * Public URL of a design's preview, or '' if it has none.
	 *
	 * @param int $id Design post ID.
	 */
	public static function preview_url( int $id ): string {
		if ( ! get_post_meta( $id, 'socialframe_preview_path', true ) ) {
			return '';
		}
		return wp_upload_dir()['baseurl'] . '/' . self::preview_rel_path( $id, self::preview_token( $id ) );
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

		$basedir = wp_upload_dir()['basedir'];
		$paths   = array_unique(
			[
				self::preview_rel_path( $post_id, self::preview_token( $post_id ) ),
				self::preview_rel_path( $post_id ),
			]
		);

		foreach ( $paths as $rel_path ) {
			if ( file_exists( $basedir . '/' . $rel_path ) ) {
				wp_delete_file( $basedir . '/' . $rel_path );
			}
		}
	}
}
