/**
 * ESLint flat config (ESLint 9 / `@wordpress/scripts` 32+).
 *
 * Extends the default config shipped with `@wordpress/scripts` and adds browser
 * globals — the editor, admin, and new-design apps all run in the browser.
 */
const defaultConfig = require( '@wordpress/scripts/config/eslint.config.cjs' );
const globals = require( 'globals' );

module.exports = [
	// Bundled third-party library (Plugin Update Checker), Claude Code hook
	// scripts, local plans and build output — not plugin source.
	{
		ignores: [
			'.claude/**',
			'build/**',
			'lib/**',
			'plans/**',
			'vendor/**',
			'node_modules/**',
		],
	},
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
