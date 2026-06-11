<?php
/**
 * Post meta registration for SocialFrame graphics.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

namespace SocialFrame\Meta;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}


/**
 * Registers post meta for the socialframe_graphic post type.
 */
class GraphicMeta {

	/**
	 * Minimum allowed custom canvas dimension, in pixels.
	 */
	const MIN_DIMENSION = 100;

	/**
	 * Maximum allowed custom canvas dimension, in pixels.
	 */
	const MAX_DIMENSION = 5000;

	/**
	 * Hook into WordPress to register post meta.
	 */
	public function register(): void {
		add_action( 'init', [ $this, 'register_meta' ] );
	}

	/**
	 * Register all meta keys for socialframe_graphic.
	 */
	public function register_meta(): void {
		$allowed_formats   = array_keys( socialframe_get_formats() );
		$allowed_formats[] = 'custom';

		register_post_meta(
			'socialframe_graphic',
			'socialframe_fabric_json',
			[
				'type'              => 'string',
				'description'       => 'Fabric.js canvas state as JSON.',
				'single'            => true,
				'default'           => '',
				'show_in_rest'      => false,
				'sanitize_callback' => [ $this, 'sanitize_fabric_json' ],
			]
		);

		register_post_meta(
			'socialframe_graphic',
			'socialframe_format',
			[
				'type'              => 'string',
				'description'       => 'Social media format key.',
				'single'            => true,
				'default'           => '',
				'show_in_rest'      => false,
				'sanitize_callback' => function ( string $value ) use ( $allowed_formats ): string {
					return in_array( $value, $allowed_formats, true ) ? $value : '';
				},
			]
		);

		register_post_meta(
			'socialframe_graphic',
			'socialframe_width',
			[
				'type'              => 'integer',
				'description'       => 'Custom canvas width in pixels (0 for preset formats).',
				'single'            => true,
				'default'           => 0,
				'show_in_rest'      => false,
				'sanitize_callback' => [ $this, 'sanitize_dimension' ],
			]
		);

		register_post_meta(
			'socialframe_graphic',
			'socialframe_height',
			[
				'type'              => 'integer',
				'description'       => 'Custom canvas height in pixels (0 for preset formats).',
				'single'            => true,
				'default'           => 0,
				'show_in_rest'      => false,
				'sanitize_callback' => [ $this, 'sanitize_dimension' ],
			]
		);

		register_post_meta(
			'socialframe_graphic',
			'socialframe_type',
			[
				'type'              => 'string',
				'description'       => 'Whether this is a design or template.',
				'single'            => true,
				'default'           => 'design',
				'show_in_rest'      => false,
				'sanitize_callback' => function ( string $value ): string {
					return in_array( $value, [ 'design', 'template' ], true ) ? $value : 'design';
				},
			]
		);

		register_post_meta(
			'socialframe_graphic',
			'socialframe_image_id',
			[
				'type'              => 'integer',
				'description'       => 'Attachment ID of the last exported PNG.',
				'single'            => true,
				'default'           => 0,
				'show_in_rest'      => false,
				'sanitize_callback' => 'absint',
			]
		);

		register_post_meta(
			'socialframe_graphic',
			'socialframe_preview_path',
			[
				'type'              => 'string',
				'description'       => 'Relative path (from uploads basedir) of the auto-generated preview PNG.',
				'single'            => true,
				'default'           => '',
				'show_in_rest'      => false,
				'sanitize_callback' => 'sanitize_text_field',
			]
		);
	}

	/**
	 * Normalizes Fabric JSON to prevent slashing issues on round-trips.
	 *
	 * @param string $value Raw JSON value.
	 * @return string Normalized JSON, or empty string if invalid.
	 */
	public function sanitize_fabric_json( string $value ): string {
		if ( empty( $value ) ) {
			return '';
		}
		// WordPress has already called wp_unslash() before invoking this
		// sanitize_callback, so do NOT call it again — a second unslash would
		// strip the backslash from JSON escape sequences like \n, corrupting
		// multi-line text into a bare "n".
		$decoded = json_decode( $value, true );
		if ( ! is_array( $decoded ) ) {
			return '';
		}
		return wp_json_encode( $decoded );
	}

	/**
	 * Clamp a custom canvas dimension to the allowed range.
	 *
	 * Zero is preserved to mean "no custom dimension" (preset formats). Any
	 * non-zero value is clamped to [MIN_DIMENSION, MAX_DIMENSION].
	 *
	 * @param mixed $value Raw dimension value.
	 * @return int Sanitized pixel value.
	 */
	public function sanitize_dimension( $value ): int {
		$value = absint( $value );
		if ( 0 === $value ) {
			return 0;
		}
		return max( self::MIN_DIMENSION, min( self::MAX_DIMENSION, $value ) );
	}
}
