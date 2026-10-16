import { useEffect } from '@wordpress/element';
import { useDispatch } from '@wordpress/data';

import { STORE_KEY } from '../store';

/**
 * Whether a key event belongs to a form control or dialog, where the
 * browser's own behaviour (text undo, Backspace, option selection) must win.
 *
 * Fabric's in-canvas text editing uses a hidden textarea, so it is covered too.
 *
 * @param {Element|null} el Event target.
 * @return {boolean} True when editor shortcuts should not run.
 */
function isTypingContext( el ) {
	if ( ! el || ! el.closest ) {
		return false;
	}
	return (
		[ 'INPUT', 'TEXTAREA', 'SELECT' ].includes( el.tagName ) ||
		el.isContentEditable ||
		!! el.closest( '[role="dialog"], .components-modal__frame' )
	);
}

/**
 * Map a keydown event to an editor action name, or null for none.
 *
 * Shortcuts are ignored while typing in a field, a select, or a dialog. Zoom
 * uses unmodified +, - and 0 so Ctrl/Cmd +/-/0 stay with the browser's own
 * page zoom (WCAG 1.4.4).
 *
 * @param {KeyboardEvent} e Keydown event.
 * @return {string|null} One of undo, redo, duplicate, zoomIn, zoomOut, fit, delete.
 */
export function resolveShortcut( e ) {
	if ( isTypingContext( e.target ) ) {
		return null;
	}

	const mod = e.ctrlKey || e.metaKey;
	// Shift and Caps Lock turn 'z' into 'Z'; compare case-insensitively.
	const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

	if ( mod ) {
		if ( key === 'z' ) {
			return e.shiftKey ? 'redo' : 'undo';
		}
		if ( key === 'y' ) {
			return 'redo';
		}
		if ( key === 'd' ) {
			return 'duplicate';
		}
		return null;
	}

	if ( e.altKey ) {
		return null;
	}

	switch ( key ) {
		case '+':
		case '=':
			return 'zoomIn';
		case '-':
			return 'zoomOut';
		case '0':
			return 'fit';
		case 'Backspace':
		case 'Delete':
			return 'delete';
		default:
			return null;
	}
}

/**
 * Register keyboard shortcuts for the editor.
 *
 * @param {Object} fabricApi The Fabric imperative API from FabricContext.
 * @param {number} designId  The design post ID for manual save.
 */
export function useKeyboardShortcuts( fabricApi, designId ) {
	const dispatch = useDispatch( STORE_KEY );

	useEffect( () => {
		const actions = {
			undo: () => dispatch.undoAction(),
			redo: () => dispatch.redoAction(),
			duplicate: () => fabricApi?.duplicateSelected?.(),
			zoomIn: () => fabricApi?.zoomIn?.(),
			zoomOut: () => fabricApi?.zoomOut?.(),
			fit: () => fabricApi?.fitView?.(),
			delete: () => fabricApi?.deleteSelected?.(),
		};

		function handleKeyDown( e ) {
			const action = resolveShortcut( e );
			if ( action ) {
				e.preventDefault();
				actions[ action ]();
			}
		}

		document.addEventListener( 'keydown', handleKeyDown );
		return () => document.removeEventListener( 'keydown', handleKeyDown );
	}, [ dispatch, fabricApi, designId ] );
}
