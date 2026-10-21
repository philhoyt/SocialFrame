import { useSelect } from '@wordpress/data';
import { CheckboxControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';
import { Accordion } from './Accordion';
import { FrameSection } from './FrameSection';

/**
 * The artboard as a frame: margins, gap and alignment for the card's
 * content, without drawing a frame the size of the canvas.
 */
export function ArtboardLayoutSection() {
	const fabric = useFabric();
	// Re-read frame details after every change, undo and redo.
	useSelect( ( select ) => select( STORE_KEY ).getRevision(), [] );
	const frames = fabric?.frames;
	const artboard = fabric
		?.getFabric?.()
		?.getObjects()
		.find( ( o ) => o.isArtboard );
	if ( ! frames || ! artboard ) {
		return null;
	}
	const on = !! frames.getInfo( null ).frame;

	return (
		<Accordion
			title={ __( 'Content layout', 'socialframe' ) }
			defaultOpen={ on }
		>
			<CheckboxControl
				__nextHasNoMarginBottom
				label={ __( 'Lay out content', 'socialframe' ) }
				help={ __(
					'Layers you add to the artboard’s layout are placed with its padding, gap and alignment. Other layers stay where you put them.',
					'socialframe'
				) }
				checked={ on }
				onChange={ ( next ) => frames.setArtboardLayout( next ) }
			/>
			{ on && <FrameSection frameId={ artboard.id } isArtboard /> }
		</Accordion>
	);
}
