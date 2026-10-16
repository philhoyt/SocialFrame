<?php
/**
 * "Create graphic" row action on post list tables.
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
 * Adds a row action that starts a graphic from a post, by picking a template
 * with fields on the New Design screen.
 */
class PostRowActions {

	/**
	 * Hook into the list tables.
	 *
	 * The post_row_actions filter only runs for non-hierarchical types, so pages and
	 * hierarchical custom post types need page_row_actions as well.
	 */
	public function register(): void {
		add_filter( 'post_row_actions', [ $this, 'add_action' ], 10, 2 );
		add_filter( 'page_row_actions', [ $this, 'add_action' ], 10, 2 );
	}

	/**
	 * Add the "Create graphic" link for posts SocialFrame can read from.
	 *
	 * @param string[] $actions Row action links.
	 * @param \WP_Post $post    Row's post.
	 * @return string[]
	 */
	public function add_action( $actions, $post ): array {
		$actions = (array) $actions;

		if ( ! $post instanceof \WP_Post || ! current_user_can( 'edit_posts' ) || ! PostSource::can_read( $post ) ) {
			return $actions;
		}

		$url = add_query_arg(
			[
				'page'      => 'socialframe-new',
				'from_post' => $post->ID,
			],
			admin_url( 'admin.php' )
		);

		$actions['socialframe_create_graphic'] = sprintf(
			'<a href="%1$s" aria-label="%2$s">%3$s</a>',
			esc_url( $url ),
			/* translators: %s: post title. */
			esc_attr( sprintf( __( 'Create a graphic from &#8220;%s&#8221;', 'socialframe' ), PostSource::title( $post ) ) ),
			esc_html__( 'Create graphic', 'socialframe' )
		);

		return $actions;
	}
}
