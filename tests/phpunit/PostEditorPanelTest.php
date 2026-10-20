<?php
/**
 * Tests for loading the SocialFrame panel in the block editor.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

use SocialFrame\Admin\PostEditorPanel;

/**
 * Covers which post types and users get the panel.
 */
class PostEditorPanelTest extends WP_UnitTestCase {

	/**
	 * Assign a design to posts.
	 */
	public function set_up(): void {
		parent::set_up();

		$design = self::factory()->post->create( [ 'post_type' => 'socialframe_graphic' ] );
		add_post_meta( $design, 'socialframe_post_types', 'post' );
	}

	/**
	 * Remove the post type filter between tests.
	 */
	public function tear_down(): void {
		remove_all_filters( 'socialframe_frame_post_types' );
		parent::tear_down();
	}

	/**
	 * An author gets the panel on a type with an assigned design.
	 */
	public function test_loads_for_assigned_type(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'author' ] ) );

		$this->assertTrue( PostEditorPanel::should_load( 'post' ) );
	}

	/**
	 * No panel on a type with no assigned design.
	 */
	public function test_skips_unassigned_type(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );

		$this->assertFalse( PostEditorPanel::should_load( 'page' ) );
	}

	/**
	 * No panel for users who cannot upload files.
	 */
	public function test_skips_user_without_upload_files(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'contributor' ] ) );

		$this->assertFalse( PostEditorPanel::should_load( 'post' ) );
	}

	/**
	 * No panel on a type the filter removed.
	 */
	public function test_skips_filtered_out_type(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
		add_filter( 'socialframe_frame_post_types', fn() => [ 'page' ] );

		$this->assertFalse( PostEditorPanel::should_load( 'post' ) );
	}

	/**
	 * The script is enqueued on the post edit screen when the build exists.
	 */
	public function test_enqueues_on_post_screen(): void {
		if ( ! file_exists( SOCIALFRAME_DIR . 'build/post-editor/index.asset.php' ) ) {
			$this->markTestSkipped( 'Run npm run build first.' );
		}

		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
		set_current_screen( 'post' );

		do_action( 'enqueue_block_editor_assets' );

		$this->assertTrue( wp_script_is( 'socialframe-post-editor', 'enqueued' ) );

		set_current_screen( 'front' );
	}
}
