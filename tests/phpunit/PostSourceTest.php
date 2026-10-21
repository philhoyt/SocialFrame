<?php
/**
 * Tests for post-derived template field values and the has_fields flag.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

use SocialFrame\Fields\PostSource;

/**
 * Covers PostSource::values_for() and GraphicMeta::sync_has_fields().
 */
class PostSourceTest extends RestTestCase {

	/**
	 * Read posts as an editor.
	 */
	public function set_up(): void {
		parent::set_up();
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
	}

	/**
	 * Every built-in source resolves from the post.
	 */
	public function test_values_for_builtin_sources(): void {
		$author  = self::factory()->user->create( [ 'display_name' => 'Ada Writer' ] );
		$post_id = self::factory()->post->create(
			[
				'post_title'   => 'Tom &amp; Jerry',
				'post_content' => '<p>Body text</p>',
				'post_excerpt' => 'Short <b>summary</b>',
				'post_author'  => $author,
				'post_date'    => '2026-03-04 10:00:00',
			]
		);
		$thumb   = $this->make_image_attachment( 50, 50, $post_id );
		set_post_thumbnail( $post_id, $thumb );
		wp_set_post_terms( $post_id, [ 'News', 'Events' ], 'post_tag' );
		update_post_meta( $post_id, 'price', '19.99' );
		update_post_meta( $post_id, 'logo', (string) $thumb );

		$values = PostSource::values_for(
			get_post( $post_id ),
			[ 'post.title', 'post.content', 'post.excerpt', 'post.date', 'post.author', 'post.featured_image', 'meta.price', 'meta.logo', 'terms.post_tag', 'free' ]
		);

		$this->assertSame( 'Tom & Jerry', $values['post.title'] );
		$this->assertSame( 'Body text', $values['post.content'] );
		$this->assertSame( 'Short summary', $values['post.excerpt'] );
		$this->assertSame( get_the_date( '', $post_id ), $values['post.date'] );
		$this->assertSame( 'Ada Writer', $values['post.author'] );
		$this->assertSame( $thumb, $values['post.featured_image'] );
		$this->assertSame( '19.99', $values['meta.price'] );
		$this->assertSame( $thumb, $values['meta.logo'] );
		$this->assertStringContainsString( 'News', $values['terms.post_tag'] );
		$this->assertStringContainsString( 'Events', $values['terms.post_tag'] );
		$this->assertArrayNotHasKey( 'free', $values );
	}

	/**
	 * Without a hand-written excerpt, one is trimmed from the content.
	 */
	public function test_excerpt_falls_back_to_trimmed_content(): void {
		$post_id = self::factory()->post->create(
			[
				'post_content' => str_repeat( 'word ', 80 ),
				'post_excerpt' => '',
			]
		);

		$excerpt = PostSource::values_for( get_post( $post_id ), [ 'post.excerpt' ] )['post.excerpt'];

		$this->assertSame( 55, count( explode( ' ', trim( $excerpt, '…' ) ) ) );
		$this->assertStringEndsWith( '…', $excerpt );
	}

	/**
	 * Names the design does not use are never computed.
	 */
	public function test_title_only_does_not_render_content(): void {
		$post_id = self::factory()->post->create( [ 'post_content' => 'Body' ] );
		$before  = did_filter( 'the_content' );

		PostSource::values_for( get_post( $post_id ), [ 'post.title' ] );

		$this->assertSame( $before, did_filter( 'the_content' ) );
	}

	/**
	 * Rendering content sets up the source post, then restores the global.
	 */
	public function test_content_renders_with_source_post_and_restores_global(): void {
		$source          = self::factory()->post->create( [ 'post_content' => 'Body' ] );
		$original        = get_post( self::factory()->post->create() );
		$GLOBALS['post'] = $original; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited

		$seen   = null;
		$filter = static function ( $content ) use ( &$seen ) {
			$seen = get_the_ID();
			return $content;
		};
		add_filter( 'the_content', $filter );
		PostSource::values_for( get_post( $source ), [ 'post.content' ] );
		remove_filter( 'the_content', $filter );

		$this->assertSame( $source, $seen );
		$this->assertSame( $original, $GLOBALS['post'] );
	}

	/**
	 * Missing values are left out; unresolvable image URLs are skipped.
	 */
	public function test_missing_and_external_values_are_left_out(): void {
		$post_id = self::factory()->post->create();
		update_post_meta( $post_id, 'hero', 'https://elsewhere.example/hero.jpg' );

		$values = PostSource::values_for( get_post( $post_id ), [ 'post.featured_image', 'meta.hero', 'meta.absent', 'terms.not_a_taxonomy' ] );

		$this->assertSame( [], $values );
	}

