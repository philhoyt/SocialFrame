<?php
/**
 * Template fields: named, typed slots on a design.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

namespace SocialFrame\Fields;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reads and fills the fields of a decoded Fabric canvas.
 *
 * Any text or image object carrying a `fieldName` is a fill point: text
 * objects take a string, image objects take an attachment ID. Names are not
 * unique — the same name on several objects fills all of them. Shapes and
 * other object types are never fields, even when they carry a name.
 *
 * Works on the decoded JSON array only; no Fabric or canvas is involved.
 */
class FieldFiller {

	/**
	 * Fabric 6 serializes the class name (`Textbox`, `IText`); live objects
	 * report it lowercased (`textbox`, `i-text`). Compared lowercased.
	 */
	const TEXT_TYPES = [ 'text', 'i-text', 'itext', 'textbox' ];

	/**
	 * Valid field names: letters, digits, `_`, `.` and `-`, up to 100 chars.
	 */
	const NAME_PATTERN = '/^[A-Za-z0-9_.\-]{1,100}$/';

	/**
	 * List the canvas's fields, one entry per distinct name.
	 *
	 * The first object carrying a name decides the reported type and value.
	 *
	 * @param array<string, mixed> $canvas Decoded Fabric canvas.
	 * @return array<int, array{name: string, type: string, value: string|int}>
	 */
	public static function collect( array $canvas ): array {
		$fields = [];

		self::each_object(
			$canvas,
			function ( array &$obj ) use ( &$fields ): void {
				$name = self::field_name_of( $obj );
				$type = $name ? self::field_type_of( $obj ) : null;
				if ( ! $name || ! $type || isset( $fields[ $name ] ) ) {
					return;
				}
				$fields[ $name ] = [
					'name'  => $name,
					'type'  => $type,
					'value' => 'text' === $type ? (string) ( $obj['text'] ?? '' ) : (string) ( $obj['src'] ?? '' ),
				];
			}
		);

		return array_values( $fields );
	}

	/**
	 * Whether the canvas carries at least one field.
	 *
	 * @param array<string, mixed> $canvas Decoded Fabric canvas.
	 */
	public static function has_fields( array $canvas ): bool {
		return [] !== self::collect( $canvas );
	}

	/**
	 * Substitute values into a canvas.
	 *
	 * The object's own type decides what is written: text objects take the
	 * value as a string, image objects take a positive attachment ID and are
	 * re-cropped to cover their original box (or, inside a frame, shown whole
	 * at their intended width). A name is `filled` when at least
	 * one object took its value, otherwise it is `unmatched`.
	 *
	 * @param array<string, mixed>      $canvas Decoded Fabric canvas.
	 * @param array<string, string|int> $values Values keyed by field name.
	 * @return array{canvas: array<string, mixed>, filled: string[], unmatched: string[]}
	 */
	public static function fill( array $canvas, array $values ): array {
		$filled  = [];
		$images  = [];
		$members = self::frame_members( $canvas );

		self::each_object(
			$canvas,
			function ( array &$obj ) use ( $values, $members, &$filled, &$images ): void {
				$name = self::field_name_of( $obj );
				if ( ! $name || ! array_key_exists( $name, $values ) ) {
					return;
				}

				$type  = self::field_type_of( $obj );
				$value = $values[ $name ];

				if ( 'text' === $type && ( is_string( $value ) || is_int( $value ) ) ) {
					$obj['text'] = (string) $value;
					// Per-character styles are indexed by line and character
					// of the old string; they would land on the wrong letters.
					$obj['styles']   = [];
					$filled[ $name ] = true;
					return;
				}

				if ( 'image' === $type && is_int( $value ) && $value > 0 ) {
					if ( ! array_key_exists( $value, $images ) ) {
						$images[ $value ] = self::resolve_image( $value );
					}
					if ( $images[ $value ] && self::fit_image( $obj, $images[ $value ], $members ) ) {
						$filled[ $name ] = true;
					}
				}
			}
		);

		return [
			'canvas'    => $canvas,
			'filled'    => array_keys( $filled ),
			'unmatched' => array_values(
				array_filter(
					array_map( 'strval', array_keys( $values ) ),
					fn( string $name ): bool => ! isset( $filled[ $name ] )
				)
			),
		];
	}

