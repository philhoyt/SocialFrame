<?php
/**
 * Runs when the plugin is uninstalled.
 *
 * Deletes all socialframe_graphic posts and their meta.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

$socialframe_posts = get_posts(
	[
		'post_type'      => 'socialframe_graphic',
		'posts_per_page' => -1,
		'post_status'    => 'any',
		'fields'         => 'ids',
	]
);

foreach ( $socialframe_posts as $socialframe_post_id ) {
	wp_delete_post( (int) $socialframe_post_id, true );
}

// Remove any lingering options if added in the future.
delete_option( 'socialframe_version' );

flush_rewrite_rules();
