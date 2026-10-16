<?php
/**
 * Tests for the "Create graphic" row action.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

/**
 * Covers who sees the row action and where it points.
 */
class PostRowActionsTest extends WP_UnitTestCase {

	/**
	 * Run the post_row_actions filter for a post.
	 *
	 * @param int    $post_id Post ID.
	 * @param string $filter  Filter name.
	 * @return string[]
	 */
	private function actions_for( int $post_id, string $filter = 'post_row_actions' ): array {
		return apply_filters( $filter, [], get_post( $post_id ) );
	}

	/**
	 * Published posts get a link to the New Design screen in from_post mode.
	 */
	public function test_published_post_gets_link(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
		$post_id = self::factory()->post->create();

		$actions = $this->actions_for( $post_id );

		$this->assertArrayHasKey( 'socialframe_create_graphic', $actions );
		$this->assertStringContainsString( 'page=socialframe-new', $actions['socialframe_create_graphic'] );
		$this->assertStringContainsString( 'from_post=' . $post_id, $actions['socialframe_create_graphic'] );
	}

	/**
	 * Pages use page_row_actions.
	 */
	public function test_pages_get_link(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
		$page_id = self::factory()->post->create( [ 'post_type' => 'page' ] );

		$this->assertArrayHasKey( 'socialframe_create_graphic', $this->actions_for( $page_id, 'page_row_actions' ) );
	}

	/**
	 * Drafts, and users without edit_posts, get no link.
	 */
	public function test_no_link_for_drafts_or_subscribers(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
		$draft = self::factory()->post->create( [ 'post_status' => 'draft' ] );
		$this->assertArrayNotHasKey( 'socialframe_create_graphic', $this->actions_for( $draft ) );

		wp_set_current_user( self::factory()->user->create( [ 'role' => 'subscriber' ] ) );
		$this->assertArrayNotHasKey( 'socialframe_create_graphic', $this->actions_for( self::factory()->post->create() ) );
	}
}
