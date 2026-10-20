<?php
/**
 * Tests for assigning designs to post types and for generated-design access.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

/**
 * Covers the postTypes field, the assigned_to filter, and the rule that a
 * design generated from a post is visible only to users who can edit it.
 */
class FrameAssignmentTest extends RestTestCase {

	/**
	 * Remove the post type filter between tests.
	 */
	public function tear_down(): void {
		remove_all_filters( 'socialframe_frame_post_types' );
		parent::tear_down();
	}

	/**
	 * Assigned post types round-trip, and unknown or private types are dropped.
	 */
	public function test_post_types_round_trip(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
		$design = $this->make_design();

		$res = $this->request( 'PUT', '/designs/' . $design, [ 'postTypes' => [ 'post', 'page', 'nav_menu_item', 'nope' ] ] );

		$this->assertSame( 200, $res->get_status() );
		$this->assertEqualsCanonicalizing( [ 'post', 'page' ], $res->get_data()['postTypes'] );

		$res = $this->request( 'PUT', '/designs/' . $design, [ 'postTypes' => [ 'page' ] ] );
		$this->assertSame( [ 'page' ], $res->get_data()['postTypes'] );

		$res = $this->request( 'PUT', '/designs/' . $design, [ 'postTypes' => [] ] );
		$this->assertSame( [], $res->get_data()['postTypes'] );
	}

	/**
	 * The filter can narrow the assignable types but not widen them.
	 */
	public function test_filter_only_narrows_types(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
		add_filter( 'socialframe_frame_post_types', fn() => [ 'page', 'nav_menu_item' ] );
		$design = $this->make_design();

		$res = $this->request( 'PUT', '/designs/' . $design, [ 'postTypes' => [ 'post', 'page', 'nav_menu_item' ] ] );

		$this->assertSame( [ 'page' ], $res->get_data()['postTypes'] );
	}

	/**
	 * GET /designs?assigned_to= lists only designs assigned to that type.
	 */
	public function test_assigned_to_filter(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
		$for_posts = $this->make_design( [ 'title' => 'For posts' ] );
		$for_pages = $this->make_design( [ 'title' => 'For pages' ] );
		$this->make_design( [ 'title' => 'Unassigned' ] );
		add_post_meta( $for_posts, 'socialframe_post_types', 'post' );
		add_post_meta( $for_pages, 'socialframe_post_types', 'page' );

		$res = $this->request( 'GET', '/designs', [ 'assigned_to' => 'post' ] );

		$this->assertSame( [ $for_posts ], wp_list_pluck( $res->get_data(), 'id' ) );
	}

	/**
	 * Duplicating a design copies neither its assignment nor its source link.
	 */
	public function test_duplicate_does_not_copy_assignment_or_source(): void {
		$editor = self::factory()->user->create( [ 'role' => 'editor' ] );
		wp_set_current_user( $editor );
		$source = self::factory()->post->create( [ 'post_author' => $editor ] );
		$design = $this->make_design( [ 'fabric_json' => '{"objects":[]}' ] );
		add_post_meta( $design, 'socialframe_post_types', 'post' );
		update_post_meta( $design, 'socialframe_source_post', $source );
		update_post_meta( $design, 'socialframe_source_design', 99 );

		$res = $this->request( 'POST', '/designs/' . $design . '/duplicate' );

		$this->assertSame( 201, $res->get_status() );
		$copy = $res->get_data()['id'];
		$this->assertSame( [], get_post_meta( $copy, 'socialframe_post_types' ) );
		$this->assertSame( '', get_post_meta( $copy, 'socialframe_source_post', true ) );
		$this->assertSame( '', get_post_meta( $copy, 'socialframe_source_design', true ) );
	}

	/**
	 * A design generated from a draft is hidden from users who cannot edit the draft.
	 */
	public function test_generated_design_hidden_from_users_who_cannot_edit_source(): void {
		$owner  = self::factory()->user->create( [ 'role' => 'author' ] );
		$other  = self::factory()->user->create( [ 'role' => 'author' ] );
		$draft  = self::factory()->post->create(
			[
				'post_author' => $owner,
				'post_status' => 'draft',
			]
		);
		$output = $this->make_design( [ 'fabric_json' => '{"objects":[]}' ] );
		update_post_meta( $output, 'socialframe_source_post', $draft );
		$shared = $this->make_design();

		wp_set_current_user( $other );

		$ids = wp_list_pluck( $this->request( 'GET', '/designs' )->get_data(), 'id' );
		$this->assertContains( $shared, $ids );
		$this->assertNotContains( $output, $ids );

		$this->assertSame( 404, $this->request( 'GET', '/designs/' . $output )->get_status() );
		$this->assertSame( 404, $this->request( 'PUT', '/designs/' . $output, [ 'title' => 'x' ] )->get_status() );
		$this->assertSame( 404, $this->request( 'GET', '/designs/' . $output . '/fields' )->get_status() );
		$this->assertSame( 404, $this->request( 'POST', '/designs/' . $output . '/fill', [ 'values' => [ 'a' => 'b' ] ] )->get_status() );
		$this->assertSame( 404, $this->request( 'POST', '/designs/' . $output . '/duplicate' )->get_status() );
		$this->assertSame( 404, $this->request( 'POST', '/designs/' . $output . '/export', [ 'imageData' => $this->png_data_uri( 10, 10 ) ] )->get_status() );
		$this->assertSame( 404, $this->request( 'POST', '/designs/' . $output . '/preview', [ 'imageData' => $this->png_data_uri( 10, 10 ) ] )->get_status() );

		wp_set_current_user( $owner );
		$this->assertSame( 200, $this->request( 'GET', '/designs/' . $output )->get_status() );

		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
		$this->assertSame( 200, $this->request( 'GET', '/designs/' . $output )->get_status() );
	}

	/**
	 * Once the source post is deleted, the generated design is an ordinary one.
	 */
	public function test_generated_design_with_deleted_source_is_shared(): void {
		$owner  = self::factory()->user->create( [ 'role' => 'author' ] );
		$draft  = self::factory()->post->create(
			[
				'post_author' => $owner,
				'post_status' => 'draft',
			]
		);
		$output = $this->make_design();
		update_post_meta( $output, 'socialframe_source_post', $draft );
		wp_delete_post( $draft, true );

		wp_set_current_user( self::factory()->user->create( [ 'role' => 'author' ] ) );

		$this->assertSame( 200, $this->request( 'GET', '/designs/' . $output )->get_status() );
	}
}
