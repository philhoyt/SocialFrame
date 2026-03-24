<?php
/**
 * Global helper functions for SocialFrame.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Returns all supported social media formats.
 *
 * @return array<string, array{label: string, width: int, height: int}>
 */
function socialframe_get_formats(): array {
	return [
		'instagram-post'     => [
			'label'  => 'Instagram Post',
			'width'  => 1080,
			'height' => 1080,
		],
		'instagram-portrait' => [
			'label'  => 'Instagram Portrait',
			'width'  => 1080,
			'height' => 1350,
		],
		'instagram-story'    => [
			'label'  => 'Instagram Story',
			'width'  => 1080,
			'height' => 1920,
		],
		'facebook-post'      => [
			'label'  => 'Facebook Post',
			'width'  => 1200,
			'height' => 630,
		],
		'twitter-post'       => [
			'label'  => 'Twitter/X Post',
			'width'  => 1200,
			'height' => 675,
		],
		'linkedin-post'      => [
			'label'  => 'LinkedIn Post',
			'width'  => 1200,
			'height' => 627,
		],
		'pinterest-pin'      => [
			'label'  => 'Pinterest Pin',
			'width'  => 1000,
			'height' => 1500,
		],
	];
}
