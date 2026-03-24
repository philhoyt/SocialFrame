<?php
/**
 * Abstract base controller for SocialFrame REST endpoints.
 */

declare( strict_types=1 );

namespace SocialFrame\REST;

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
	 * Build a standard design object shape from a WP_Post.
	 *
	 * @param \WP_Post $post The post object.
	 * @return array<string, mixed>
	 */
	protected function format_design( \WP_Post $post ): array {
		$image_id = (int) get_post_meta( $post->ID, 'socialframe_image_id', true );

		return [
			'id'           => $post->ID,
			'title'        => $post->post_title,
			'format'       => (string) get_post_meta( $post->ID, 'socialframe_format', true ),
			'type'         => (string) get_post_meta( $post->ID, 'socialframe_type', true ),
			'fabricJson'   => (string) get_post_meta( $post->ID, 'socialframe_fabric_json', true ),
			'imageId'      => $image_id,
			'thumbnailUrl' => $image_id ? wp_get_attachment_url( $image_id ) : '',
			'modified'     => $post->post_modified_gmt,
			'editUrl'      => admin_url( 'admin.php?page=socialframe-editor&id=' . $post->ID ),
		];
	}
}
