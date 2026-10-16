import { useEffect, useRef } from '@wordpress/element';
import { useSelect, useDispatch } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';

import { STORE_KEY } from '../store';
import { sendPreview } from '../utils/exportHelpers';

const DEBOUNCE_MS = 2000;
const FAILED_NOTICE_ID = 'socialframe-autosave-failed';

/**
 * Debounced auto-save: fires a PUT /designs/:id when the editor is dirty,
 * then sends a preview thumbnail in the background.
 *
 * @param {() => Object}        getJSON   Function returning the current Fabric JSON.
 * @param {number}              designId  The design post ID.
 * @param {(() => string)|null} toDataURL Optional canvas toDataURL function for preview generation.
 */
export function useAutoSave( getJSON, designId, toDataURL = null ) {
	const isDirty = useSelect( ( select ) => select( STORE_KEY ).isDirty() );
	const dispatch = useDispatch( STORE_KEY );
	const { createErrorNotice, removeNotice } = useDispatch( noticesStore );
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
				removeNotice( FAILED_NOTICE_ID );
				if ( toDataURL ) {
					sendPreview( toDataURL, designId, apiFetch );
				}
			} catch {
				// A fixed id replaces rather than stacks repeat failures.
				createErrorNotice(
					__(
						'Autosave failed. Your changes are not saved yet.',
						'socialframe'
					),
					{ id: FAILED_NOTICE_ID, type: 'snackbar' }
				);
			} finally {
				dispatch.setSaving( false );
			}
		}, DEBOUNCE_MS );

		return () => clearTimeout( timerRef.current );
	}, [
		isDirty,
		designId,
		getJSON,
		toDataURL,
		dispatch,
		createErrorNotice,
		removeNotice,
	] );
}
