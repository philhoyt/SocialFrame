/**
 * Unit tests for the editor shortcut mapping.
 */
import { describe, it, expect } from 'vitest';
import { resolveShortcut } from '../useKeyboardShortcuts';

const key = ( k, opts = {}, target = document.body ) => ( {
	key: k,
	ctrlKey: false,
	metaKey: false,
	shiftKey: false,
	altKey: false,
	target,
	...opts,
} );

describe( 'resolveShortcut', () => {
	it( 'maps undo and redo, including uppercase Z with Shift', () => {
		expect( resolveShortcut( key( 'z', { metaKey: true } ) ) ).toBe(
			'undo'
		);
		expect(
			resolveShortcut( key( 'Z', { ctrlKey: true, shiftKey: true } ) )
		).toBe( 'redo' );
		expect( resolveShortcut( key( 'y', { ctrlKey: true } ) ) ).toBe(
			'redo'
		);
	} );

	it( 'leaves keys to the Layers tree, its menu, and handled events', () => {
		const tree = document.createElement( 'div' );
		tree.setAttribute( 'role', 'tree' );
		const row = document.createElement( 'div' );
		tree.appendChild( row );
		const menu = document.createElement( 'div' );
		menu.setAttribute( 'role', 'menu' );

		expect( resolveShortcut( key( 'Delete', {}, row ) ) ).toBeNull();
		expect(
			resolveShortcut( key( 'd', { metaKey: true }, menu ) )
		).toBeNull();
		expect(
			resolveShortcut( key( 'Delete', { defaultPrevented: true } ) )
		).toBeNull();
		expect( resolveShortcut( key( 'Delete' ) ) ).toBe( 'delete' );
	} );

	it( 'leaves Ctrl/Cmd +, - and 0 to the browser', () => {
		expect( resolveShortcut( key( '=', { ctrlKey: true } ) ) ).toBeNull();
		expect( resolveShortcut( key( '-', { metaKey: true } ) ) ).toBeNull();
		expect( resolveShortcut( key( '0', { ctrlKey: true } ) ) ).toBeNull();
	} );

	it( 'zooms with unmodified keys', () => {
		expect( resolveShortcut( key( '+', { shiftKey: true } ) ) ).toBe(
			'zoomIn'
		);
		expect( resolveShortcut( key( '-' ) ) ).toBe( 'zoomOut' );
		expect( resolveShortcut( key( '0' ) ) ).toBe( 'fit' );
	} );

	it( 'ignores keys typed into form controls and dialogs', () => {
		const select = document.createElement( 'select' );
		const input = document.createElement( 'input' );
		const dialog = document.createElement( 'div' );
		dialog.setAttribute( 'role', 'dialog' );
		const button = document.createElement( 'button' );
		dialog.appendChild( button );
		document.body.appendChild( dialog );

		expect( resolveShortcut( key( 'Backspace', {}, select ) ) ).toBeNull();
		expect(
			resolveShortcut( key( 'z', { ctrlKey: true }, input ) )
		).toBeNull();
		expect( resolveShortcut( key( 'Delete', {}, button ) ) ).toBeNull();
		expect( resolveShortcut( key( 'Delete' ) ) ).toBe( 'delete' );

		dialog.remove();
	} );
} );
