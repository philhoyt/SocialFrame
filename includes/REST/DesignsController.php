<?php
/**
 * REST controller for SocialFrame designs.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

namespace SocialFrame\REST;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

/**
 * Handles GET/POST /designs and GET/PUT /designs/:id.
 */
class DesignsController extends AbstractController {

	/**
	 * Register REST routes.
	 */
	public function register_routes(): void {
		register_rest_route(
			self::NAMESPACE,
			'/designs',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'get_designs' ],
					'permission_callback' => [ $this, 'require_edit_posts' ],
					'args'                => [
						'type' => [
							'type'    => 'string',
							'default' => 'design',
							'enum'    => [ 'design', 'template' ],
						],
					],
				],
				[
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => [ $this, 'create_design' ],
					'permission_callback' => [ $this, 'require_edit_posts' ],
					'args'                => [
						'title'      => [
							'type'     => 'string',
							'required' => true,
						],
						'format'     => [
							'type'     => 'string',
							'required' => true,
							'enum'     => array_keys( socialframe_get_formats() ),
						],
						'type'       => [
							'type'    => 'string',
							'default' => 'design',
							'enum'    => [ 'design', 'template' ],
						],
						'fabricJson' => [
							'type'    => 'string',
							'default' => '',
						],
					],
				],
			]
		);

		register_rest_route(
			self::NAMESPACE,
			'/designs/(?P<id>\d+)',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'get_design' ],
					'permission_callback' => [ $this, 'require_edit_posts' ],
					'args'                => [
						'id' => [
							'type'    => 'integer',
							'minimum' => 1,
						],
					],
				],
				[
					'methods'             => \WP_REST_Server::EDITABLE,
					'callback'            => [ $this, 'update_design' ],
					'permission_callback' => [ $this, 'require_edit_posts' ],
					'args'                => [
						'id'         => [
							'type'    => 'integer',
							'minimum' => 1,
						],
						'title'      => [
							'type' => 'string',
						],
						'fabricJson' => [
							'type' => 'string',
						],
					],
				],
				[
					'methods'             => \WP_REST_Server::DELETABLE,
					'callback'            => [ $this, 'delete_design' ],
					'permission_callback' => [ $this, 'require_edit_posts' ],
					'args'                => [
						'id' => [
							'type'    => 'integer',
							'minimum' => 1,
						],
					],
				],
			]
		);
	}

	/**
	 * GET /designs — list designs or templates.
	 *
	 * @param WP_REST_Request $request Full request data.
	 */
	public function get_designs( WP_REST_Request $request ): WP_REST_Response {
		$type = $request->get_param( 'type' );

		$posts = get_posts(
			[
				'post_type'      => 'socialframe_graphic',
				'posts_per_page' => 100,
				'post_status'    => 'publish',
				'meta_query'     => [
					[
						'key'   => 'socialframe_type',
						'value' => $type,
					],
				],
				'orderby'        => 'modified',
				'order'          => 'DESC',
			]
		);

		$designs = array_map( [ $this, 'format_design' ], $posts );

		return $this->respond( $designs );
	}

	/**
	 * POST /designs — create a new design or template.
	 *
	 * @param WP_REST_Request $request Full request data.
	 */
	public function create_design( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$title       = sanitize_text_field( $request->get_param( 'title' ) );
		$format      = $request->get_param( 'format' );
		$type        = $request->get_param( 'type' );
		$fabric_json = $request->get_param( 'fabricJson' );

		$post_id = wp_insert_post(
			[
				'post_title'  => $title,
				'post_type'   => 'socialframe_graphic',
				'post_status' => 'publish',
			],
			true
		);

		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}

		update_post_meta( $post_id, 'socialframe_format', $format );
		update_post_meta( $post_id, 'socialframe_type', $type );

		if ( ! empty( $fabric_json ) ) {
			update_post_meta( $post_id, 'socialframe_fabric_json', $fabric_json );
		}

		$post = get_post( $post_id );

		return $this->respond( $this->format_design( $post ), 201 );
	}

	/**
	 * GET /designs/:id — fetch a single design.
	 *
	 * @param WP_REST_Request $request Full request data.
	 */
	public function get_design( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$post = $this->get_graphic_post( (int) $request->get_param( 'id' ) );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		return $this->respond( $this->format_design( $post ) );
	}

	/**
	 * PUT /designs/:id — update a design's title and/or Fabric JSON.
	 *
	 * @param WP_REST_Request $request Full request data.
	 */
	public function update_design( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$post = $this->get_graphic_post( (int) $request->get_param( 'id' ) );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		$update = [ 'ID' => $post->ID ];

		if ( $request->has_param( 'title' ) ) {
			$update['post_title'] = sanitize_text_field( $request->get_param( 'title' ) );
		}

		if ( count( $update ) > 1 ) {
			wp_update_post( $update );
		}

		if ( $request->has_param( 'fabricJson' ) ) {
			update_post_meta( $post->ID, 'socialframe_fabric_json', $request->get_param( 'fabricJson' ) );
		}

		return $this->respond( $this->format_design( get_post( $post->ID ) ) );
	}

	/**
	 * DELETE /designs/:id — delete a design.
	 *
	 * @param WP_REST_Request $request Full request data.
	 */
	public function delete_design( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$post = $this->get_graphic_post( (int) $request->get_param( 'id' ) );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		$result = wp_delete_post( $post->ID, true );

		if ( ! $result ) {
			return new WP_Error( 'delete_failed', __( 'Could not delete the design.', 'socialframe' ), [ 'status' => 500 ] );
		}

		return $this->respond(
			[
				'deleted' => true,
				'id'      => $post->ID,
			]
		);
	}

	/**
	 * Fetch and validate a socialframe_graphic post by ID.
	 *
	 * @param int $id Post ID.
	 * @return \WP_Post|WP_Error
	 */
	private function get_graphic_post( int $id ): \WP_Post|WP_Error {
		$post = get_post( $id );

		if ( ! $post || 'socialframe_graphic' !== $post->post_type ) {
			return new WP_Error( 'not_found', __( 'Design not found.', 'socialframe' ), [ 'status' => 404 ] );
		}

		return $post;
	}
}
