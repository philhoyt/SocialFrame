<?php
/**
 * Tests for template field collection and filling.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

use SocialFrame\Fields\FieldFiller;

/**
 * Covers FieldFiller::collect(), fill() and the image cover crop.
 */
class FieldFillerTest extends RestTestCase {

	/**
	 * Fill as an editor so attachments are readable.
	 */
	public function set_up(): void {
		parent::set_up();
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
	}

	/**
	 * A canvas shaped like the editor's getJSON() output (Fabric 6 class names).
	 *
	 * @return array<string, mixed>
	 */
	private function canvas(): array {
		return [
			'version' => '6.9.1',
			'objects' => [
				[
					'type'   => 'Rect',
					'id'     => 'artboard',
					'width'  => 1080,
					'height' => 1080,
				],
				[
					'type'      => 'Textbox',
					'text'      => 'Headline',
					'fieldName' => 'post.title',
					'styles'    => [
						[
							'start' => 0,
							'end'   => 4,
							'style' => [ 'fill' => '#ff0000' ],
						],
					],
				],
				[
					'type'      => 'Rect',
					'fieldName' => 'post.title',
				],
				[
					'type'    => 'Group',
					'objects' => [
						[
							'type'      => 'IText',
							'text'      => 'Grouped',
							'fieldName' => 'post.title',
						],
						[
							'type'      => 'Image',
							'src'       => 'https://example.org/old.png',
							'width'     => 800,
							'height'    => 600,
							'scaleX'    => 0.5,
							'scaleY'    => 0.5,
							'cropX'     => 0,
							'cropY'     => 0,
							'left'      => 40,
							'top'       => 60,
							'fieldName' => 'post.featured_image',
						],
					],
				],
			],
		];
	}

	/**
	 * Collect reports each name once, from nested groups, ignoring shapes.
	 */
	public function test_collect_reports_each_name_once_including_groups(): void {
		$fields = FieldFiller::collect( $this->canvas() );

		$this->assertSame(
			[
				[
					'name'  => 'post.title',
					'type'  => 'text',
					'value' => 'Headline',
				],
				[
					'name'  => 'post.featured_image',
					'type'  => 'image',
					'value' => 'https://example.org/old.png',
				],
			],
			$fields
		);
	}

	/**
	 * Invalid names are not fields.
	 */
	public function test_invalid_field_names_are_ignored(): void {
		$canvas = [
			'objects' => [
				[
					'type'      => 'Textbox',
					'text'      => 'a',
					'fieldName' => 'has space',
				],
				[
					'type'      => 'Textbox',
					'text'      => 'b',
					'fieldName' => str_repeat( 'x', 101 ),
				],
				[
					'type'      => 'Textbox',
					'text'      => 'c',
					'fieldName' => '   ',
				],
			],
		];

		$this->assertSame( [], FieldFiller::collect( $canvas ) );
		$this->assertFalse( FieldFiller::has_fields( $canvas ) );
	}

	/**
	 * Every text object with the name is filled and loses its stale styles.
	 */
	public function test_fill_replaces_every_text_match_and_clears_styles(): void {
		$result = FieldFiller::fill( $this->canvas(), [ 'post.title' => 'New title' ] );
		$objs   = $result['canvas']['objects'];

		$this->assertSame( 'New title', $objs[1]['text'] );
		$this->assertSame( [], $objs[1]['styles'] );
		$this->assertSame( 'New title', $objs[3]['objects'][0]['text'] );
		$this->assertArrayNotHasKey( 'text', $objs[2], 'A shape with a field name is not filled.' );
		$this->assertSame( [ 'post.title' ], $result['filled'] );
		$this->assertSame( [], $result['unmatched'] );
	}

	/**
	 * Names that match nothing are reported, not errors.
	 */
	public function test_unknown_names_are_unmatched(): void {
		$result = FieldFiller::fill( $this->canvas(), [ 'nope' => 'x' ] );

		$this->assertSame( [], $result['filled'] );
		$this->assertSame( [ 'nope' ], $result['unmatched'] );
		$this->assertSame( $this->canvas(), $result['canvas'] );
	}

