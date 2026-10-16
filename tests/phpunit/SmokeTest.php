<?php
/**
 * Smoke test: confirm the plugin loads inside the WP test suite.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

/**
 * Basic environment sanity checks.
 */
class SmokeTest extends WP_UnitTestCase {

	/**
	 * The plugin's main constant should be defined once bootstrapped.
	 */
	public function test_plugin_constants_defined(): void {
		$this->assertTrue( defined( 'SOCIALFRAME_VERSION' ) );
	}

	/**
	 * The custom post type should be registered on init.
	 */
	public function test_post_type_registered(): void {
		$this->assertTrue( post_type_exists( 'socialframe_graphic' ) );
	}

	/**
	 * The formats helper should return the known preset formats.
	 */
	public function test_formats_helper(): void {
		$formats = socialframe_get_formats();
		$this->assertArrayHasKey( 'instagram-post', $formats );
		$this->assertSame( 1080, $formats['instagram-post']['width'] );
	}
}
