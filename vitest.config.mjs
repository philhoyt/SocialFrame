import { defineConfig } from 'vitest/config';

// Unit tests run under wp-scripts test-unit-js (Vitest since scripts 36).
// jsdom provides `document` for the keyboard-shortcut tests.
export default defineConfig( {
	test: {
		environment: 'jsdom',
		globals: false,
		restoreMocks: true,
		include: [ 'src/**/test/*.test.js' ],
	},
} );