	/**
	 * A landscape image into a 400x300 box: height fills, sides are cropped.
	 */
	public function test_image_cover_crops_wide_image_into_box(): void {
		$attachment = $this->make_image_attachment( 1600, 800 );

		$result = FieldFiller::fill( $this->canvas(), [ 'post.featured_image' => $attachment ] );
		$image  = $result['canvas']['objects'][3]['objects'][1];

		// Box is 800*0.5 x 600*0.5 = 400 x 300. Scale = max(400/1600, 300/800) = 0.375.
		$this->assertEqualsWithDelta( 0.375, $image['scaleX'], 1e-9 );
		$this->assertEqualsWithDelta( 0.375, $image['scaleY'], 1e-9 );
		$this->assertEqualsWithDelta( 400, $image['width'] * $image['scaleX'], 1e-6 );
		$this->assertEqualsWithDelta( 300, $image['height'] * $image['scaleY'], 1e-6 );
		$this->assertEqualsWithDelta( ( 1600 - 400 / 0.375 ) / 2, $image['cropX'], 1e-6 );
		$this->assertEqualsWithDelta( 0, $image['cropY'], 1e-6 );
		$this->assertSame( 40, $image['left'] );
		$this->assertSame( 60, $image['top'] );
		$this->assertSame( wp_get_attachment_image_src( $attachment, 'full' )[0], $image['src'] );
		$this->assertSame( [ 'post.featured_image' ], $result['filled'] );
	}

	/**
	 * A one-image canvas whose image sits in a vertical stack with the given box.
	 *
	 * @param mixed $box The image's sfBox.
	 * @return array<string, mixed>
	 */
	private function stacked_canvas( $box ): array {
		return [
			'objects' => [
				[
					'type'        => 'Image',
					'src'         => 'old.png',
					'left'        => 0,
					'top'         => 120,
					'width'       => 1080,
					'height'      => 810,
					'cropX'       => 40,
					'cropY'       => 30,
					'scaleX'      => 1,
					'scaleY'      => 1,
					'fieldName'   => 'photo',
					'sfBox'       => $box,
					'sfStackItem' => [ 'row' => 'r1', 'offset' => 0 ],
				],
			],
		];
	}

	/**
	 * A stacked portrait image is shown whole at the box height, centred.
	 */
	public function test_stacked_portrait_image_is_contained_not_cropped(): void {
		$attachment = $this->make_image_attachment( 2048, 2560 );
		$box        = [
			'left'   => 0,
			'width'  => 1080,
			'height' => 810,
		];

		$image = FieldFiller::fill( $this->stacked_canvas( $box ), [ 'photo' => $attachment ] )['canvas']['objects'][0];

		$this->assertSame( [ 0, 0 ], [ $image['cropX'], $image['cropY'] ] );
		$this->assertEqualsWithDelta( 2048, $image['width'], 1e-9 );
		$this->assertEqualsWithDelta( 2560, $image['height'], 1e-9 );
		$this->assertEqualsWithDelta( 810 / 2560, $image['scaleX'], 1e-9 );
		$this->assertEqualsWithDelta( 648, $image['width'] * $image['scaleX'], 1e-6 );
		$this->assertEqualsWithDelta( 810, $image['height'] * $image['scaleY'], 1e-6 );
		$this->assertEqualsWithDelta( 216, $image['left'], 1e-6 );
		$this->assertSame( 120, $image['top'], 'The browser layout owns the top.' );
		$this->assertSame( $box, $image['sfBox'] );
	}

	/**
	 * A stacked landscape image fills the box width and is shorter than it.
	 */
	public function test_stacked_landscape_image_fills_box_width(): void {
		$attachment = $this->make_image_attachment( 2048, 1152 );
		$canvas     = $this->stacked_canvas(
			[
				'left'   => 40,
				'width'  => 1000,
				'height' => 810,
			]
		);

		$image = FieldFiller::fill( $canvas, [ 'photo' => $attachment ] )['canvas']['objects'][0];

		$this->assertEqualsWithDelta( 1000, $image['width'] * $image['scaleX'], 1e-6 );
		$this->assertEqualsWithDelta( 562.5, $image['height'] * $image['scaleY'], 1e-6 );
		$this->assertEqualsWithDelta( 40, $image['left'], 1e-6 );
	}

