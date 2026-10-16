<?php
/**
 * REST controller for template fields.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

namespace SocialFrame\REST;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SocialFrame\Fields\FieldFiller;
use SocialFrame\Fields\PostSource;
use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

/**
 * Handles GET /designs/:id/fields and POST /designs/:id/fill.
 *
 * A fill never changes the source: it writes the filled canvas to a new
 * design, so one template can serve any number of posts.
 */
class FieldsController extends AbstractController {

	/**
	 * Register REST routes.
	 */
	public function register_routes(): void {
		$id_arg = [
			'type'    => 'integer',
			'minimum' => 1,
		];

		register_rest_route(
			self::NAMESPACE,
			'/designs/(?P<id>\d+)/fields',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_fields' ],
				'permission_callback' => [ $this, 'require_edit_posts' ],
				'args'                => [ 'id' => $id_arg ],
			]
		);

		register_rest_route(
			self::NAMESPACE,
			'/designs/(?P<id>\d+)/fill',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'fill' ],
				'permission_callback' => [ $this, 'require_edit_posts' ],
				'args'                => [
					'id'      => $id_arg,
					'post_id' => $id_arg,
					'values'  => [
						'type'                 => 'object',
						'additionalProperties' => [
							'type' => [ 'string', 'integer' ],
						],
					],
					'title'   => [
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					],
				],
			]
		);
	}

	/**
	 * GET /designs/:id/fields — the design's fields, one per distinct name.
	 *
	 * @param WP_REST_Request $request Full request data.
	 */
	public function get_fields( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$canvas = $this->get_canvas( (int) $request->get_param( 'id' ) );

		if ( is_wp_error( $canvas ) ) {
			return $canvas;
		}

		return $this->respond( FieldFiller::collect( $canvas[1] ) );
	}

	/**
	 * POST /designs/:id/fill — create a new design with the fields filled.
	 *
	 * Values come from the post named by post_id, then from `values`, which
	 * win for the same name. Everything is validated and filled in memory
	 * before the copy is created, so a rejected request leaves nothing behind.
	 *
	 * @param WP_REST_Request $request Full request data.
	 */
	public function fill( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$has_post   = $request->has_param( 'post_id' );
		$has_values = $request->has_param( 'values' );

		if ( ! $has_post && ! $has_values ) {
			return new WP_Error( 'missing_values', __( 'Provide a post_id, values, or both.', 'socialframe' ), [ 'status' => 400 ] );
		}

		$canvas = $this->get_canvas( (int) $request->get_param( 'id' ) );
		if ( is_wp_error( $canvas ) ) {
			return $canvas;
		}
		[ $design, $decoded ] = $canvas;

		$values = [];
		$source = null;

		if ( $has_post ) {
			$source = get_post( (int) $request->get_param( 'post_id' ) );
			if ( ! $source || ! PostSource::can_read( $source ) ) {
				return new WP_Error( 'post_not_found', __( 'Post not found.', 'socialframe' ), [ 'status' => 404 ] );
			}
			$names  = array_column( FieldFiller::collect( $decoded ), 'name' );
			$values = PostSource::values_for( $source, $names );
		}

		foreach ( (array) $request->get_param( 'values' ) as $name => $value ) {
			$values[ (string) $name ] = is_string( $value ) ? sanitize_textarea_field( $value ) : (int) $value;
		}

		$result = FieldFiller::fill( $decoded, $values );

		$title = (string) $request->get_param( 'title' );
		if ( '' === $title ) {
			$title = $source
				/* translators: 1: design title, 2: title of the post the design was filled from. */
				? sprintf( __( '%1$s: %2$s', 'socialframe' ), $design->post_title, PostSource::title( $source ) )
				/* translators: %s: design title. */
				: sprintf( __( '%s (Filled)', 'socialframe' ), $design->post_title );
		}

		$encoded = wp_json_encode( $result['canvas'] );
		if ( false === $encoded ) {
			return new WP_Error( 'fill_failed', __( 'Could not encode the filled design.', 'socialframe' ), [ 'status' => 500 ] );
		}

		$new_post_id = $this->duplicate_graphic( $design, $title, $encoded );
		if ( is_wp_error( $new_post_id ) ) {
			return $new_post_id;
		}

		return $this->respond(
			[
				'design'    => $this->format_design( get_post( $new_post_id ), false ),
				'filled'    => $result['filled'],
				'unmatched' => $result['unmatched'],
			],
			201
		);
	}

	/**
	 * Load a graphic and its decoded canvas.
	 *
	 * @param int $id Post ID.
	 * @return array{0: \WP_Post, 1: array<string, mixed>}|WP_Error
	 */
	private function get_canvas( int $id ): array|WP_Error {
		$post = get_post( $id );

		if ( ! $post || 'socialframe_graphic' !== $post->post_type ) {
			return new WP_Error( 'not_found', __( 'Design not found.', 'socialframe' ), [ 'status' => 404 ] );
		}

		$decoded = json_decode( (string) get_post_meta( $post->ID, 'socialframe_fabric_json', true ), true );
		if ( ! is_array( $decoded ) ) {
			return new WP_Error( 'empty_design', __( 'This design has no saved canvas yet.', 'socialframe' ), [ 'status' => 400 ] );
		}

		return [ $post, $decoded ];
	}
}
