<?php
/**
 * REST controller for importing WordPress post content into the editor.
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
use WP_Query;
use SocialFrame\Fields\PostSource;

/**
 * Provides two endpoints:
 *   GET /socialframe/v1/post-import          — search across all public post types
 *   GET /socialframe/v1/post-import/{id}     — fetch importable data for a single post
 */
class PostImportController extends AbstractController {

	/**
	 * Register the post-import REST routes.
	 */
	public function register_routes(): void {
		register_rest_route(
			self::NAMESPACE,
			'/post-import',
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'search_posts' ],
				'permission_callback' => [ $this, 'require_edit_posts' ],
				'args'                => [
					'search'   => [
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
						'default'           => '',
					],
					'per_page' => [
						'type'    => 'integer',
						'default' => 20,
						'minimum' => 1,
						'maximum' => 50,
					],
				],
			]
		);

		register_rest_route(
			self::NAMESPACE,
			'/post-import/(?P<id>\d+)',
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_post_data' ],
				'permission_callback' => [ $this, 'require_edit_posts' ],
				'args'                => [
					'id' => [
						'type'     => 'integer',
						'required' => true,
						'minimum'  => 1,
					],
				],
			]
		);
	}

	/**
	 * Search posts across all public, REST-enabled post types.
	 *
	 * @param WP_REST_Request $request REST request object.
	 * @return WP_REST_Response
	 */
	public function search_posts( WP_REST_Request $request ): WP_REST_Response {
		$search   = $request->get_param( 'search' );
		$per_page = (int) $request->get_param( 'per_page' );

		$post_types = PostSource::public_post_types();

		$query = new WP_Query(
			[
				's'              => $search,
				'post_type'      => $post_types,
				'post_status'    => 'publish',
				'posts_per_page' => $per_page,
				'orderby'        => 'relevance',
				'no_found_rows'  => true,
			]
		);

		$results = [];
		foreach ( $query->posts as $post ) {
			$type_obj  = get_post_type_object( $post->post_type );
			$results[] = [
				'id'              => $post->ID,
				'post_type'       => $post->post_type,
				'post_type_label' => $type_obj ? $type_obj->labels->singular_name : $post->post_type,
				'title'           => html_entity_decode( get_the_title( $post ), ENT_QUOTES, 'UTF-8' ),
				'date'            => get_the_date( 'c', $post ),
			];
		}

		return $this->respond( $results );
	}

	/**
	 * Return importable data for a single post.
	 *
	 * @param WP_REST_Request $request REST request object.
	 * @return WP_REST_Response|\WP_Error
	 */
	public function get_post_data( WP_REST_Request $request ): WP_REST_Response|\WP_Error {
		$post_id = (int) $request->get_param( 'id' );
		$post    = get_post( $post_id );

		if ( ! $post || ! PostSource::can_read( $post ) ) {
			return new \WP_Error( 'not_found', __( 'Post not found.', 'socialframe' ), [ 'status' => 404 ] );
		}

		$thumb_url = get_the_post_thumbnail_url( $post_id, 'large' );

		return $this->respond(
			[
				'id'                 => $post_id,
				'title'              => PostSource::title( $post ),
				'featured_image_url' => $thumb_url ? $thumb_url : '',
				'content'            => PostSource::content( $post ),
				'excerpt'            => PostSource::excerpt( $post ),
				'terms'              => PostSource::terms( $post ),
				'meta'               => PostSource::meta( $post ),
			]
		);
	}
}
