<?php
/**
 * REST controller for importing WordPress post content into the editor.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

namespace SocialFrame\REST;

use WP_REST_Request;
use WP_REST_Response;
use WP_Query;

/**
 * Provides two endpoints:
 *   GET /socialframe/v1/post-import          — search across all public post types
 *   GET /socialframe/v1/post-import/{id}     — fetch importable data for a single post
 */
class PostImportController extends AbstractController {

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
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function search_posts( WP_REST_Request $request ): WP_REST_Response {
		$search   = $request->get_param( 'search' );
		$per_page = (int) $request->get_param( 'per_page' );

		$post_types = $this->get_public_post_types();

		$query = new WP_Query( [
			's'              => $search,
			'post_type'      => $post_types,
			'post_status'    => 'publish',
			'posts_per_page' => $per_page,
			'orderby'        => 'relevance',
			'no_found_rows'  => true,
		] );

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
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|\WP_Error
	 */
	public function get_post_data( WP_REST_Request $request ): WP_REST_Response|\WP_Error {
		$post_id = (int) $request->get_param( 'id' );
		$post    = get_post( $post_id );

		if ( ! $post || 'publish' !== $post->post_status ) {
			return new \WP_Error( 'not_found', __( 'Post not found.', 'socialframe' ), [ 'status' => 404 ] );
		}

		// Content — apply filters then strip all HTML tags.
		$raw_content = $post->post_content;
		$content     = '';
		if ( $raw_content ) {
			$filtered = apply_filters( 'the_content', $raw_content ); // @phpstan-ignore-line
			$content  = wp_strip_all_tags( $filtered );
			$content  = html_entity_decode( $content, ENT_QUOTES, 'UTF-8' );
			$content  = preg_replace( '/\n{3,}/', "\n\n", trim( $content ) ) ?? $content;
		}

		// Excerpt.
		$excerpt = '';
		if ( $post->post_excerpt ) {
			$excerpt = wp_strip_all_tags( $post->post_excerpt );
			$excerpt = html_entity_decode( $excerpt, ENT_QUOTES, 'UTF-8' );
			$excerpt = trim( $excerpt );
		}

		// Featured image.
		$featured_image_url = get_the_post_thumbnail_url( $post_id, 'large' ) ?: '';

		// Meta fields — public (non-underscore-prefixed), non-empty scalars only.
		// Each entry is typed so the editor can render/import it correctly.
		$raw_meta = get_post_meta( $post_id );
		$meta     = [];
		foreach ( $raw_meta as $key => $values ) {
			if ( str_starts_with( $key, '_' ) ) {
				continue;
			}
			$value = maybe_unserialize( $values[0] ?? '' );
			if ( ! is_scalar( $value ) || '' === (string) $value ) {
				continue;
			}

			$meta[ $key ] = $this->classify_meta_value( $value );
		}

		// Taxonomy terms — all taxonomies attached to the post type that have terms on this post.
		$terms = $this->get_post_terms( $post_id, $post->post_type );

		return $this->respond( [
			'id'                 => $post_id,
			'title'              => html_entity_decode( get_the_title( $post ), ENT_QUOTES, 'UTF-8' ),
			'featured_image_url' => $featured_image_url,
			'content'            => $content,
			'excerpt'            => $excerpt,
			'terms'              => $terms,
			'meta'               => $meta,
		] );
	}

	/**
	 * Return all taxonomy terms assigned to a post, keyed by taxonomy slug.
	 *
	 * Only includes taxonomies that actually have terms on this post.
	 * Returns an associative array of:
	 *   taxonomy_slug => { label: string, terms: string[] }
	 *
	 * @param int    $post_id   Post ID.
	 * @param string $post_type Post type slug.
	 * @return array<string, array{label: string, terms: string[]}>
	 */
	private function get_post_terms( int $post_id, string $post_type ): array {
		$taxonomies = get_object_taxonomies( $post_type, 'objects' );
		$result     = [];

		foreach ( $taxonomies as $slug => $taxonomy ) {
			$terms = get_the_terms( $post_id, $slug );
			if ( ! $terms || is_wp_error( $terms ) ) {
				continue;
			}
			$result[ $slug ] = [
				'label' => $taxonomy->labels->name,
				'terms' => array_map( fn( $t ) => $t->name, $terms ),
			];
		}

		return $result;
	}

	/**
	 * Classify a scalar meta value into a typed structure.
	 *
	 * Returns an array with:
	 *   type      — 'image' | 'text'
	 *   value     — the raw scalar value (original meta value)
	 *   image_url — resolved image URL (only present when type === 'image')
	 *
	 * Detection order:
	 *   1. Numeric value that maps to a WordPress image attachment → type=image
	 *   2. String URL ending with a common image extension          → type=image
	 *   3. Everything else                                          → type=text
	 *
	 * @param mixed $value Scalar meta value.
	 * @return array<string, mixed>
	 */
	private function classify_meta_value( mixed $value ): array {
		// 1. Numeric attachment ID.
		if ( is_numeric( $value ) && (int) $value > 0 ) {
			$attachment_url = wp_get_attachment_url( (int) $value );
			if ( $attachment_url ) {
				$mime = get_post_mime_type( (int) $value );
				if ( is_string( $mime ) && str_starts_with( $mime, 'image/' ) ) {
					return [
						'type'      => 'image',
						'value'     => $value,
						'image_url' => $attachment_url,
					];
				}
			}
		}

		// 2. URL string pointing to an image file.
		if ( is_string( $value ) && preg_match( '/\.(jpe?g|png|gif|webp|svg)(\?.*)?$/i', $value ) ) {
			return [
				'type'      => 'image',
				'value'     => $value,
				'image_url' => $value,
			];
		}

		// 3. Plain text.
		return [
			'type'  => 'text',
			'value' => $value,
		];
	}

	/**
	 * Return all public post type slugs that are also visible in REST.
	 *
	 * @return string[]
	 */
	private function get_public_post_types(): array {
		$types = get_post_types(
			[
				'public'       => true,
				'show_in_rest' => true,
			],
			'names'
		);

		// Exclude SocialFrame's own post type.
		unset( $types['socialframe_graphic'] );

		return array_values( $types );
	}
}
