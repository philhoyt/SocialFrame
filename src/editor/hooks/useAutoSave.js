import { useCallback, useEffect, useRef } from '@wordpress/element';
import { useSelect, useDispatch } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';

import { STORE_KEY } from '../store';
import { useFabric } from '../EditorApp';
import { sendPreview } from '../utils/exportHelpers';

const DEBOUNCE_MS = 2000;
export const AUTOSAVE_FAILED_NOTICE_ID = 'socialframe-autosave-failed';

let saveTail = Promise.resolve();

/**
 * Run saves one at a time, in the order they were asked for.
 *
 * Autosave and manual saves both go through here, so an older request can
 * never finish after a newer one and overwrite it. Each task reads the
 * canvas when its turn comes, so it always sends the newest state.
 *
 * @param {() => Promise} task Save to run.
 * @return {Promise} Resolves or rejects with the task's result.
 */
export function serializeSave( task ) {
	const run = saveTail.then( task );
	saveTail = run.catch( () => {} );
	return run;
}

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
				await serializeSave( () =>
					apiFetch( {
						path: `socialframe/v1/designs/${ designId }`,
						method: 'PUT',
						data: { fabricJson: JSON.stringify( getJSON() ) },
					} )
				);
				dispatch.markClean();
				removeNotice( AUTOSAVE_FAILED_NOTICE_ID );
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
					{ id: AUTOSAVE_FAILED_NOTICE_ID, type: 'snackbar' }
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

/**
 * Save the open design now, in turn with any autosave.
 *
 * @return {() => Promise<boolean>} Resolves true once the server has the
 *                                  current canvas and title, false on failure.
 */
export function useSaveNow() {
	const fabric = useFabric();
	const { designId, title } = useSelect( ( select ) => ( {
		designId: select( STORE_KEY ).getDesignId(),
		title: select( STORE_KEY ).getDesignTitle(),
	} ) );
	const dispatch = useDispatch( STORE_KEY );
	const { removeNotice } = useDispatch( noticesStore );

	return useCallback( async () => {
		if ( ! fabric || ! designId ) {
			return false;
		}
		dispatch.setSaving( true );
		try {
			await serializeSave( () =>
				apiFetch( {
					path: `socialframe/v1/designs/${ designId }`,
					method: 'PUT',
					data: {
						title,
						fabricJson: JSON.stringify( fabric.getJSON() ),
					},
				} )
			);
			dispatch.markClean();
			// A successful save supersedes an earlier autosave failure.
			removeNotice( AUTOSAVE_FAILED_NOTICE_ID );
			sendPreview( fabric.toDataURL, designId, apiFetch );
			return true;
		} catch {
			return false;
		} finally {
			dispatch.setSaving( false );
		}
	}, [ fabric, designId, title, dispatch, removeNotice ] );
}
