<?php
/**
 * Runs when the plugin is uninstalled.
 *
 * Deletes all socialframe_graphic posts (any status) with their meta, and the
 * generated preview images. Exported PNGs are ordinary Media Library
 * attachments and are kept.
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
		// 'any' skips trash and auto-draft, so list every status explicitly.
		'post_status'    => array_keys( get_post_stati() ),
		'fields'         => 'ids',
	]
);

foreach ( $socialframe_posts as $socialframe_post_id ) {
	wp_delete_post( (int) $socialframe_post_id, true );
}

// Plugin hooks are not loaded during uninstall, so the per-post preview
// cleanup never ran — remove the previews directory directly.
$socialframe_previews_dir = wp_upload_dir()['basedir'] . '/socialframe/previews';

if ( is_dir( $socialframe_previews_dir ) ) {
	foreach ( (array) glob( $socialframe_previews_dir . '/*' ) as $socialframe_file ) {
		wp_delete_file( $socialframe_file );
	}
	// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_rmdir, WordPress.PHP.NoSilencedErrors.Discouraged
	@rmdir( $socialframe_previews_dir );
	// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_rmdir, WordPress.PHP.NoSilencedErrors.Discouraged
	@rmdir( dirname( $socialframe_previews_dir ) );
}

// Remove any lingering options if added in the future.
delete_option( 'socialframe_version' );

flush_rewrite_rules();
