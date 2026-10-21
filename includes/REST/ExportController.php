<?php
/**
 * REST controller for SocialFrame design export.
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
				'permission_callback' => [ $this, 'require_upload_files' ],
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
	 *
	 * @param WP_REST_Request $request Full request data.
	 */
	public function handle_export( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$post = $this->get_graphic( (int) $request->get_param( 'id' ) );
		if ( is_wp_error( $post ) ) {
			return $post;
		}

		$stored = $this->store_png( $post, (string) $request->get_param( 'imageData' ), (bool) $request->get_param( 'thumbnail' ) );
		if ( is_wp_error( $stored ) ) {
			return $stored;
		}

		return $this->respond( $stored, 201 );
	}
}
