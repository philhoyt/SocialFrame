<?php
/**
 * REST controller for designs assigned to post types.
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
 * Handles GET /posts/:id/frames and POST /designs/:id/generate.
 *
 * Each post and assigned design pair has one generated design, its output,
 * linked by socialframe_source_post and socialframe_source_design. Generating
 * again fills the same output and replaces its image.
 */
class FramesController extends AbstractController {

	/**
	 * Most assigned designs listed for one post type.
	 */
	const MAX_FRAMES = 50;

	/**
	 * Seconds after which a generate lock is treated as abandoned.
	 */
	const LOCK_TTL = 60;

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
			'/posts/(?P<id>\d+)/frames',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_frames' ],
				'permission_callback' => [ $this, 'require_edit_posts' ],
				'args'                => [ 'id' => $id_arg ],
			]
		);

		register_rest_route(
			self::NAMESPACE,
			'/designs/(?P<id>\d+)/generate',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'generate' ],
				'permission_callback' => [ $this, 'require_upload_files' ],
				'args'                => [
					'id'        => $id_arg,
					'post_id'   => array_merge( $id_arg, [ 'required' => true ] ),
					'values'    => [
						'type'                 => 'object',
						'additionalProperties' => [
							'type' => [ 'string', 'integer' ],
						],
					],
					'imageData' => [
						'type' => 'string',
					],
				],
			]
		);
	}

	/**
	 * GET /posts/:id/frames — the designs assigned to this post's type, each
	 * with its current output for this post.
	 *
	 * @param WP_REST_Request $request Full request data.
	 */
	public function get_frames( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$source = $this->get_source_post( (int) $request->get_param( 'id' ) );
		if ( is_wp_error( $source ) ) {
			return $source;
		}

		$query = new \WP_Query(
			[
				'post_type'      => 'socialframe_graphic',
				'post_status'    => 'publish',
				'posts_per_page' => self::MAX_FRAMES + 1,
				'no_found_rows'  => true,
				'orderby'        => 'title',
				'order'          => 'ASC',
				// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
				'meta_query'     => [
					[
						'key'   => 'socialframe_post_types',
						'value' => $source->post_type,
					],
				],
			]
		);

		$designs   = array_values( array_filter( $query->posts, [ self::class, 'can_access_graphic' ] ) );
		$truncated = count( $designs ) > self::MAX_FRAMES;
		$designs   = array_slice( $designs, 0, self::MAX_FRAMES );
		$outputs   = $this->find_outputs( $source->ID, wp_list_pluck( $designs, 'ID' ) );

		$frames = array_map(
			function ( \WP_Post $design ) use ( $outputs ): array {
				$decoded = json_decode( (string) get_post_meta( $design->ID, 'socialframe_fabric_json', true ), true );
				$output  = $outputs[ $design->ID ] ?? null;

				return [
					'design'     => $this->format_design( $design, false ),
					'fieldNames' => is_array( $decoded ) ? array_column( FieldFiller::collect( $decoded ), 'name' ) : [],
					'output'     => $output ? $this->format_output( $output ) : null,
				];
			},
			$designs
		);

		return $this->respond(
			[
				'frames'    => $frames,
				'truncated' => $truncated,
			]
		);
	}

	/**
	 * POST /designs/:id/generate — fill a design from a post.
	 *
	 * Without imageData this is a dry run: it returns the filled canvas for
	 * the browser to render and writes nothing. With imageData it fills again,
	 * stores the image, and only then writes the output's canvas, so a failed
	 * render or upload never loses the current output.
	 *
	 * @param WP_REST_Request $request Full request data.
	 */
	public function generate( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$canvas = $this->get_canvas( (int) $request->get_param( 'id' ) );
		if ( is_wp_error( $canvas ) ) {
			return $canvas;
		}
		[ $design, $decoded ] = $canvas;

		$source = $this->get_source_post( (int) $request->get_param( 'post_id' ) );
		if ( is_wp_error( $source ) ) {
			return $source;
		}

		if ( ! in_array( $source->post_type, get_post_meta( $design->ID, 'socialframe_post_types', false ), true ) ) {
			return new WP_Error( 'not_assigned', __( 'This design is not assigned to this post type.', 'socialframe' ), [ 'status' => 400 ] );
		}

		$result  = $this->fill_canvas( $decoded, $source, (array) $request->get_param( 'values' ) );
		$encoded = wp_json_encode( $result['canvas'] );
		if ( false === $encoded ) {
			return new WP_Error( 'fill_failed', __( 'Could not encode the filled design.', 'socialframe' ), [ 'status' => 500 ] );
		}

		if ( ! $request->has_param( 'imageData' ) ) {
			[ $width, $height ] = $this->canvas_size( $design );

			return $this->respond(
				[
					'fabricJson' => $encoded,
					'width'      => $width,
					'height'     => $height,
					'filled'     => $result['filled'],
					'unmatched'  => $result['unmatched'],
					'hasOutput'  => null !== ( $this->find_outputs( $source->ID, [ $design->ID ] )[ $design->ID ] ?? null ),
				]
			);
		}

		$lock = 'socialframe_gen_lock_' . $source->ID . '_' . $design->ID;
		if ( ! $this->acquire_lock( $lock ) ) {
			return new WP_Error( 'generating', __( 'This image is already being generated.', 'socialframe' ), [ 'status' => 409 ] );
		}

		try {
			return $this->commit( $design, $source, $encoded, (string) $request->get_param( 'imageData' ) );
		} finally {
			delete_option( $lock );
		}
	}

	/**
	 * Store the image and canvas for a post and design pair.
	 *
	 * @param \WP_Post $design     Assigned design.
	 * @param \WP_Post $source     Post the values came from.
	 * @param string   $encoded    Filled Fabric JSON.
	 * @param string   $image_data PNG data URI rendered from that JSON.
	 */
	private function commit( \WP_Post $design, \WP_Post $source, string $encoded, string $image_data ): WP_REST_Response|WP_Error {
		$title  = $this->filled_title( $design, $source );
		$output = $this->find_outputs( $source->ID, [ $design->ID ] )[ $design->ID ] ?? null;

		if ( $output ) {
			$stored = $this->store_png( $output, $image_data, false, (int) get_post_meta( $output->ID, 'socialframe_image_id', true ) );
			if ( is_wp_error( $stored ) ) {
				return $stored;
			}

			if ( ! update_post_meta( $output->ID, 'socialframe_fabric_json', wp_slash( $encoded ) )
				&& get_post_meta( $output->ID, 'socialframe_fabric_json', true ) !== $encoded
			) {
				return new WP_Error( 'write_failed', __( 'Could not save the generated design.', 'socialframe' ), [ 'status' => 500 ] );
			}

			wp_update_post(
				[
					'ID'         => $output->ID,
					'post_title' => $title,
				]
			);
			$created = false;
		} else {
			$new_id = $this->duplicate_graphic( $design, $title, $encoded );
			if ( is_wp_error( $new_id ) ) {
				return $new_id;
			}

			$output = get_post( $new_id );
			$linked = update_post_meta( $new_id, 'socialframe_source_post', $source->ID )
				&& update_post_meta( $new_id, 'socialframe_source_design', $design->ID );
			$stored = $linked
				? $this->store_png( $output, $image_data )
				: new WP_Error( 'write_failed', __( 'Could not save the generated design.', 'socialframe' ), [ 'status' => 500 ] );

			if ( is_wp_error( $stored ) ) {
				wp_delete_post( $new_id, true );
				return $stored;
			}
			$created = true;
		}

		return $this->respond(
			array_merge(
				$this->format_output( get_post( $output->ID ) ),
				[ 'created' => $created ]
			),
			$created ? 201 : 200
		);
	}

	/**
	 * A post the current user may generate from, or a 404.
	 *
	 * Any status is allowed, drafts included, because generating runs from the
	 * post's own editor; the user must be able to edit the post.
	 *
	 * @param int $id Post ID.
	 * @return \WP_Post|WP_Error
	 */
	private function get_source_post( int $id ): \WP_Post|WP_Error {
		$post = get_post( $id );

		if ( ! $post
			|| ! in_array( $post->post_type, PostSource::frame_post_types(), true )
			|| ! current_user_can( 'edit_post', $post->ID )
		) {
			return new WP_Error( 'post_not_found', __( 'Post not found.', 'socialframe' ), [ 'status' => 404 ] );
		}

		return $post;
	}

	/**
	 * This post's outputs for the given designs, keyed by design ID.
	 *
	 * @param int   $source_id  Source post ID.
	 * @param int[] $design_ids Assigned design IDs.
	 * @return array<int, \WP_Post>
	 */
	private function find_outputs( int $source_id, array $design_ids ): array {
		if ( ! $design_ids ) {
			return [];
		}

		$query = new \WP_Query(
			[
				'post_type'      => 'socialframe_graphic',
				'post_status'    => 'publish',
				'posts_per_page' => count( $design_ids ) * 2,
				'no_found_rows'  => true,
				'orderby'        => 'ID',
				'order'          => 'DESC',
				// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
				'meta_query'     => [
					[
						'key'   => 'socialframe_source_post',
						'value' => $source_id,
						'type'  => 'NUMERIC',
					],
					[
						'key'     => 'socialframe_source_design',
						'value'   => array_map( 'intval', $design_ids ),
						'compare' => 'IN',
						'type'    => 'NUMERIC',
					],
				],
			]
		);

		$outputs = [];
		foreach ( $query->posts as $post ) {
			$design_id = (int) get_post_meta( $post->ID, 'socialframe_source_design', true );
			// Newest first, so the first one seen wins.
			$outputs[ $design_id ] ??= $post;
		}

		return $outputs;
	}

	/**
	 * The output shape returned to the post editor.
	 *
	 * @param \WP_Post $output Generated design.
	 * @return array{design: array<string, mixed>, imageId: int, imageUrl: string}
	 */
	private function format_output( \WP_Post $output ): array {
		$image_id = (int) get_post_meta( $output->ID, 'socialframe_image_id', true );

		return [
			'design'   => $this->format_design( $output, false ),
			'imageId'  => $image_id,
			'imageUrl' => $image_id ? (string) wp_get_attachment_url( $image_id ) : '',
		];
	}

	/**
	 * A design's canvas size: its custom size, else its format's preset.
	 *
	 * @param \WP_Post $design Design.
	 * @return array{0: int, 1: int}
	 */
	private function canvas_size( \WP_Post $design ): array {
		$width  = (int) get_post_meta( $design->ID, 'socialframe_width', true );
		$height = (int) get_post_meta( $design->ID, 'socialframe_height', true );

		if ( $width > 0 && $height > 0 ) {
			return [ $width, $height ];
		}

		$format = socialframe_get_formats()[ (string) get_post_meta( $design->ID, 'socialframe_format', true ) ] ?? null;

		return $format ? [ (int) $format['width'], (int) $format['height'] ] : [ 0, 0 ];
	}

	/**
	 * Take a short-lived lock, replacing one that was abandoned.
	 *
	 * Because add_option() fails when the option exists, the first
	 * request to add it is the only winner.
	 *
	 * @param string $name Option name.
	 */
	private function acquire_lock( string $name ): bool {
		if ( add_option( $name, time(), '', false ) ) {
			return true;
		}

		if ( (int) get_option( $name ) > time() - self::LOCK_TTL ) {
			return false;
		}

		update_option( $name, time(), false );
		return true;
	}
}
