<?php
/**
 * Admin management page for SocialFrame.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

namespace SocialFrame\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}


/**
 * Registers the primary SocialFrame menu and management screen.
 */
class AdminPage {

	/**
	 * Hook into WordPress admin.
	 */
	public function register(): void {
		add_action( 'admin_menu', [ $this, 'register_menu' ] );
		add_action( 'admin_enqueue_scripts', [ $this, 'enqueue' ] );
	}

	/**
	 * Register the top-level menu and sub-pages.
	 */
	public function register_menu(): void {
		add_menu_page(
			__( 'SocialFrame', 'socialframe' ),
			__( 'SocialFrame', 'socialframe' ),
			'edit_posts',
			'socialframe',
			[ $this, 'render_page' ],
			'dashicons-format-image',
			58
		);

		add_submenu_page(
			'socialframe',
			__( 'All Designs', 'socialframe' ),
			__( 'All Designs', 'socialframe' ),
			'edit_posts',
			'socialframe',
			[ $this, 'render_page' ]
		);

		add_submenu_page(
			'socialframe',
			__( 'New Design', 'socialframe' ),
			__( 'New Design', 'socialframe' ),
			'edit_posts',
			'socialframe-new',
			[ $this, 'render_new_page' ]
		);
	}

	/**
	 * Render the management screen mount point.
	 */
	public function render_page(): void {
		echo '<div id="socialframe-admin-root"></div>';
	}

	/**
	 * Render the new design page mount point.
	 */
	public function render_new_page(): void {
		echo '<div id="socialframe-new-root"></div>';
	}

	/**
	 * Enqueue scripts and styles for the management pages.
	 *
	 * @param string $hook Current admin page hook.
	 */
	public function enqueue( string $hook ): void {
		$admin_hooks = [
			'toplevel_page_socialframe',
			'socialframe_page_socialframe-new',
		];

		if ( ! in_array( $hook, $admin_hooks, true ) ) {
			return;
		}

		$is_new = 'socialframe_page_socialframe-new' === $hook;

		if ( $is_new ) {
			$this->enqueue_new_design();
		} else {
			$this->enqueue_admin();
		}
	}

	/**
	 * Enqueue the management screen (DataViews) assets.
	 */
	private function enqueue_admin(): void {
		$asset_file = SOCIALFRAME_DIR . 'build/admin/index.asset.php';

		if ( ! file_exists( $asset_file ) ) {
			return;
		}

		$asset = require $asset_file;

		wp_enqueue_script(
			'socialframe-admin',
			SOCIALFRAME_URL . 'build/admin/index.js',
			$asset['dependencies'],
			$asset['version'],
			true
		);

		if ( file_exists( SOCIALFRAME_DIR . 'build/admin/index.css' ) ) {
			wp_enqueue_style(
				'socialframe-admin',
				SOCIALFRAME_URL . 'build/admin/index.css',
				[ 'wp-components' ],
				$asset['version']
			);
		}

		wp_localize_script(
			'socialframe-admin',
			'socialFrameAdminConfig',
			[
				'restUrl'  => esc_url_raw( rest_url( 'socialframe/v1/' ) ),
				'nonce'    => wp_create_nonce( 'wp_rest' ),
				'adminUrl' => esc_url( admin_url( 'admin.php' ) ),
				'formats'  => socialframe_get_formats(),
			]
		);
	}

	/**
	 * Enqueue the new design format picker assets.
	 */
	private function enqueue_new_design(): void {
		$asset_file = SOCIALFRAME_DIR . 'build/new-design/index.asset.php';

		if ( ! file_exists( $asset_file ) ) {
			return;
		}

		$asset = require $asset_file;

		wp_enqueue_script(
			'socialframe-new-design',
			SOCIALFRAME_URL . 'build/new-design/index.js',
			$asset['dependencies'],
			$asset['version'],
			true
		);

		if ( file_exists( SOCIALFRAME_DIR . 'build/new-design/index.css' ) ) {
			wp_enqueue_style(
				'socialframe-new-design',
				SOCIALFRAME_URL . 'build/new-design/index.css',
				[ 'wp-components' ],
				$asset['version']
			);
		}

		wp_localize_script(
			'socialframe-new-design',
			'socialFrameNewConfig',
			[
				'restUrl'    => esc_url_raw( rest_url( 'socialframe/v1/' ) ),
				'nonce'      => wp_create_nonce( 'wp_rest' ),
				'formats'    => socialframe_get_formats(),
				'editorBase' => esc_url( admin_url( 'admin.php?page=socialframe-editor' ) ),
			]
		);
	}
}
