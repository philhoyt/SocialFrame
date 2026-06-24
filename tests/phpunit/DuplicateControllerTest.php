<?php
/**
 * Tests for the Duplicate REST controller.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

/**
 * Covers design/template duplication semantics.
 */
class DuplicateControllerTest extends RestTestCase {

	/**
	 * Use an editor for all duplicate requests.
	 */
	public function set_up(): void {
		parent::set_up();
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
	}

	/**
	 * Duplicating copies format and Fabric JSON, appends "(Copy)", and resets
	 * the export reference.
	 */
	public function test_duplicate_copies_meta_as_new_design(): void {
		$source = $this->make_design(
			[
				'title'       => 'Original',
				'format'      => 'twitter-post',
				'fabric_json' => '{"objects":[1]}',
			]
		);
		update_post_meta( $source, 'socialframe_image_id', 999 );

		$res = $this->request( 'POST', '/designs/' . $source . '/duplicate' );

		$this->assertSame( 201, $res->get_status() );
		$new = $res->get_data();
		$this->assertNotSame( $source, $new['id'] );
		$this->assertSame( 'Original (Copy)', $new['title'] );
		$this->assertSame( 'twitter-post', get_post_meta( $new['id'], 'socialframe_format', true ) );
		$this->assertSame( '{"objects":[1]}', get_post_meta( $new['id'], 'socialframe_fabric_json', true ) );
		$this->assertSame( 'design', get_post_meta( $new['id'], 'socialframe_type', true ) );
		// The export reference must not carry over.
		$this->assertSame( 0, (int) get_post_meta( $new['id'], 'socialframe_image_id', true ) );
	}

	/**
	 * Duplicating a template yields a design, not another template.
	 */
	public function test_duplicate_template_becomes_design(): void {
		$template = $this->make_design( [ 'type' => 'template' ] );

		$res = $this->request( 'POST', '/designs/' . $template . '/duplicate' );

		$this->assertSame( 201, $res->get_status() );
		$this->assertSame( 'design', get_post_meta( $res->get_data()['id'], 'socialframe_type', true ) );
	}

	/**
	 * Duplicating a non-graphic post returns 404.
	 */
	public function test_duplicate_404_for_non_graphic(): void {
		$post_id = self::factory()->post->create();
		$res     = $this->request( 'POST', '/designs/' . $post_id . '/duplicate' );
		$this->assertSame( 404, $res->get_status() );
	}
}
