<?php
/**
 * Loads the SocialFrame panel into the block editor.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

namespace SocialFrame\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SocialFrame\Fields\PostSource;

/**
 * Enqueues the document sidebar panel that generates images from the
 * designs assigned to the current post type.
 */
class PostEditorPanel {

	/**
	 * Hook into WordPress.
	 */
	public function register(): void {
		add_action( 'enqueue_block_editor_assets', [ $this, 'enqueue' ] );
	}

	/**
	 * Enqueue the panel on post edit screens of types with assigned designs.
	 */
	public function enqueue(): void {
		$screen = get_current_screen();

		if ( ! $screen || 'post' !== $screen->base || ! self::should_load( (string) $screen->post_type ) ) {
			return;
		}

		$asset_file = SOCIALFRAME_DIR . 'build/post-editor/index.asset.php';

		if ( ! file_exists( $asset_file ) ) {
			return;
		}

		$asset = require $asset_file;

		wp_enqueue_script(
			'socialframe-post-editor',
			SOCIALFRAME_URL . 'build/post-editor/index.js',
			$asset['dependencies'],
			$asset['version'],
			true
		);
		wp_set_script_translations( 'socialframe-post-editor', 'socialframe' );

		if ( file_exists( SOCIALFRAME_DIR . 'build/post-editor/index.css' ) ) {
			wp_enqueue_style(
				'socialframe-post-editor',
				SOCIALFRAME_URL . 'build/post-editor/index.css',
				[ 'wp-components' ],
				$asset['version']
			);
		}
	}

	/**
	 * Whether the panel applies to this post type for the current user.
	 *
	 * @param string $post_type Post type slug.
	 */
	public static function should_load( string $post_type ): bool {
		if ( ! current_user_can( 'edit_posts' ) || ! current_user_can( 'upload_files' ) ) {
			return false;
		}

		if ( ! in_array( $post_type, PostSource::frame_post_types(), true ) ) {
			return false;
		}

		$assigned = get_posts(
			[
				'post_type'      => 'socialframe_graphic',
				'post_status'    => 'publish',
				'posts_per_page' => 1,
				'fields'         => 'ids',
				'no_found_rows'  => true,
				// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
				'meta_query'     => [
					[
						'key'   => 'socialframe_post_types',
						'value' => $post_type,
					],
				],
			]
		);

		return [] !== $assigned;
	}
}
