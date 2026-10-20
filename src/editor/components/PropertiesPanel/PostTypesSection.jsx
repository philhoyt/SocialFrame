import { useState } from '@wordpress/element';
import { CheckboxControl } from '@wordpress/components';
import { useSelect, useDispatch } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';
import { serializeSave } from '../../hooks/useAutoSave';
import { canvasHasFields } from '../../utils/fieldSources';
import { Accordion } from './Accordion';

const { postTypes: AVAILABLE = [] } = window.socialFrameConfig ?? {};

/**
 * Post types this design is assigned to. Posts of these types get a
 * SocialFrame panel in the block editor that fills this design from the post.
 */
export function PostTypesSection() {
	const fabric = useFabric();
	const { designId, assigned } = useSelect( ( select ) => ( {
		designId: select( STORE_KEY ).getDesignId(),
		assigned: select( STORE_KEY ).getPostTypes(),
	} ) );
	const { setPostTypes } = useDispatch( STORE_KEY );
	const { createErrorNotice } = useDispatch( noticesStore );
	const [ hasFields ] = useState( () =>
		canvasHasFields( fabric?.getJSON?.() )
	);

	if ( ! AVAILABLE.length ) {
		return null;
	}

	const toggle = async ( slug, checked ) => {
		const previous = assigned;
		const next = checked
			? [ ...assigned, slug ]
			: assigned.filter( ( s ) => s !== slug );

		setPostTypes( next );
		try {
			// Queued with autosave so the two PUTs cannot race.
			const saved = await serializeSave( () =>
				apiFetch( {
					path: `socialframe/v1/designs/${ designId }`,
					method: 'PUT',
					data: { postTypes: next },
				} )
			);
			setPostTypes( saved.postTypes );
		} catch {
			setPostTypes( previous );
			createErrorNotice(
				__( 'Could not save the post types.', 'socialframe' ),
				{ type: 'snackbar' }
			);
		}
	};

	return (
		<Accordion title={ __( 'Post types', 'socialframe' ) }>
			<p className="socialframe-props__hint">
				{ hasFields
					? __(
							'Posts of these types can generate this design from their own fields in the block editor.',
							'socialframe'
						)
					: __(
							'Add a field to a text or image layer first, so posts have something to fill.',
							'socialframe'
						) }
			</p>
			{ AVAILABLE.map( ( { slug, label } ) => (
				<CheckboxControl
					key={ slug }
					__nextHasNoMarginBottom
					label={ label }
					checked={ assigned.includes( slug ) }
					onChange={ ( checked ) => toggle( slug, checked ) }
				/>
			) ) }
		</Accordion>
	);
}
