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
			'label'  => __( 'Instagram Post', 'socialframe' ),
			'width'  => 1080,
			'height' => 1080,
		],
		'instagram-portrait' => [
			'label'  => __( 'Instagram Portrait', 'socialframe' ),
			'width'  => 1080,
			'height' => 1350,
		],
		'instagram-story'    => [
			'label'  => __( 'Instagram Story', 'socialframe' ),
			'width'  => 1080,
			'height' => 1920,
		],
		'facebook-post'      => [
			'label'  => __( 'Facebook Post', 'socialframe' ),
			'width'  => 1200,
			'height' => 630,
		],
		'twitter-post'       => [
			'label'  => __( 'Twitter/X Post', 'socialframe' ),
			'width'  => 1200,
			'height' => 675,
		],
		'linkedin-post'      => [
			'label'  => __( 'LinkedIn Post', 'socialframe' ),
			'width'  => 1200,
			'height' => 627,
		],
		'pinterest-pin'      => [
			'label'  => __( 'Pinterest Pin', 'socialframe' ),
			'width'  => 1000,
			'height' => 1500,
		],
		'youtube-thumbnail'  => [
			'label'  => __( 'YouTube Thumbnail', 'socialframe' ),
			'width'  => 1920,
			'height' => 1080,
		],
		'youtube-short'      => [
			'label'  => __( 'YouTube Short', 'socialframe' ),
			'width'  => 1080,
			'height' => 1920,
		],
	];
}
