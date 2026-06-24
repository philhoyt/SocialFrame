<?php
/**
 * Tests for GraphicMeta sanitize callbacks.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

use SocialFrame\Meta\GraphicMeta;

/**
 * Covers the Fabric-JSON sanitize round-trip and dimension clamping.
 */
class GraphicMetaTest extends WP_UnitTestCase {

	/**
	 * The meta instance under test.
	 *
	 * @var GraphicMeta
	 */
	private GraphicMeta $meta;

	/**
	 * Instantiate the meta handler.
	 */
	public function set_up(): void {
		parent::set_up();
		$this->meta = new GraphicMeta();
	}

	/**
	 * Valid JSON should survive the sanitize round-trip as equivalent data.
	 */
	public function test_sanitize_fabric_json_round_trips_valid_json(): void {
		$input  = '{"version":"6.0.0","objects":[{"type":"textbox","text":"hi"}]}';
		$output = $this->meta->sanitize_fabric_json( $input );

		$this->assertSame( json_decode( $input, true ), json_decode( $output, true ) );
	}

	/**
	 * Empty input returns an empty string.
	 */
	public function test_sanitize_fabric_json_empty(): void {
		$this->assertSame( '', $this->meta->sanitize_fabric_json( '' ) );
	}

	/**
	 * Non-JSON or non-array JSON is rejected as an empty string.
	 */
	public function test_sanitize_fabric_json_rejects_invalid(): void {
		$this->assertSame( '', $this->meta->sanitize_fabric_json( 'not json' ) );
		$this->assertSame( '', $this->meta->sanitize_fabric_json( '"a scalar string"' ) );
		$this->assertSame( '', $this->meta->sanitize_fabric_json( '42' ) );
	}

	/**
	 * Multi-line text escape sequences must be preserved (no double-unslash).
	 */
	public function test_sanitize_fabric_json_preserves_newline_escapes(): void {
		$input   = '{"objects":[{"text":"line1\nline2"}]}';
		$output  = $this->meta->sanitize_fabric_json( $input );
		$decoded = json_decode( $output, true );

		$this->assertSame( "line1\nline2", $decoded['objects'][0]['text'] );
	}

	/**
	 * Zero is preserved (means "preset format, no custom dimension").
	 */
	public function test_sanitize_dimension_preserves_zero(): void {
		$this->assertSame( 0, $this->meta->sanitize_dimension( 0 ) );
		$this->assertSame( 0, $this->meta->sanitize_dimension( '0' ) );
	}

	/**
	 * Non-zero values are clamped into [MIN_DIMENSION, MAX_DIMENSION].
	 */
	public function test_sanitize_dimension_clamps_range(): void {
		$this->assertSame( GraphicMeta::MIN_DIMENSION, $this->meta->sanitize_dimension( 1 ) );
		$this->assertSame( GraphicMeta::MAX_DIMENSION, $this->meta->sanitize_dimension( 999999 ) );
		$this->assertSame( 1200, $this->meta->sanitize_dimension( 1200 ) );
	}

	/**
	 * The registered sanitize_callback should apply on update_post_meta.
	 */
	public function test_dimension_meta_clamps_through_registration(): void {
		$post_id = self::factory()->post->create( [ 'post_type' => 'socialframe_graphic' ] );

		update_post_meta( $post_id, 'socialframe_width', 999999 );
		$this->assertSame( GraphicMeta::MAX_DIMENSION, (int) get_post_meta( $post_id, 'socialframe_width', true ) );
	}
}
