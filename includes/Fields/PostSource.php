<?php
/**
 * Reads importable content and field values from a WordPress post.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

namespace SocialFrame\Fields;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * One place that decides which posts SocialFrame may read from and how their
 * content is extracted, shared by Post Import and template fills so the two
 * cannot drift apart.
 */
class PostSource {

	/**
	 * Words kept when an excerpt is generated from the content.
	 */
	const EXCERPT_WORDS = 55;

	/**
	 * Public post type slugs that are also visible in REST, minus our own.
	 *
	 * @return string[]
	 */
	public static function public_post_types(): array {
		$types = get_post_types(
			[
				'public'       => true,
				'show_in_rest' => true,
			],
			'names'
		);

		unset( $types['socialframe_graphic'] );

		return array_values( $types );
	}

	/**
	 * Post types a design can be assigned to and generated from.
	 *
	 * @return string[]
	 */
	public static function frame_post_types(): array {
		$public = self::public_post_types();

		/**
		 * Filters the post types designs can be assigned to.
		 *
		 * The result is intersected with the public, REST-visible post types,
		 * so this filter can only narrow the list.
		 *
		 * @param string[] $types Post type slugs.
		 */
		$types = (array) apply_filters( 'socialframe_frame_post_types', $public );

		return array_values( array_intersect( $public, array_map( 'strval', $types ) ) );
	}

	/**
	 * Whether the current user may pull content from this post.
	 *
	 * Only published posts of public, REST-visible types the user can read,
	 * and never password-protected content the user could not otherwise see
	 * (SEC-02).
	 *
	 * @param \WP_Post $post Source post.
	 */
	public static function can_read( \WP_Post $post ): bool {
		return 'publish' === $post->post_status
			&& in_array( $post->post_type, self::public_post_types(), true )
			&& current_user_can( 'read_post', $post->ID )
			&& ( ! post_password_required( $post ) || current_user_can( 'edit_post', $post->ID ) );
	}

	/**
	 * The post title as plain text.
	 *
	 * @param \WP_Post $post Source post.
	 */
	public static function title( \WP_Post $post ): string {
		return html_entity_decode( get_the_title( $post ), ENT_QUOTES, 'UTF-8' );
	}

