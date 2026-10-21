<?php
/**
 * REST controller for duplicating SocialFrame designs.
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
		$source_post = $this->get_graphic( (int) $request->get_param( 'id' ) );

		if ( is_wp_error( $source_post ) ) {
			return $source_post;
		}

		/* translators: %s: title of the design being duplicated. */
		$new_post_id = $this->duplicate_graphic( $source_post, sprintf( __( '%s (Copy)', 'socialframe' ), $source_post->post_title ) );

		if ( is_wp_error( $new_post_id ) ) {
			return $new_post_id;
		}

		return $this->respond( $this->format_design( get_post( $new_post_id ) ), 201 );
	}
}
