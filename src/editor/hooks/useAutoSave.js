import { useEffect, useRef } from '@wordpress/element';
import { useSelect, useDispatch } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';

import { STORE_KEY } from '../store';

const DEBOUNCE_MS = 2000;

/**
 * Debounced auto-save: fires a PUT /designs/:id when the editor is dirty.
 *
 * @param {Function} getJSON  Function returning the current Fabric JSON.
 * @param {number}   designId The design post ID.
 */
export function useAutoSave( getJSON, designId ) {
	const isDirty = useSelect( ( select ) => select( STORE_KEY ).isDirty() );
	const dispatch = useDispatch( STORE_KEY );
	const timerRef = useRef( null );

	useEffect( () => {
		if ( ! isDirty || ! designId || ! getJSON ) {
			return;
		}

		timerRef.current = setTimeout( async () => {
			dispatch.setSaving( true );
			try {
				await apiFetch( {
					path: `socialframe/v1/designs/${ designId }`,
					method: 'PUT',
					data: { fabricJson: JSON.stringify( getJSON() ) },
				} );
				dispatch.markClean();
			} catch ( e ) {
				// Silent fail — user can manually save.
			} finally {
				dispatch.setSaving( false );
			}
		}, DEBOUNCE_MS );

		return () => clearTimeout( timerRef.current );
	}, [ isDirty, designId, getJSON, dispatch ] );
}
