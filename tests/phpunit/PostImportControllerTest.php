<?php
/**
 * Tests for the post-import REST controller (INF-01 meta exposure + filter).
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

/**
 * Covers meta exposure rules, the new filter hook, and search behavior.
 */
class PostImportControllerTest extends RestTestCase {

	/**
	 * Use an editor for all post-import requests.
	 */
	public function set_up(): void {
		parent::set_up();
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
	}

	/**
	 * Public meta is exposed; protected (underscore) meta is never returned.
	 */
	public function test_get_post_data_exposes_public_meta_only(): void {
		$post_id = self::factory()->post->create( [ 'post_status' => 'publish' ] );
		update_post_meta( $post_id, 'subtitle', 'Hello world' );
		update_post_meta( $post_id, '_secret', 'do not leak' );

		$meta = $this->request( 'GET', '/post-import/' . $post_id )->get_data()['meta'];

		$this->assertArrayHasKey( 'subtitle', $meta );
		$this->assertSame( 'Hello world', $meta['subtitle']['value'] );
		$this->assertArrayNotHasKey( '_secret', $meta );
	}

	/**
	 * The socialframe_import_post_meta filter can strip exposed keys (INF-01).
	 */
	public function test_import_meta_filter_can_remove_keys(): void {
		$post_id = self::factory()->post->create( [ 'post_status' => 'publish' ] );
		update_post_meta( $post_id, 'subtitle', 'Hello world' );

		$filter = static function ( $meta ) {
			unset( $meta['subtitle'] );
			return $meta;
		};
		add_filter( 'socialframe_import_post_meta', $filter );

		$meta = $this->request( 'GET', '/post-import/' . $post_id )->get_data()['meta'];
		remove_filter( 'socialframe_import_post_meta', $filter );

		$this->assertArrayNotHasKey( 'subtitle', $meta );
	}

	/**
	 * A non-published post is not importable.
	 */
	public function test_get_post_data_404_for_draft(): void {
		$post_id = self::factory()->post->create( [ 'post_status' => 'draft' ] );
		$res     = $this->request( 'GET', '/post-import/' . $post_id );
		$this->assertSame( 404, $res->get_status() );
	}

	/**
	 * Search returns published posts and excludes the plugin's own post type.
	 */
	public function test_search_excludes_own_post_type(): void {
		self::factory()->post->create(
			[
				'post_status' => 'publish',
				'post_title'  => 'Findable Article',
			]
		);
		$this->make_design( [ 'title' => 'Findable Article' ] );

		$results = $this->request( 'GET', '/post-import', [ 'search' => 'Findable' ] )->get_data();

		$types = wp_list_pluck( $results, 'post_type' );
		$this->assertContains( 'post', $types );
		$this->assertNotContains( 'socialframe_graphic', $types );
	}
}
