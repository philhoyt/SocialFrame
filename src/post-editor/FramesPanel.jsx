import { useCallback, useEffect, useState } from '@wordpress/element';
import { Notice, Spinner } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import {
	PluginDocumentSettingPanel,
	store as editorStore,
} from '@wordpress/editor';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

import { FrameRow } from './FrameRow';

/**
 * Document sidebar panel listing the designs assigned to this post type.
 */
export function FramesPanel() {
	const { postId, isDirty } = useSelect(
		( select ) => ( {
			postId: select( editorStore ).getCurrentPostId(),
			isDirty: select( editorStore ).isEditedPostDirty(),
		} ),
		[]
	);
	const [ data, setData ] = useState( null );
	const [ error, setError ] = useState( false );

	const load = useCallback( () => {
		if ( ! postId ) {
			return;
		}
		apiFetch( { path: `socialframe/v1/posts/${ postId }/frames` } )
			.then( ( response ) => {
				setData( response );
				setError( false );
			} )
			.catch( () => setError( true ) );
	}, [ postId ] );

	useEffect( load, [ load ] );

	// Touch-ups exported from SocialFrame in another tab show up on return.
	// Switching browser tabs does not always focus the window, so also
	// reload when the page becomes visible again.
	useEffect( () => {
		const onVisible = () => {
			if ( 'visible' === document.visibilityState ) {
				load();
			}
		};
		window.addEventListener( 'focus', load );
		document.addEventListener( 'visibilitychange', onVisible );
		return () => {
			window.removeEventListener( 'focus', load );
			document.removeEventListener( 'visibilitychange', onVisible );
		};
	}, [ load ] );

	if ( data && ! data.frames.length ) {
		return null;
	}

	return (
		<PluginDocumentSettingPanel
			name="socialframe-frames"
			title={ __( 'SocialFrame', 'socialframe' ) }
			className="socialframe-frames"
		>
			{ error && (
				<Notice status="error" isDismissible={ false }>
					{ __( 'Could not load the designs.', 'socialframe' ) }
				</Notice>
			) }
			{ ! data && ! error && <Spinner /> }
			{ data && (
				<>
					{ isDirty && (
						<p className="socialframe-frames__note">
							{ __(
								'Unsaved changes to the title, excerpt and featured image are used. Save the post to include other changes.',
								'socialframe'
							) }
						</p>
					) }
					{ data.frames.map( ( frame ) => (
						<FrameRow
							key={ frame.design.id }
							frame={ frame }
							postId={ postId }
							onChanged={ load }
						/>
					) ) }
					{ data.truncated && (
						<p className="socialframe-frames__note">
							{ __(
								'Only the first 50 designs are shown.',
								'socialframe'
							) }
						</p>
					) }
				</>
			) }
		</PluginDocumentSettingPanel>
	);
}
