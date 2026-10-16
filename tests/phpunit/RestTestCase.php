<?php
/**
 * Shared base class for SocialFrame REST integration tests.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

/**
 * Spins up a fresh REST server per test and provides image/user/design helpers.
 */
abstract class RestTestCase extends WP_UnitTestCase {

	const NS = '/socialframe/v1';

	/**
	 * Set up a clean REST server with the plugin routes registered.
	 */
	public function set_up(): void {
		parent::set_up();

		global $wp_rest_server;
		$wp_rest_server = new WP_REST_Server();
		do_action( 'rest_api_init' );
	}

	/**
	 * Tear down the REST server.
	 */
	public function tear_down(): void {
		global $wp_rest_server;
		$wp_rest_server = null;

		parent::tear_down();
	}

	/**
	 * Dispatch a REST request and return the response.
	 *
	 * @param string               $method HTTP method.
	 * @param string               $route  Route path (without namespace).
	 * @param array<string, mixed> $params Request params.
	 * @return WP_REST_Response
	 */
	protected function request( string $method, string $route, array $params = [] ): WP_REST_Response {
		$req = new WP_REST_Request( $method, self::NS . $route );
		foreach ( $params as $key => $value ) {
			$req->set_param( $key, $value );
		}
		return rest_get_server()->dispatch( $req );
	}

	/**
	 * Create a socialframe_graphic post with the given meta.
	 *
	 * @param array<string, mixed> $args Optional overrides: author, type, format, fabric_json, post_status.
	 * @return int Post ID.
	 */
	protected function make_design( array $args = [] ): int {
		$post_id = self::factory()->post->create(
			[
				'post_type'   => 'socialframe_graphic',
				'post_title'  => $args['title'] ?? 'Test Design',
				'post_status' => $args['post_status'] ?? 'publish',
				'post_author' => $args['author'] ?? 0,
			]
		);

		update_post_meta( $post_id, 'socialframe_type', $args['type'] ?? 'design' );
		update_post_meta( $post_id, 'socialframe_format', $args['format'] ?? 'instagram-post' );

		if ( isset( $args['fabric_json'] ) ) {
			update_post_meta( $post_id, 'socialframe_fabric_json', wp_slash( $args['fabric_json'] ) );
		}

		return $post_id;
	}

	/**
	 * Generate a real PNG and return it as a base64 data URI.
	 *
	 * @param int $width  Image width.
	 * @param int $height Image height.
	 * @return string data:image/png;base64,... URI.
	 */
	protected function png_data_uri( int $width = 800, int $height = 600 ): string {
		$img = imagecreatetruecolor( $width, $height );
		imagefilledrectangle( $img, 0, 0, $width - 1, $height - 1, imagecolorallocate( $img, 10, 20, 30 ) );
		ob_start();
		imagepng( $img );
		$binary = ob_get_clean();

		return 'data:image/png;base64,' . base64_encode( $binary );
	}

	/**
	 * Generate a real JPEG and return it as base64 (no data-URI prefix), to
	 * simulate a valid non-PNG image being submitted.
	 *
	 * @param int $width  Image width.
	 * @param int $height Image height.
	 * @return string Raw base64 of a JPEG.
	 */
	protected function jpeg_base64( int $width = 100, int $height = 100 ): string {
		$img = imagecreatetruecolor( $width, $height );
		imagefilledrectangle( $img, 0, 0, $width - 1, $height - 1, imagecolorallocate( $img, 200, 100, 50 ) );
		ob_start();
		imagejpeg( $img );
		$binary = ob_get_clean();

		return base64_encode( $binary );
	}
}
