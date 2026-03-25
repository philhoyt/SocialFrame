import { useEffect } from '@wordpress/element';
import { useDispatch } from '@wordpress/data';

import { STORE_KEY } from '../store';

/**
 * Register keyboard shortcuts for the editor.
 *
 * @param {Object} fabricApi The Fabric imperative API from FabricContext.
 * @param {number} designId  The design post ID for manual save.
 */
export function useKeyboardShortcuts( fabricApi, designId ) {
	const dispatch = useDispatch( STORE_KEY );

	useEffect( () => {
		function handleKeyDown( e ) {
			const mod = e.ctrlKey || e.metaKey;

			// Undo: Ctrl/Cmd+Z
			if ( mod && ! e.shiftKey && e.key === 'z' ) {
				e.preventDefault();
				dispatch.undoAction();
				return;
			}

			// Redo: Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y
			if ( mod && ( ( e.shiftKey && e.key === 'z' ) || e.key === 'y' ) ) {
				e.preventDefault();
				dispatch.redoAction();
				return;
			}

			// Zoom in: Ctrl/Cmd++ or Ctrl/Cmd+=
			if ( mod && ( e.key === '+' || e.key === '=' ) ) {
				e.preventDefault();
				fabricApi?.zoomIn?.();
				return;
			}

			// Zoom out: Ctrl/Cmd+-
			if ( mod && e.key === '-' ) {
				e.preventDefault();
				fabricApi?.zoomOut?.();
				return;
			}

			// Fit to screen: Ctrl/Cmd+0
			if ( mod && e.key === '0' ) {
				e.preventDefault();
				fabricApi?.fitView?.();
				return;
			}

			// Duplicate selected: Ctrl/Cmd+D
			if ( mod && e.key === 'd' ) {
				e.preventDefault();
				fabricApi?.duplicateSelected?.();
				return;
			}

			// Delete selected: Backspace / Delete (when not in a text field)
			if ( ( e.key === 'Backspace' || e.key === 'Delete' ) ) {
				const tag = document.activeElement?.tagName;
				if ( tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable ) {
					return;
				}
				e.preventDefault();
				fabricApi?.deleteSelected?.();
			}
		}

		document.addEventListener( 'keydown', handleKeyDown );
		return () => document.removeEventListener( 'keydown', handleKeyDown );
	}, [ dispatch, fabricApi, designId ] );
}
