<?php
/**
 * Tests for the Designs REST controller, including delete capability gating.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

/**
 * Covers CRUD plus the per-post delete authorization (ACL-01 resolution).
 */
class DesignsControllerTest extends RestTestCase {

	/**
	 * An editor can list, create, read, and update designs.
	 */
	public function test_create_design_persists_meta(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );

		$res = $this->request(
			'POST',
			'/designs',
			[
				'title'  => 'Launch Banner',
				'format' => 'facebook-post',
				'type'   => 'design',
			]
		);

		$this->assertSame( 201, $res->get_status() );
		$data = $res->get_data();
		$this->assertSame( 'Launch Banner', $data['title'] );
		$this->assertSame( 'facebook-post', $data['format'] );
		$this->assertSame( 'design', get_post_meta( $data['id'], 'socialframe_type', true ) );
	}

	/**
	 * An invalid format is rejected by REST arg validation.
	 */
	public function test_create_design_rejects_unknown_format(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );

		$res = $this->request(
			'POST',
			'/designs',
			[
				'title'  => 'Bad',
				'format' => 'not-a-format',
			]
		);

		$this->assertSame( 400, $res->get_status() );
	}

	/**
	 * A custom format stores clamped width/height.
	 */
	public function test_create_custom_format_clamps_dimensions(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );

		$res = $this->request(
			'POST',
			'/designs',
			[
				'title'  => 'Custom',
				'format' => 'custom',
				'width'  => 999999,
				'height' => 50,
			]
		);

		$this->assertSame( 201, $res->get_status() );
		$id = $res->get_data()['id'];
		$this->assertSame( 5000, (int) get_post_meta( $id, 'socialframe_width', true ) );
		$this->assertSame( 100, (int) get_post_meta( $id, 'socialframe_height', true ) );
	}

	/**
	 * Listing returns only designs of the requested type.
	 */
	public function test_get_designs_filters_by_type(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
		$this->make_design( [ 'type' => 'design' ] );
		$this->make_design( [ 'type' => 'template' ] );

		$designs = $this->request( 'GET', '/designs', [ 'type' => 'design' ] )->get_data();
		$this->assertCount( 1, $designs );

		$templates = $this->request( 'GET', '/designs', [ 'type' => 'template' ] )->get_data();
		$this->assertCount( 1, $templates );
	}

	/**
	 * Fetching a non-graphic ID returns 404.
	 */
	public function test_get_design_404_for_non_graphic(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
		$post_id = self::factory()->post->create(); // regular post.

		$res = $this->request( 'GET', '/designs/' . $post_id );
		$this->assertSame( 404, $res->get_status() );
	}

	/**
	 * Updating sets the title and Fabric JSON.
	 */
	public function test_update_design(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
		$id = $this->make_design();

		$res = $this->request(
			'PUT',
			'/designs/' . $id,
			[
				'title'      => 'Renamed',
				'fabricJson' => '{"objects":[]}',
			]
		);

		$this->assertSame( 200, $res->get_status() );
		$this->assertSame( 'Renamed', get_post( $id )->post_title );
		$this->assertSame( '{"objects":[]}', get_post_meta( $id, 'socialframe_fabric_json', true ) );
	}

	/**
	 * The owner may delete their own design.
	 */
	public function test_owner_can_delete_own_design(): void {
		$author = self::factory()->user->create( [ 'role' => 'author' ] );
		$id     = $this->make_design( [ 'author' => $author ] );

		wp_set_current_user( $author );
		$res = $this->request( 'DELETE', '/designs/' . $id );

		$this->assertSame( 200, $res->get_status() );
		$this->assertNull( get_post( $id ) );
	}

	/**
	 * A different non-editor user cannot delete someone else's design (ACL-01).
	 */
	public function test_other_author_cannot_delete_foreign_design(): void {
		$owner = self::factory()->user->create( [ 'role' => 'author' ] );
		$other = self::factory()->user->create( [ 'role' => 'author' ] );
		$id    = $this->make_design( [ 'author' => $owner ] );

		wp_set_current_user( $other );
		$res = $this->request( 'DELETE', '/designs/' . $id );

		$this->assertSame( 403, $res->get_status() );
		$this->assertInstanceOf( WP_Post::class, get_post( $id ) );
	}

	/**
	 * An editor (delete_others_posts) may delete another user's design.
	 */
	public function test_editor_can_delete_foreign_design(): void {
		$owner  = self::factory()->user->create( [ 'role' => 'author' ] );
		$editor = self::factory()->user->create( [ 'role' => 'editor' ] );
		$id     = $this->make_design( [ 'author' => $owner ] );

		wp_set_current_user( $editor );
		$res = $this->request( 'DELETE', '/designs/' . $id );

		$this->assertSame( 200, $res->get_status() );
		$this->assertNull( get_post( $id ) );
	}

	/**
	 * format_design exposes a canDelete flag matching the current user's rights.
	 */
	public function test_can_delete_flag_reflects_capability(): void {
		$owner = self::factory()->user->create( [ 'role' => 'author' ] );
		$other = self::factory()->user->create( [ 'role' => 'author' ] );
		$id    = $this->make_design( [ 'author' => $owner ] );

		wp_set_current_user( $owner );
		$this->assertTrue( $this->request( 'GET', '/designs/' . $id )->get_data()['canDelete'] );

		wp_set_current_user( $other );
		$this->assertFalse( $this->request( 'GET', '/designs/' . $id )->get_data()['canDelete'] );
	}
}