	/**
	 * Ids of the layers inside a frame, from every frame's `children` list.
	 *
	 * The parent's list is the only record of membership (an `sfItem` alone
	 * does not count), the same rule as the browser layout.
	 *
	 * @param array<string, mixed> $canvas Decoded Fabric canvas.
	 * @return array<string, true>
	 */
	private static function frame_members( array $canvas ): array {
		$members = [];
		foreach ( (array) ( $canvas['objects'] ?? [] ) as $obj ) {
			$children = is_array( $obj ) ? ( $obj['sfFrame']['children'] ?? null ) : null;
			if ( ! is_array( $children ) ) {
				continue;
			}
			foreach ( $children as $id ) {
				if ( is_string( $id ) && '' !== $id ) {
					$members[ $id ] = true;
				}
			}
		}
		return $members;
	}

	/**
	 * Point an image object at a new file, sized for its layout.
	 *
	 * An image inside a frame is shown whole: as wide as its intended width
	 * (`sfItem.w`) allows and no taller than its `maxHeight`. The browser
	 * layout then sizes and places it in the frame. Any other image is cropped
	 * to cover its box.
	 *
	 * @param array<string, mixed>                        $obj     Image object, modified in place.
	 * @param array{url: string, width: int, height: int} $image   The new image.
	 * @param array<string, true>                         $members Ids of frame members.
	 * @return bool False when the object's geometry is unusable.
	 */
	private static function fit_image( array &$obj, array $image, array $members ): bool {
		$box = isset( $obj['id'] ) && is_string( $obj['id'] ) && isset( $members[ $obj['id'] ] )
			? self::item_box( $obj )
			: null;

		return $box ? self::contain_image( $obj, $image, $box ) : self::cover_image( $obj, $image );
	}

	/**
	 * A frame member image's box: its intended width and maximum height.
	 *
	 * Mirrors readItem() in src/shared/frameLayout.js. Falls back to the
	 * current on-canvas width when no intended width is stored; a height of 0
	 * means no limit.
	 *
	 * @param array<string, mixed> $obj Image object.
	 * @return array{left: float, width: float, height: float}|null
	 */
	private static function item_box( array $obj ): ?array {
		$item = $obj['sfItem'] ?? null;
		if ( ! is_array( $item ) ) {
			return null;
		}

		$num = fn( $v ): ?float => ( is_int( $v ) || is_float( $v ) ) && is_finite( (float) $v ) ? (float) $v : null;

		$width = $num( $item['w'] ?? null );
		if ( null === $width || $width <= 0 ) {
			$width = ( $num( $obj['width'] ?? null ) ?? 0.0 ) * ( $num( $obj['scaleX'] ?? 1 ) ?? 1.0 );
		}
		$max  = $num( $item['maxHeight'] ?? 0 ) ?? 0.0;
		$left = $num( $obj['left'] ?? 0 ) ?? 0.0;

		if ( $width <= 0 || $width > 10000 || $max < 0 || $max > 10000 ) {
			return null;
		}

		return [
			'left'   => $left,
			'width'  => $width,
			'height' => $max,
		];
	}

	/**
	 * Show a new file whole inside a box: as wide as the box allows, never
	 * taller (a height of 0 means no limit), centred horizontally, never
	 * cropped. The browser layout positions it.
	 *
	 * Mirrors containInBox() in src/shared/frameLayout.js.
	 *
	 * @param array<string, mixed>                            $obj   Image object, modified in place.
	 * @param array{url: string, width: int, height: int}     $image The new image.
	 * @param array{left: float, width: float, height: float} $box   Maximum box.
	 * @return bool False when the image has no usable size.
	 */
	private static function contain_image( array &$obj, array $image, array $box ): bool {
		$nat_w = (float) $image['width'];
		$nat_h = (float) $image['height'];

		if ( $nat_w <= 0 || $nat_h <= 0 ) {
			return false;
		}

		$scale = $box['height'] > 0
			? min( $box['width'] / $nat_w, $box['height'] / $nat_h )
			: $box['width'] / $nat_w;

		$obj['src']    = $image['url'];
		$obj['width']  = $nat_w;
		$obj['height'] = $nat_h;
		$obj['cropX']  = 0;
		$obj['cropY']  = 0;
		$obj['scaleX'] = $scale;
		$obj['scaleY'] = $scale;
		$obj['left']   = $box['left'] + ( $box['width'] - $nat_w * $scale ) / 2;

		return true;
	}

