/**
 * ESLint flat config (ESLint 9 / @wordpress/scripts 32+).
 *
 * Extends the default config shipped with @wordpress/scripts and adds browser
 * globals — the editor, admin, and new-design apps all run in the browser.
 */
const defaultConfig = require( '@wordpress/scripts/config/eslint.config.cjs' );
const globals = require( 'globals' );

module.exports = [
	// Bundled third-party library (Plugin Update Checker) — not ours to lint.
	{ ignores: [ 'lib/**' ] },
	...defaultConfig,
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
		},
	},
];
