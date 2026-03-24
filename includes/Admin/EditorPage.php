<?php
/**
 * Full-screen editor page for SocialFrame.
 */

declare( strict_types=1 );

namespace SocialFrame\Admin;

/**
 * Registers the hidden full-screen editor page and enqueues its assets.
 *
 * Accessible via: admin.php?page=socialframe-editor&id=<post_id>
 */
class EditorPage {

	/**
	 * Hook into WordPress admin.
	 */
	public function register(): void {
		add_action( 'admin_menu', [ $this, 'register_page' ] );
		add_action( 'admin_enqueue_scripts', [ $this, 'enqueue' ] );
	}

	/**
	 * Register the hidden editor admin page.
	 */
	public function register_page(): void {
		add_submenu_page(
			null, // Hidden — does not appear in the sidebar.
			__( 'SocialFrame Editor', 'socialframe' ),
			__( 'SocialFrame Editor', 'socialframe' ),
			'edit_posts',
			'socialframe-editor',
			[ $this, 'render_page' ]
		);
	}

	/**
	 * Render the editor mount point.
	 */
	public function render_page(): void {
		echo '<div id="socialframe-editor-root"></div>';
		echo '<noscript>' . esc_html__( 'SocialFrame requires JavaScript to be enabled.', 'socialframe' ) . '</noscript>';
	}

	/**
	 * Enqueue editor assets on the editor page.
	 *
	 * @param string $hook Current admin page hook.
	 */
	public function enqueue( string $hook ): void {
		if ( 'admin_page_socialframe-editor' !== $hook ) {
			return;
		}

		$asset_file = SOCIALFRAME_DIR . 'build/editor/index.asset.php';

		if ( ! file_exists( $asset_file ) ) {
			return;
		}

		$asset = require $asset_file;

		wp_enqueue_script(
			'socialframe-editor',
			SOCIALFRAME_URL . 'build/editor/index.js',
			$asset['dependencies'],
			$asset['version'],
			true
		);

		if ( file_exists( SOCIALFRAME_DIR . 'build/editor/index.css' ) ) {
			wp_enqueue_style(
				'socialframe-editor',
				SOCIALFRAME_URL . 'build/editor/index.css',
				[ 'wp-components' ],
				$asset['version']
			);
		}

		// Load the media frame for wp.media modal.
		wp_enqueue_media();

		// Localize theme data and editor config.
		$theme = new \SocialFrame\Theme\ThemeData();

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$design_id = isset( $_GET['id'] ) ? absint( $_GET['id'] ) : 0;

		wp_localize_script(
			'socialframe-editor',
			'socialFrameConfig',
			array_merge(
				$theme->get_localize_data(),
				[
					'restUrl'   => esc_url_raw( rest_url( 'socialframe/v1/' ) ),
					'nonce'     => wp_create_nonce( 'wp_rest' ),
					'designId'  => $design_id,
					'adminUrl'  => esc_url( admin_url( 'admin.php?page=socialframe' ) ),
					'formats'   => socialframe_get_formats(),
				]
			)
		);

		// Full-screen: hide wp-admin chrome.
		add_filter( 'admin_body_class', [ $this, 'add_fullscreen_class' ] );
	}

	/**
	 * Add the full-screen body class to the editor page.
	 *
	 * @param string $classes Existing body classes.
	 * @return string Modified body classes.
	 */
	public function add_fullscreen_class( string $classes ): string {
		return $classes . ' socialframe-fullscreen';
	}
}