	/**
	 * An unusable box falls back to the cover crop, so bad data can't break a fill.
	 */
	public function test_invalid_stack_box_falls_back_to_cover(): void {
		$attachment = $this->make_image_attachment( 2048, 2560 );

		foreach ( [ 'nope', [ 'width' => -5, 'height' => 810 ], [ 'width' => 1e9, 'height' => 810 ], [ 'width' => '1080', 'height' => '810' ] ] as $box ) {
			$image = FieldFiller::fill( $this->stacked_canvas( $box ), [ 'photo' => $attachment ] )['canvas']['objects'][0];

			// Cover keeps the on-canvas box at 1080 x 810 and crops the rest.
			$this->assertEqualsWithDelta( 1080, $image['width'] * $image['scaleX'], 1e-6, wp_json_encode( $box ) );
			$this->assertEqualsWithDelta( 810, $image['height'] * $image['scaleY'], 1e-6, wp_json_encode( $box ) );
			$this->assertGreaterThan( 0, $image['cropY'], wp_json_encode( $box ) );
		}
	}

	/**
	 * A portrait image into a wide box: width fills, top and bottom are cropped.
	 */
	public function test_image_cover_crops_tall_image_into_wide_box(): void {
		$attachment = $this->make_image_attachment( 600, 1200 );
		$canvas     = [
			'objects' => [
				[
					'type'      => 'Image',
					'src'       => 'old.png',
					'width'     => 1000,
					'height'    => 500,
					'scaleX'    => 1,
					'scaleY'    => 1,
					'fieldName' => 'photo',
				],
			],
		];

		$image = FieldFiller::fill( $canvas, [ 'photo' => $attachment ] )['canvas']['objects'][0];

		// Scale = max(1000/600, 500/1200) = 5/3; crop = 600 x 300, centred vertically.
		$this->assertEqualsWithDelta( 1000 / 600, $image['scaleX'], 1e-9 );
		$this->assertEqualsWithDelta( 600, $image['width'], 1e-6 );
		$this->assertEqualsWithDelta( 300, $image['height'], 1e-6 );
		$this->assertEqualsWithDelta( 0, $image['cropX'], 1e-6 );
		$this->assertEqualsWithDelta( 450, $image['cropY'], 1e-6 );
	}

	/**
	 * An image object with no usable box is left alone.
	 */
	public function test_degenerate_geometry_is_left_untouched(): void {
		$attachment = $this->make_image_attachment( 100, 100 );
		$canvas     = [
			'objects' => [
				[
					'type'      => 'Image',
					'src'       => 'old.png',
					'width'     => 0,
					'height'    => 100,
					'fieldName' => 'photo',
				],
			],
		];

		$result = FieldFiller::fill( $canvas, [ 'photo' => $attachment ] );

		$this->assertSame( $canvas, $result['canvas'] );
		$this->assertSame( [ 'photo' ], $result['unmatched'] );
	}

	/**
	 * Non-image, trashed, missing and non-positive IDs are unmatched.
	 */
	public function test_invalid_image_values_are_unmatched(): void {
		$pdf     = self::factory()->attachment->create(
			[
				'post_mime_type' => 'application/pdf',
				'file'           => 'doc.pdf',
			]
		);
		$trashed = $this->make_image_attachment( 100, 100 );
		wp_trash_post( $trashed );

		foreach ( [ $pdf, $trashed, 999999, 0, -5, '12' ] as $value ) {
			$result = FieldFiller::fill( $this->canvas(), [ 'post.featured_image' => $value ] );
			$this->assertSame( [ 'post.featured_image' ], $result['unmatched'], 'Value: ' . var_export( $value, true ) ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_var_export
			$this->assertSame( 'https://example.org/old.png', $result['canvas']['objects'][3]['objects'][1]['src'] );
		}
	}

	/**
	 * An attachment the user cannot read is unmatched.
	 */
	public function test_unreadable_attachment_is_unmatched(): void {
		$private_parent = self::factory()->post->create( [ 'post_status' => 'private' ] );
		$attachment     = $this->make_image_attachment( 100, 100, $private_parent );

		wp_set_current_user( self::factory()->user->create( [ 'role' => 'contributor' ] ) );
		$result = FieldFiller::fill( $this->canvas(), [ 'post.featured_image' => $attachment ] );

		$this->assertSame( [ 'post.featured_image' ], $result['unmatched'] );
	}
}
