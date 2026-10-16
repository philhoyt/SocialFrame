<?php
/**
 * Tests for uninstall.php cleanup.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

/**
 * Covers ARC-02: designs in every status and preview files are removed.
 */
class UninstallTest extends RestTestCase {

	/**
	 * Uninstall removes trashed designs and the previews directory.
	 */
	public function test_uninstall_removes_designs_and_previews(): void {
		$published = $this->make_design();
		$trashed   = $this->make_design( [ 'post_status' => 'trash' ] );

		$dir = wp_upload_dir()['basedir'] . '/socialframe/previews';
		wp_mkdir_p( $dir );
		file_put_contents( $dir . '/sf-' . $published . '-preview.png', 'x' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents

		if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
			define( 'WP_UNINSTALL_PLUGIN', 'SocialFrame/socialframe.php' );
		}
		require dirname( __DIR__, 2 ) . '/uninstall.php';

		$this->assertNull( get_post( $published ) );
		$this->assertNull( get_post( $trashed ) );
		$this->assertDirectoryDoesNotExist( $dir );
	}
}