	/**
	 * The socialframe_post_field_values filter can add custom names.
	 */
	public function test_values_filter_can_add_names(): void {
		$post_id = self::factory()->post->create();
		$filter  = static function ( $values ) {
			$values['custom'] = 'From filter';
			return $values;
		};
		add_filter( 'socialframe_post_field_values', $filter );
		$values = PostSource::values_for( get_post( $post_id ), [ 'custom' ] );
		remove_filter( 'socialframe_post_field_values', $filter );

		$this->assertSame( 'From filter', $values['custom'] );
	}

	/**
	 * Unreadable posts are rejected; editable password posts are allowed.
	 */
	public function test_can_read_rules(): void {
		$this->assertTrue( PostSource::can_read( get_post( self::factory()->post->create() ) ) );
		$this->assertFalse( PostSource::can_read( get_post( self::factory()->post->create( [ 'post_status' => 'draft' ] ) ) ) );
		$this->assertFalse( PostSource::can_read( get_post( $this->make_design() ) ) );

		$protected = get_post( self::factory()->post->create( [ 'post_password' => 'secret' ] ) );
		$this->assertTrue( PostSource::can_read( $protected ), 'An editor can edit it, so it is readable.' );

		wp_set_current_user( self::factory()->user->create( [ 'role' => 'contributor' ] ) );
		$this->assertFalse( PostSource::can_read( $protected ) );
	}

	/**
	 * The has_fields flag follows every Fabric JSON write.
	 */
	public function test_has_fields_flag_follows_fabric_json(): void {
		$with    = wp_json_encode(
			[
				'objects' => [
					[
						'type'      => 'Textbox',
						'text'      => 'x',
						'fieldName' => 'post.title',
					],
				],
			]
		);
		$without = wp_json_encode( [ 'objects' => [ [ 'type' => 'Textbox' ] ] ] );

		$design = $this->make_design( [ 'fabric_json' => $with ] );
		$this->assertSame( '1', get_post_meta( $design, 'socialframe_has_fields', true ) );

		update_post_meta( $design, 'socialframe_fabric_json', wp_slash( $without ) );
		$this->assertSame( '', get_post_meta( $design, 'socialframe_has_fields', true ) );

		update_post_meta( $design, 'socialframe_fabric_json', wp_slash( $with ) );
		delete_post_meta( $design, 'socialframe_fabric_json' );
		$this->assertSame( '', get_post_meta( $design, 'socialframe_has_fields', true ) );
	}

	/**
	 * A role that edits only a custom type may generate for that type and
	 * its own posts, without core edit_posts.
	 */
	public function test_can_generate_with_post_type_caps(): void {
		$problem_author = $this->make_problem_author();
		$own            = get_post(
			self::factory()->post->create(
				[
					'post_type'   => 'problem',
					'post_author' => $problem_author,
				]
			)
		);
		$others         = get_post(
			self::factory()->post->create(
				[
					'post_type'   => 'problem',
					'post_author' => self::factory()->user->create( [ 'role' => 'author' ] ),
				]
			)
		);
		$blog_post      = get_post( self::factory()->post->create( [ 'post_author' => $problem_author ] ) );

		wp_set_current_user( $problem_author );

		$this->assertFalse( current_user_can( 'edit_posts' ) );
		$this->assertTrue( PostSource::can_generate_for_type( 'problem' ) );
		$this->assertTrue( PostSource::can_generate_for_post( $own ) );
		$this->assertFalse( PostSource::can_generate_for_post( $others ) );
		$this->assertFalse( PostSource::can_generate_for_type( 'post' ) );
		$this->assertFalse( PostSource::can_generate_for_post( $blog_post ) );
		$this->assertFalse( PostSource::can_generate_for_type( 'no_such_type' ) );
	}

	/**
	 * Users without upload_files never generate, even for posts they edit.
	 */
	public function test_cannot_generate_without_upload_files(): void {
		$contributor = self::factory()->user->create( [ 'role' => 'contributor' ] );
		$draft       = get_post(
			self::factory()->post->create(
				[
					'post_author' => $contributor,
					'post_status' => 'draft',
				]
			)
		);

		wp_set_current_user( $contributor );

		$this->assertFalse( PostSource::can_generate_for_type( 'post' ) );
		$this->assertFalse( PostSource::can_generate_for_post( $draft ) );
	}

	/**
	 * The socialframe_can_generate filter narrows both checks.
	 */
	public function test_can_generate_filter_narrows(): void {
		$post = get_post( self::factory()->post->create() );
		$this->assertTrue( PostSource::can_generate_for_type( 'post' ) );

		$seen = [];
		add_filter(
			'socialframe_can_generate',
			function ( bool $can, string $post_type, int $post_id ) use ( &$seen ): bool {
				$seen[] = [ $post_type, $post_id ];
				return false;
			},
			10,
			3
		);

		$this->assertFalse( PostSource::can_generate_for_type( 'post' ) );
		$this->assertFalse( PostSource::can_generate_for_post( $post ) );
		$this->assertSame( [ [ 'post', 0 ], [ 'post', $post->ID ] ], $seen );
	}
}
