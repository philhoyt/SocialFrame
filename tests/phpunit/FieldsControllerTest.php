<?php
/**
 * Tests for the template fields REST endpoints.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

/**
 * Covers GET /designs/:id/fields, POST /designs/:id/fill and GET /designs?has_fields.
 */
class FieldsControllerTest extends RestTestCase {

	/**
	 * Editor user ID.
	 *
	 * @var int
	 */
	private int $editor;

	/**
	 * Act as an editor by default.
	 */
	public function set_up(): void {
		parent::set_up();
		$this->editor = self::factory()->user->create( [ 'role' => 'editor' ] );
		wp_set_current_user( $this->editor );
	}

	/**
	 * Canvas JSON with a title text field and a featured-image field.
	 */
	private function template_json(): string {
		return (string) wp_json_encode(
			[
				'version' => '6.9.1',
				'objects' => [
					[
						'type'      => 'Textbox',
						'text'      => "Line one\nLine \"two\"",
						'fieldName' => 'post.title',
					],
					[
						'type'      => 'Image',
						'src'       => 'https://example.org/old.png',
						'width'     => 400,
						'height'    => 400,
						'scaleX'    => 1,
						'scaleY'    => 1,
						'fieldName' => 'post.featured_image',
					],
				],
			]
		);
	}

	/**
	 * Number of socialframe_graphic posts.
	 */
	private function graphic_count(): int {
		return count(
			get_posts(
				[
					'post_type'   => 'socialframe_graphic',
					'post_status' => 'any',
					'numberposts' => -1,
					'fields'      => 'ids',
				]
			)
		);
	}

	/**
	 * The fields endpoint lists the design's fields.
	 */
	public function test_get_fields_lists_fields(): void {
		$design = $this->make_design( [ 'fabric_json' => $this->template_json() ] );

		$response = $this->request( 'GET', "/designs/{$design}/fields" );

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( [ 'post.title', 'post.featured_image' ], array_column( $response->get_data(), 'name' ) );
		$this->assertSame( [ 'text', 'image' ], array_column( $response->get_data(), 'type' ) );
	}

	/**
	 * Logged-out users and subscribers are refused.
	 */
	public function test_requires_edit_posts(): void {
		$design = $this->make_design( [ 'fabric_json' => $this->template_json() ] );

		wp_set_current_user( 0 );
		$this->assertSame( 401, $this->request( 'GET', "/designs/{$design}/fields" )->get_status() );
		$this->assertSame( 401, $this->request( 'POST', "/designs/{$design}/fill", [ 'values' => [ 'a' => 'b' ] ] )->get_status() );

		wp_set_current_user( self::factory()->user->create( [ 'role' => 'subscriber' ] ) );
		$this->assertSame( 403, $this->request( 'POST', "/designs/{$design}/fill", [ 'values' => [ 'a' => 'b' ] ] )->get_status() );
	}

	/**
	 * A post fill creates a new design and leaves the source untouched.
	 */
	public function test_fill_from_post_creates_new_design(): void {
		$json   = $this->template_json();
		$design = $this->make_design(
			[
				'fabric_json' => $json,
				'type'        => 'template',
				'title'       => 'Promo',
			]
		);
		$before = get_post_meta( $design, 'socialframe_fabric_json', true );
		$post   = self::factory()->post->create( [ 'post_title' => 'Spring Sale' ] );
		$thumb  = $this->make_image_attachment( 800, 400, $post );
		set_post_thumbnail( $post, $thumb );

		$response = $this->request( 'POST', "/designs/{$design}/fill", [ 'post_id' => $post ] );
		$data     = $response->get_data();

		$this->assertSame( 201, $response->get_status() );
		$this->assertSame( [ 'post.title', 'post.featured_image' ], $data['filled'] );
		$this->assertSame( 'Promo: Spring Sale', $data['design']['title'] );
		$this->assertSame( 'design', $data['design']['type'] );
		$this->assertNotSame( $design, $data['design']['id'] );

		$copy = json_decode( get_post_meta( $data['design']['id'], 'socialframe_fabric_json', true ), true );
		$this->assertSame( 'Spring Sale', $copy['objects'][0]['text'] );
		$this->assertSame( wp_get_attachment_image_src( $thumb, 'full' )[0], $copy['objects'][1]['src'] );
		$this->assertEqualsWithDelta( 400, $copy['objects'][1]['width'] * $copy['objects'][1]['scaleX'], 1e-6 );
		$this->assertSame( '1', get_post_meta( $data['design']['id'], 'socialframe_has_fields', true ) );

		$this->assertSame( $before, get_post_meta( $design, 'socialframe_fabric_json', true ), 'Source design is unchanged.' );
	}

