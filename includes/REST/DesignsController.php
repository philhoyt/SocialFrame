<?php
/**
 * REST controller for SocialFrame designs.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

namespace SocialFrame\REST;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SocialFrame\Fields\PostSource;
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
						'type'        => [
							'type'    => 'string',
							'default' => 'design',
							'enum'    => [ 'design', 'template', 'any' ],
						],
						'has_fields'  => [
							'type'    => 'boolean',
							'default' => false,
						],
						'assigned_to' => [
							'type'              => 'string',
							'default'           => '',
							'sanitize_callback' => 'sanitize_key',
						],
						'page'        => [
							'type'    => 'integer',
							'default' => 1,
							'minimum' => 1,
						],
						'per_page'    => [
							'type'    => 'integer',
							'default' => 100,
							'minimum' => 1,
							'maximum' => 100,
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
							'enum'     => array_merge( array_keys( socialframe_get_formats() ), [ 'custom' ] ),
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
						'width'      => [
							'type'    => 'integer',
							'default' => 0,
						],
						'height'     => [
							'type'    => 'integer',
							'default' => 0,
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
						'postTypes'  => [
							'type'  => 'array',
							'items' => [ 'type' => 'string' ],
						],
					],
				],
				[
					'methods'             => \WP_REST_Server::DELETABLE,
					'callback'            => [ $this, 'delete_design' ],
					'permission_callback' => [ $this, 'require_delete_graphic' ],
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
	 * GET /designs — list designs or templates, one page at a time.
	 *
	 * Totals are returned in X-WP-Total / X-WP-TotalPages headers, matching
	 * core's REST collections, so clients can fetch every page (ARC-03).
	 *
	 * @param WP_REST_Request $request Full request data.
	 */
	public function get_designs( WP_REST_Request $request ): WP_REST_Response {
		$per_page = (int) $request->get_param( 'per_page' );

		$meta_query = [];
		if ( 'any' !== $request->get_param( 'type' ) ) {
			$meta_query[] = [
				'key'   => 'socialframe_type',
				'value' => $request->get_param( 'type' ),
			];
		}
		if ( $request->get_param( 'has_fields' ) ) {
			$meta_query[] = [
				'key'   => 'socialframe_has_fields',
				'value' => '1',
			];
		}
		if ( '' !== $request->get_param( 'assigned_to' ) ) {
			$meta_query[] = [
				'key'   => 'socialframe_post_types',
				'value' => $request->get_param( 'assigned_to' ),
			];
		}

		$query = new \WP_Query(
			[
				'post_type'      => 'socialframe_graphic',
				'posts_per_page' => $per_page,
				'paged'          => (int) $request->get_param( 'page' ),
				'post_status'    => 'publish',
				// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
				'meta_query'     => $meta_query,
				'orderby'        => 'modified',
				'order'          => 'DESC',
			]
		);

		// Prime exported-attachment posts in one query instead of one per
		// design when format_design() resolves their URLs (PRF-01).
		$image_ids = array_filter(
			array_map(
				fn( \WP_Post $post ): int => (int) get_post_meta( $post->ID, 'socialframe_image_id', true ),
				$query->posts
			)
		);
		if ( $image_ids ) {
			_prime_post_caches( $image_ids, false, true );
		}

		// Generated designs the user may not see are dropped after the query,
		// so a page can hold fewer than per_page items; totals stay the
		// query's, which keeps pagination stable.
		$designs = array_map(
			fn( \WP_Post $post ): array => $this->format_design( $post, false ),
			array_values( array_filter( $query->posts, [ self::class, 'can_access_graphic' ] ) )
		);

		$response = $this->respond( $designs );
		$response->header( 'X-WP-Total', (string) $query->found_posts );
		$response->header( 'X-WP-TotalPages', (string) (int) ceil( $query->found_posts / $per_page ) );

		return $response;
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

		if ( 'custom' === $format ) {
			// Stored via meta, which clamps to GraphicMeta's allowed range.
			update_post_meta( $post_id, 'socialframe_width', (int) $request->get_param( 'width' ) );
			update_post_meta( $post_id, 'socialframe_height', (int) $request->get_param( 'height' ) );
		}

		if ( ! empty( $fabric_json ) ) {
			update_post_meta( $post_id, 'socialframe_fabric_json', wp_slash( $fabric_json ) );
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
		$post = $this->get_graphic( (int) $request->get_param( 'id' ) );

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
		$post = $this->get_graphic( (int) $request->get_param( 'id' ) );

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
			update_post_meta( $post->ID, 'socialframe_fabric_json', wp_slash( $request->get_param( 'fabricJson' ) ) );
		}

		if ( $request->has_param( 'postTypes' ) ) {
			$types = array_intersect(
				PostSource::frame_post_types(),
				array_map( 'sanitize_key', (array) $request->get_param( 'postTypes' ) )
			);

			delete_post_meta( $post->ID, 'socialframe_post_types' );
			foreach ( $types as $type ) {
				add_post_meta( $post->ID, 'socialframe_post_types', $type );
			}
		}

		return $this->respond( $this->format_design( get_post( $post->ID ) ) );
	}

	/**
	 * DELETE /designs/:id — delete a design.
	 *
	 * @param WP_REST_Request $request Full request data.
	 */
	public function delete_design( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$post = $this->get_graphic( (int) $request->get_param( 'id' ) );

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
}
