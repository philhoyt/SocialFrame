<?php
/**
 * REST controller for SocialFrame templates.
 */

declare( strict_types=1 );

namespace SocialFrame\REST;

use WP_REST_Request;
use WP_REST_Response;

/**
 * Handles GET /templates.
 *
 * Merges bundled templates (registered via the socialframe_templates filter)
 * with user-saved template posts.
 */
class TemplatesController extends AbstractController {

	/**
	 * Register REST routes.
	 */
	public function register_routes(): void {
		register_rest_route(
			self::NAMESPACE,
			'/templates',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_templates' ],
				'permission_callback' => [ $this, 'require_edit_posts' ],
			]
		);
	}

	/**
	 * GET /templates — list bundled and user-saved templates.
	 */
	public function get_templates( WP_REST_Request $request ): WP_REST_Response {
		$bundled   = $this->get_bundled_templates();
		$user_made = $this->get_user_templates();

		return $this->respond( [
			'bundled'  => $bundled,
			'userMade' => $user_made,
		] );
	}

	/**
	 * Load bundled templates from the /templates directory via the filter.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	private function get_bundled_templates(): array {
		$templates_dir = SOCIALFRAME_DIR . 'templates/';
		$bundled       = [];

		if ( ! is_dir( $templates_dir ) ) {
			return $bundled;
		}

		$format_dirs = glob( $templates_dir . '*', GLOB_ONLYDIR );

		if ( ! $format_dirs ) {
			return $bundled;
		}

		foreach ( $format_dirs as $format_dir ) {
			$format = basename( $format_dir );
			$files  = glob( $format_dir . '/*.json' );

			if ( ! $files ) {
				continue;
			}

			foreach ( $files as $file ) {
				$name = pathinfo( $file, PATHINFO_FILENAME );
				// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
				$json = file_get_contents( $file );

				if ( false === $json ) {
					continue;
				}

				$bundled[] = [
					'id'         => $format . '/' . $name,
					'label'      => $this->make_label( $format, $name ),
					'format'     => $format,
					'fabricJson' => $json,
					'source'     => 'bundled',
				];
			}
		}

		/**
		 * Filters the list of bundled SocialFrame templates.
		 *
		 * Theme and plugin authors can add their own templates here.
		 *
		 * @param array $bundled Array of template objects.
		 */
		return apply_filters( 'socialframe_templates', $bundled );
	}

	/**
	 * Fetch user-saved templates from the database.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	private function get_user_templates(): array {
		$posts = get_posts(
			[
				'post_type'      => 'socialframe_graphic',
				'posts_per_page' => 100,
				'post_status'    => 'publish',
				'meta_query'     => [
					[
						'key'   => 'socialframe_type',
						'value' => 'template',
					],
				],
				'orderby'        => 'modified',
				'order'          => 'DESC',
			]
		);

		return array_map(
			function ( \WP_Post $post ): array {
				$image_id = (int) get_post_meta( $post->ID, 'socialframe_image_id', true );
				return [
					'id'           => $post->ID,
					'label'        => $post->post_title,
					'format'       => (string) get_post_meta( $post->ID, 'socialframe_format', true ),
					'fabricJson'   => (string) get_post_meta( $post->ID, 'socialframe_fabric_json', true ),
					'thumbnailUrl' => $image_id ? wp_get_attachment_url( $image_id ) : '',
					'source'       => 'user',
				];
			},
			$posts
		);
	}

	/**
	 * Generate a human-readable label from format and filename.
	 *
	 * @param string $format Format key, e.g. 'instagram-post'.
	 * @param string $name   Filename without extension, e.g. 'template-01'.
	 */
	private function make_label( string $format, string $name ): string {
		$formats   = socialframe_get_formats();
		$fmt_label = isset( $formats[ $format ] ) ? $formats[ $format ]['label'] : ucwords( str_replace( '-', ' ', $format ) );
		$index     = (int) filter_var( $name, FILTER_SANITIZE_NUMBER_INT );
		return $fmt_label . ' ' . $index;
	}
}
