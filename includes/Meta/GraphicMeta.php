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
	 * Hook into WordPress to register post meta.
	 */
	public function register(): void {
		add_action( 'init', [ $this, 'register_meta' ] );
	}

	/**
	 * Register all meta keys for socialframe_graphic.
	 */
	public function register_meta(): void {
		$allowed_formats = array_keys( socialframe_get_formats() );

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
		$decoded = json_decode( wp_unslash( $value ), true );
		if ( ! is_array( $decoded ) ) {
			return '';
		}
		return wp_json_encode( $decoded );
	}
}
