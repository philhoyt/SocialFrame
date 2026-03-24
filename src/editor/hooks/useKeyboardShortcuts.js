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
