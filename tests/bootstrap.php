<?php
/**
 * PHPUnit bootstrap for SocialFrame integration tests.
 *
 * Loads the WordPress test suite and the plugin under test. The WordPress test
 * library is installed by bin/install-wp-tests.sh; its location is read from the
 * WP_TESTS_DIR environment variable, falling back to the system temp directory.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

$_tests_dir = getenv( 'WP_TESTS_DIR' );

if ( ! $_tests_dir ) {
	$_tests_dir = rtrim( sys_get_temp_dir(), '/\\' ) . '/wordpress-tests-lib';
}

if ( ! file_exists( "{$_tests_dir}/includes/functions.php" ) ) {
	echo "Could not find {$_tests_dir}/includes/functions.php." . PHP_EOL;
	echo 'Run bin/install-wp-tests.sh to install the WordPress test suite.' . PHP_EOL;
	exit( 1 );
}

require_once "{$_tests_dir}/includes/functions.php";

/**
 * Manually load the plugin being tested.
 */
function _socialframe_load_plugin(): void {
	require dirname( __DIR__ ) . '/socialframe.php';
}
tests_add_filter( 'muplugins_loaded', '_socialframe_load_plugin' );

require "{$_tests_dir}/includes/bootstrap.php";

// Shared abstract test case (not auto-loaded by the Test.php suffix rule).
require __DIR__ . '/phpunit/RestTestCase.php';
