<?php
/**
 * REST controller for duplicating SocialFrame designs.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

namespace SocialFrame\REST;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

/**
 * Handles POST /designs/:id/duplicate.
 *
 * Used for both design-to-design duplication and template-to-design instantiation.
 * The result is always a new design post (never a template).
 */
class DuplicateController extends AbstractController {

	/**
	 * Register REST routes.
	 */
	public function register_routes(): void {
		register_rest_route(
			self::NAMESPACE,
			'/designs/(?P<id>\d+)/duplicate',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'handle_duplicate' ],
				'permission_callback' => [ $this, 'require_edit_posts' ],
				'args'                => [
					'id' => [
						'type'    => 'integer',
						'minimum' => 1,
					],
				],
			]
		);
	}

	/**
	 * POST /designs/:id/duplicate — copy a post and its meta as a new design.
	 *
	 * @param WP_REST_Request $request Full request data.
	 */
	public function handle_duplicate( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id          = (int) $request->get_param( 'id' );
		$source_post = get_post( $id );

		if ( ! $source_post || 'socialframe_graphic' !== $source_post->post_type ) {
			return new WP_Error( 'not_found', __( 'Design not found.', 'socialframe' ), [ 'status' => 404 ] );
		}

		$new_post_id = wp_insert_post(
			[
				'post_title'  => $source_post->post_title . ' (Copy)',
				'post_type'   => 'socialframe_graphic',
				'post_status' => 'publish',
			],
			true
		);

		if ( is_wp_error( $new_post_id ) ) {
			return $new_post_id;
		}

		// Copy format and Fabric JSON; always duplicate as a design.
		$meta_to_copy = [ 'socialframe_fabric_json', 'socialframe_format' ];

		foreach ( $meta_to_copy as $key ) {
			$value = get_post_meta( $id, $key, true );
			if ( '' !== $value ) {
				update_post_meta( $new_post_id, $key, $value );
			}
		}

		update_post_meta( $new_post_id, 'socialframe_type', 'design' );
		// socialframe_image_id intentionally not copied — new design has no export yet.

		return $this->respond( $this->format_design( get_post( $new_post_id ) ), 201 );
	}
}