	/**
	 * Explicit values win over post values; unknown names are reported.
	 */
	public function test_values_override_post_and_report_unmatched(): void {
		$design = $this->make_design( [ 'fabric_json' => $this->template_json() ] );
		$post   = self::factory()->post->create( [ 'post_title' => 'From post' ] );

		$response = $this->request(
			'POST',
			"/designs/{$design}/fill",
			[
				'post_id' => $post,
				'values'  => [
					'post.title' => 'Override',
					'nope'       => 'x',
				],
			]
		);
		$data     = $response->get_data();
		$copy     = json_decode( get_post_meta( $data['design']['id'], 'socialframe_fabric_json', true ), true );

		$this->assertSame( 'Override', $copy['objects'][0]['text'] );
		$this->assertSame( [ 'nope' ], $data['unmatched'] );
	}

	/**
	 * Bad image values are unmatched and the original image is kept.
	 */
	public function test_bad_image_values_are_unmatched(): void {
		$design = $this->make_design( [ 'fabric_json' => $this->template_json() ] );

		foreach ( [ 0, -3, 999999 ] as $value ) {
			$data = $this->request( 'POST', "/designs/{$design}/fill", [ 'values' => [ 'post.featured_image' => $value ] ] )->get_data();
			$copy = json_decode( get_post_meta( $data['design']['id'], 'socialframe_fabric_json', true ), true );

			$this->assertSame( [ 'post.featured_image' ], $data['unmatched'] );
			$this->assertSame( 'https://example.org/old.png', $copy['objects'][1]['src'] );
		}
	}

	/**
	 * Unreadable source posts are 404 and nothing is created.
	 */
	public function test_unreadable_posts_are_404_and_create_nothing(): void {
		$design = $this->make_design( [ 'fabric_json' => $this->template_json() ] );
		$posts  = [
			self::factory()->post->create( [ 'post_status' => 'draft' ] ),
			self::factory()->post->create(
				[
					'post_status' => 'private',
					'post_author' => self::factory()->user->create( [ 'role' => 'administrator' ] ),
				]
			),
			$design,
		];

		wp_set_current_user( self::factory()->user->create( [ 'role' => 'author' ] ) );
		$posts[] = self::factory()->post->create(
			[
				'post_password' => 'secret',
				'post_author'   => $this->editor,
			]
		);

		$count = $this->graphic_count();
		foreach ( $posts as $post ) {
			$response = $this->request( 'POST', "/designs/{$design}/fill", [ 'post_id' => $post ] );
			$this->assertSame( 404, $response->get_status(), "Post {$post}" );
		}
		$this->assertSame( $count, $this->graphic_count() );
	}

	/**
	 * Bad requests are rejected before anything is created.
	 */
	public function test_bad_requests_create_nothing(): void {
		$design = $this->make_design( [ 'fabric_json' => $this->template_json() ] );
		$empty  = $this->make_design();
		$count  = $this->graphic_count();

		$this->assertSame( 400, $this->request( 'POST', "/designs/{$design}/fill" )->get_status() );
		$this->assertSame( 400, $this->request( 'POST', "/designs/{$empty}/fill", [ 'values' => [ 'a' => 'b' ] ] )->get_status() );
		$this->assertSame( 404, $this->request( 'POST', '/designs/999999/fill', [ 'values' => [ 'a' => 'b' ] ] )->get_status() );
		$this->assertSame( 400, $this->request( 'POST', "/designs/{$design}/fill", [ 'values' => [ 'a' => [ 'nested' ] ] ] )->get_status() );
		$this->assertSame( 400, $this->request( 'POST', "/designs/{$design}/fill", [ 'values' => [ 'a' => true ] ] )->get_status() );
		$this->assertSame( $count, $this->graphic_count() );
	}

	/**
	 * A title-only template never renders the post content.
	 */
	public function test_title_only_fill_skips_content(): void {
		$design = $this->make_design(
			[
				'fabric_json' => (string) wp_json_encode(
					[
						'objects' => [
							[
								'type'      => 'Textbox',
								'text'      => 'x',
								'fieldName' => 'post.title',
							],
						],
					]
				),
			]
		);
		$post   = self::factory()->post->create( [ 'post_content' => 'Body' ] );
		$before = did_filter( 'the_content' );

		$this->request( 'POST', "/designs/{$design}/fill", [ 'post_id' => $post ] );

		$this->assertSame( $before, did_filter( 'the_content' ) );
	}

	/**
	 * The listing filters on has_fields and returns both types with type=any.
	 */
	public function test_listing_filters_has_fields(): void {
		$with_design   = $this->make_design( [ 'fabric_json' => $this->template_json() ] );
		$with_template = $this->make_design(
			[
				'fabric_json' => $this->template_json(),
				'type'        => 'template',
			]
		);
		$this->make_design( [ 'fabric_json' => '{"objects":[]}' ] );

		$ids = array_column( $this->request( 'GET', '/designs', [ 'has_fields' => true ] )->get_data(), 'id' );
		$this->assertSame( [ $with_design ], $ids );

		$ids = array_column(
			$this->request(
				'GET',
				'/designs',
				[
					'has_fields' => true,
					'type'       => 'any',
				]
			)->get_data(),
			'id'
		);
		sort( $ids );
		$this->assertSame( [ $with_design, $with_template ], $ids );

		$this->assertCount( 2, $this->request( 'GET', '/designs' )->get_data(), 'Default listing is unchanged: designs only.' );
	}
}