	/**
	 * The rendered content as plain text.
	 *
	 * The content is rendered with the source post set up as the global post,
	 * so shortcodes and dynamic blocks see the post they belong to.
	 *
	 * @param \WP_Post $post Source post.
	 */
	public static function content( \WP_Post $post ): string {
		if ( '' === $post->post_content ) {
			return '';
		}

		$previous = $GLOBALS['post'] ?? null;
		// phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- restored below.
		$GLOBALS['post'] = $post;
		setup_postdata( $post );

		try {
			$filtered = apply_filters( 'the_content', $post->post_content ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- core filter
		} finally {
			// phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- restoring the original.
			$GLOBALS['post'] = $previous;
			if ( $previous instanceof \WP_Post ) {
				setup_postdata( $previous );
			} else {
				wp_reset_postdata();
			}
		}

		$content = html_entity_decode( wp_strip_all_tags( $filtered ), ENT_QUOTES, 'UTF-8' );
		return preg_replace( '/\n{3,}/', "\n\n", trim( $content ) ) ?? $content;
	}

	/**
	 * The hand-written excerpt as plain text, or an empty string.
	 *
	 * @param \WP_Post $post Source post.
	 */
	public static function excerpt( \WP_Post $post ): string {
		if ( '' === $post->post_excerpt ) {
			return '';
		}
		return trim( html_entity_decode( wp_strip_all_tags( $post->post_excerpt ), ENT_QUOTES, 'UTF-8' ) );
	}

	/**
	 * Public, non-empty scalar meta, each classified as text or image.
	 *
	 * @param \WP_Post $post Source post.
	 * @return array<string, array<string, mixed>>
	 */
	public static function meta( \WP_Post $post ): array {
		$meta = [];
		foreach ( get_post_meta( $post->ID ) as $key => $values ) {
			if ( str_starts_with( (string) $key, '_' ) ) {
				continue;
			}
			$value = maybe_unserialize( $values[0] ?? '' );
			if ( ! is_scalar( $value ) || '' === (string) $value ) {
				continue;
			}
			$meta[ $key ] = self::classify_meta_value( $value );
		}

		/**
		 * Filters the public post meta exposed through Post Import and template fills.
		 *
		 * Only non-underscore-prefixed (public) scalar meta is included by
		 * default. Site owners can use this filter to unset specific keys, or
		 * return an empty array to expose no meta at all.
		 *
		 * @param array<string, mixed> $meta    Meta keyed by meta key, each value a
		 *                                       classified { type, value, ... } array.
		 * @param int                  $post_id The source post ID.
		 * @param \WP_Post             $post    The source post object.
		 */
		return apply_filters( 'socialframe_import_post_meta', $meta, $post->ID, $post );
	}

	/**
	 * Every taxonomy's assigned terms, keyed by taxonomy slug.
	 *
	 * @param \WP_Post $post Source post.
	 * @return array<string, array{label: string, terms: string[]}>
	 */
	public static function terms( \WP_Post $post ): array {
		$result = [];
		foreach ( get_object_taxonomies( $post->post_type, 'objects' ) as $slug => $taxonomy ) {
			$terms = get_the_terms( $post->ID, $slug );
			if ( ! $terms || is_wp_error( $terms ) ) {
				continue;
			}
			$result[ $slug ] = [
				'label' => $taxonomy->labels->name,
				'terms' => array_map( fn( $t ) => $t->name, $terms ),
			];
		}
		return $result;
	}

	/**
	 * Field values this post provides for the given field names.
	 *
	 * Only the names asked for are computed, so a design that uses just
	 * `post.title` never renders the content. Names the post has no value for
	 * are left out. Image values are attachment IDs.
	 *
	 * @param \WP_Post $post         Source post.
	 * @param string[] $wanted_names Field names used by the design.
	 * @return array<string, string|int>
	 */
	public static function values_for( \WP_Post $post, array $wanted_names ): array {
		$values  = [];
		$content = null;
		$meta    = null;

		foreach ( array_unique( $wanted_names ) as $name ) {
			$value = null;

			if ( 'post.title' === $name ) {
				$value = self::title( $post );
			} elseif ( 'post.content' === $name ) {
				$content ??= self::content( $post );
				$value     = $content;
			} elseif ( 'post.excerpt' === $name ) {
				$value = self::excerpt( $post );
				if ( '' === $value ) {
					$content ??= self::content( $post );
					$value     = wp_trim_words( $content, self::EXCERPT_WORDS, '…' );
				}
			} elseif ( 'post.date' === $name ) {
				$value = (string) get_the_date( '', $post );
			} elseif ( 'post.author' === $name ) {
				$value = (string) get_the_author_meta( 'display_name', (int) $post->post_author );
			} elseif ( 'post.featured_image' === $name ) {
				$value = (int) get_post_thumbnail_id( $post );
				$value = $value > 0 ? $value : null;
			} elseif ( str_starts_with( $name, 'meta.' ) ) {
				$meta ??= self::meta( $post );
				$value = self::meta_field_value( $meta[ substr( $name, 5 ) ] ?? null );
			} elseif ( str_starts_with( $name, 'terms.' ) ) {
				$taxonomy = substr( $name, 6 );
				if ( taxonomy_exists( $taxonomy ) && is_object_in_taxonomy( $post->post_type, $taxonomy ) ) {
					$terms = get_the_terms( $post->ID, $taxonomy );
					if ( $terms && ! is_wp_error( $terms ) ) {
						$value = implode( ', ', array_map( fn( $t ) => $t->name, $terms ) );
					}
				}
			}

			if ( null !== $value ) {
				$values[ $name ] = $value;
			}
		}

		/**
		 * Filters the field values a post provides to a template fill.
		 *
		 * Text values are strings; image values are attachment IDs. Add a key
		 * to supply a value for a custom field name.
		 *
		 * @param array<string, string|int> $values       Values keyed by field name.
		 * @param \WP_Post                  $post         The source post.
		 * @param string[]                  $wanted_names Field names used by the design.
		 */
		return apply_filters( 'socialframe_post_field_values', $values, $post, $wanted_names );
	}

	/**
	 * Turn a classified meta entry into a field value.
	 *
	 * Image meta becomes an attachment ID, resolving a URL when it points at
	 * an original Media Library file; image URLs from elsewhere are skipped.
	 *
	 * @param array<string, mixed>|null $item Classified meta entry.
	 * @return string|int|null
	 */
	private static function meta_field_value( ?array $item ): string|int|null {
		if ( ! $item ) {
			return null;
		}
		if ( 'image' !== ( $item['type'] ?? '' ) ) {
			return (string) $item['value'];
		}
		if ( is_numeric( $item['value'] ) ) {
			return (int) $item['value'];
		}
		$id = attachment_url_to_postid( (string) $item['value'] );
		return $id > 0 ? $id : null;
	}

	/**
	 * Classify a scalar meta value into a typed structure.
	 *
	 * Returns an array with:
	 *   type      — 'image' | 'text'
	 *   value     — the raw scalar value (original meta value)
	 *   image_url — resolved image URL (only present when type === 'image')
	 *
	 * Detection order:
	 *   1. Numeric value that maps to a WordPress image attachment → type=image
	 *   2. String URL ending with a common image extension          → type=image
	 *   3. Everything else                                          → type=text
	 *
	 * @param mixed $value Scalar meta value.
	 * @return array<string, mixed>
	 */
	private static function classify_meta_value( mixed $value ): array {
		// 1. Numeric attachment ID.
		if ( is_numeric( $value ) && (int) $value > 0 ) {
			$attachment_url = wp_get_attachment_url( (int) $value );
			if ( $attachment_url ) {
				$mime = get_post_mime_type( (int) $value );
				if ( is_string( $mime ) && str_starts_with( $mime, 'image/' ) ) {
					return [
						'type'      => 'image',
						'value'     => $value,
						'image_url' => $attachment_url,
					];
				}
			}
		}

		// 2. URL string pointing to an image file.
		if ( is_string( $value ) && preg_match( '/\.(jpe?g|png|gif|webp|svg)(\?.*)?$/i', $value ) ) {
			return [
				'type'      => 'image',
				'value'     => $value,
				'image_url' => $value,
			];
		}

		// 3. Plain text.
		return [
			'type'  => 'text',
			'value' => $value,
		];
	}
}