	/**
	 * Point an image object at a new file, cropped to cover its current box.
	 *
	 * Fabric images draw `width` x `height` source pixels starting at
	 * `cropX`/`cropY`, scaled by `scaleX`/`scaleY`. Keeping the on-canvas box
	 * fixed and centring the crop means a different aspect ratio is trimmed,
	 * never stretched. Position, rotation and flips are left alone.
	 *
	 * @param array<string, mixed>                        $obj   Image object, modified in place.
	 * @param array{url: string, width: int, height: int} $image The new image.
	 * @return bool False when the object's geometry is unusable.
	 */
	private static function cover_image( array &$obj, array $image ): bool {
		$box_w = (float) ( $obj['width'] ?? 0 ) * (float) ( $obj['scaleX'] ?? 1 );
		$box_h = (float) ( $obj['height'] ?? 0 ) * (float) ( $obj['scaleY'] ?? 1 );
		$nat_w = (float) $image['width'];
		$nat_h = (float) $image['height'];

		if ( $box_w <= 0 || $box_h <= 0 || $nat_w <= 0 || $nat_h <= 0 ) {
			return false;
		}

		$scale  = max( $box_w / $nat_w, $box_h / $nat_h );
		$crop_w = $box_w / $scale;
		$crop_h = $box_h / $scale;

		$obj['src']    = $image['url'];
		$obj['width']  = $crop_w;
		$obj['height'] = $crop_h;
		$obj['cropX']  = ( $nat_w - $crop_w ) / 2;
		$obj['cropY']  = ( $nat_h - $crop_h ) / 2;
		$obj['scaleX'] = $scale;
		$obj['scaleY'] = $scale;

		return true;
	}

	/**
	 * Look up a full-size image attachment the current user may read.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return array{url: string, width: int, height: int}|null
	 */
	private static function resolve_image( int $attachment_id ): ?array {
		$attachment = get_post( $attachment_id );
		if (
			! $attachment
			|| 'attachment' !== $attachment->post_type
			|| 'trash' === $attachment->post_status
			|| ! wp_attachment_is_image( $attachment )
			|| ! current_user_can( 'read_post', $attachment_id )
		) {
			return null;
		}

		$src = wp_get_attachment_image_src( $attachment_id, 'full' );
		if ( ! $src || (int) $src[1] <= 0 || (int) $src[2] <= 0 ) {
			return null;
		}

		return [
			'url'    => (string) $src[0],
			'width'  => (int) $src[1],
			'height' => (int) $src[2],
		];
	}

	/**
	 * The field type an object can take, or null when it cannot be a field.
	 *
	 * @param array<string, mixed> $obj Fabric object.
	 */
	private static function field_type_of( array $obj ): ?string {
		$type = strtolower( (string) ( $obj['type'] ?? '' ) );
		if ( in_array( $type, self::TEXT_TYPES, true ) ) {
			return 'text';
		}
		return 'image' === $type ? 'image' : null;
	}

	/**
	 * The object's valid field name, or null.
	 *
	 * @param array<string, mixed> $obj Fabric object.
	 */
	private static function field_name_of( array $obj ): ?string {
		if ( ! isset( $obj['fieldName'] ) || ! is_string( $obj['fieldName'] ) ) {
			return null;
		}
		$name = trim( $obj['fieldName'] );
		return preg_match( self::NAME_PATTERN, $name ) ? $name : null;
	}

	/**
	 * Visit every object in the canvas, descending into groups.
	 *
	 * Breadth-first over a queue of references rather than recursion, so a
	 * deeply nested group cannot exhaust the stack. The visitor receives each
	 * object by reference and may modify it.
	 *
	 * @param array<string, mixed> $canvas Decoded Fabric canvas, modified in place.
	 * @param callable             $visit  Receives each object array by reference.
	 */
	private static function each_object( array &$canvas, callable $visit ): void {
		if ( ! isset( $canvas['objects'] ) || ! is_array( $canvas['objects'] ) ) {
			return;
		}

		$queue = [];
		foreach ( $canvas['objects'] as &$object ) {
			$queue[] = &$object;
		}
		unset( $object );

		$length = count( $queue );
		for ( $i = 0; $i < $length; $i++ ) {
			$obj = &$queue[ $i ];
			if ( is_array( $obj ) ) {
				$visit( $obj );
				if ( isset( $obj['objects'] ) && is_array( $obj['objects'] ) ) {
					foreach ( $obj['objects'] as &$child ) {
						$queue[] = &$child;
						++$length;
					}
					unset( $child );
				}
			}
			unset( $obj );
		}
	}
}
