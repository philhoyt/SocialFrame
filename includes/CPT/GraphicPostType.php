<?php
/**
 * Custom post type registration for SocialFrame.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

namespace SocialFrame\CPT;

/**
 * Registers the socialframe_graphic custom post type.
 */
class GraphicPostType {

	/**
	 * Hook into WordPress to register the post type.
	 */
	public function register(): void {
		add_action( 'init', [ $this, 'register_post_type' ] );
	}

	/**
	 * Register the socialframe_graphic post type.
	 */
	public function register_post_type(): void {
		register_post_type(
			'socialframe_graphic',
			[
				'label'              => __( 'SocialFrame Graphic', 'socialframe' ),
				'labels'             => [
					'name'          => __( 'SocialFrame Graphics', 'socialframe' ),
					'singular_name' => __( 'SocialFrame Graphic', 'socialframe' ),
					'add_new_item'  => __( 'Add New Graphic', 'socialframe' ),
					'edit_item'     => __( 'Edit Graphic', 'socialframe' ),
					'view_item'     => __( 'View Graphic', 'socialframe' ),
					'search_items'  => __( 'Search Graphics', 'socialframe' ),
					'not_found'     => __( 'No graphics found.', 'socialframe' ),
				],
				'public'             => false,
				'publicly_queryable' => false,
				'show_ui'            => true,
				'show_in_menu'       => false,
				'show_in_nav_menus'  => false,
				'show_in_rest'       => false,
				'supports'           => [ 'title' ],
				'capability_type'    => 'post',
				'map_meta_cap'       => true,
				'rewrite'            => false,
				'query_var'          => false,
				'delete_with_user'   => false,
			]
		);
	}
}
