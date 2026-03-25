<?php
/**
 * Boot orchestrator for SocialFrame.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

namespace SocialFrame;

/**
 * Wires all plugin components together.
 */
class Plugin {

	/**
	 * Boot all plugin components.
	 */
	public function boot(): void {
		( new CPT\GraphicPostType() )->register();
		( new Meta\GraphicMeta() )->register();

		( new REST\DesignsController() )->register();
		( new REST\ExportController() )->register();
		( new REST\DuplicateController() )->register();
		( new REST\TemplatesController() )->register();
		( new REST\PostImportController() )->register();

		( new Admin\AdminPage() )->register();
		( new Admin\EditorPage() )->register();
	}
}
