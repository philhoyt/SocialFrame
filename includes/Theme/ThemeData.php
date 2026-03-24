<?php
/**
 * Theme data extraction for SocialFrame.
 */

declare( strict_types=1 );

namespace SocialFrame\Theme;

/**
 * Reads the active theme's theme.json to extract colors and fonts.
 */
class ThemeData {

	/**
	 * Get the theme color palette.
	 *
	 * @return array<int, array{name: string, slug: string, color: string}>
	 */
	public function get_theme_colors(): array {
		$theme_json = \WP_Theme_JSON_Resolver::get_merged_data()->get_data();
		$palette    = $theme_json['settings']['color']['palette'] ?? [];

		return array_values(
			array_map(
				fn( array $color ): array => [
					'name'  => $color['name'] ?? '',
					'slug'  => $color['slug'] ?? '',
					'color' => $color['color'] ?? '#000000',
				],
				$palette
			)
		);
	}

	/**
	 * Get the theme font families.
	 *
	 * @return array<int, array{name: string, slug: string, fontFamily: string}>
	 */
	public function get_theme_fonts(): array {
		$theme_json    = \WP_Theme_JSON_Resolver::get_merged_data()->get_data();
		$font_families = $theme_json['settings']['typography']['fontFamilies'] ?? [];

		return array_values(
			array_map(
				fn( array $font ): array => [
					'name'       => $font['name'] ?? '',
					'slug'       => $font['slug'] ?? '',
					'fontFamily' => $font['fontFamily'] ?? 'sans-serif',
				],
				$font_families
			)
		);
	}

	/**
	 * Get all localize data for the editor.
	 *
	 * @return array{themeColors: array, themeFonts: array}
	 */
	public function get_localize_data(): array {
		return [
			'themeColors' => $this->get_theme_colors(),
			'themeFonts'  => $this->get_theme_fonts(),
		];
	}
}
