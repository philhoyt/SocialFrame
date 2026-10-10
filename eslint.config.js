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
	{
		// ESLint flat config discovers only *.js, *.cjs, *.mjs on its own.
		// Name every other extension here or the rules below never see it.
		files: [ '**/*.jsx', '**/*.ts', '**/*.tsx' ],
	},
	...defaultConfig,
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
		},
	},
];
