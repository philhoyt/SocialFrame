<?php
/**
 * Plugin Name:       SocialFrame
 * Plugin URI:        https://github.com/philhoyt/socialframe
 * Description:       Social media graphic editor inside wp-admin.
 * Version:           1.3.1
 * Requires at least: 7.0
 * Tested up to:      7.1
 * Requires PHP:      8.1
 * Author:            Phil Hoyt
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       socialframe
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SOCIALFRAME_VERSION', '1.3.1' );
define( 'SOCIALFRAME_FILE', __FILE__ );
define( 'SOCIALFRAME_DIR', plugin_dir_path( __FILE__ ) );
define( 'SOCIALFRAME_URL', plugin_dir_url( __FILE__ ) );

spl_autoload_register(
	function ( string $class ): void {
		$prefix   = 'SocialFrame\\';
		$base_dir = SOCIALFRAME_DIR . 'includes/';

		if ( ! str_starts_with( $class, $prefix ) ) {
				return;
		}

		$relative = substr( $class, strlen( $prefix ) );
		$file     = $base_dir . str_replace( '\\', '/', $relative ) . '.php';

		if ( file_exists( $file ) ) {
			require $file;
		}
	}
);

require_once SOCIALFRAME_DIR . 'includes/Helpers.php';

// GitHub-based update checker (Plugin Update Checker). Bundled in lib/ so the
// vendor directory does not need to ship. Guarded in case lib/ is absent in dev.
if ( file_exists( SOCIALFRAME_DIR . 'lib/plugin-update-checker/plugin-update-checker.php' ) ) {
	require_once SOCIALFRAME_DIR . 'lib/plugin-update-checker/plugin-update-checker.php';

	$socialframe_update_checker = \YahnisElsts\PluginUpdateChecker\v5\PucFactory::buildUpdateChecker(
		'https://github.com/philhoyt/SocialFrame/',
		SOCIALFRAME_FILE,
		'socialframe'
	);
	// getVcsApi() is typed as the base Api class; only the GitHub API has enableReleaseAssets().
	// Without a name filter the first asset wins, and GitHub lists assets
	// by name, so readme.txt would come ahead of socialframe.zip.
	$socialframe_vcs_api = $socialframe_update_checker->getVcsApi();
	if ( method_exists( $socialframe_vcs_api, 'enableReleaseAssets' ) ) {
		$socialframe_vcs_api->enableReleaseAssets( '/^socialframe\.zip$/' );
	}
}

register_activation_hook(
	__FILE__,
	function (): void {
		( new SocialFrame\CPT\GraphicPostType() )->register_post_type();
		flush_rewrite_rules();
	}
);

register_deactivation_hook(
	__FILE__,
	function (): void {
		flush_rewrite_rules();
	}
);

add_action(
	'plugins_loaded',
	function (): void {
		( new SocialFrame\Plugin() )->boot();
	}
);
