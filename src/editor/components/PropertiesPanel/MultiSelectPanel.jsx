import { useSelect } from '@wordpress/data';
import { Button } from '@wordpress/components';
import { __, sprintf, _n } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';
import { Accordion } from './Accordion';

/**
 * Properties for a multi-selection: turn the layers into a frame.
 */
export function MultiSelectPanel() {
	const fabric = useFabric();
	const ids = useSelect(
		( select ) => select( STORE_KEY ).getSelectionProps()?.ids ?? [],
		[]
	);
	const frames = fabric?.frames;
	if ( ! frames ) {
		return null;
	}
	const problem = frames.createProblem( ids );

	return (
		<div className="socialframe-props">
			<Accordion
				title={ sprintf(
					/* translators: %d: number of selected layers. */
					_n( '%d layer', '%d layers', ids.length, 'socialframe' ),
					ids.length
				) }
			>
				<p className="socialframe-props__hint">
					{ problem ||
						__(
							'A frame lays its layers out for you, with padding, a gap and alignment. If one selected rectangle surrounds the others, it becomes the frame’s background.',
							'socialframe'
						) }
				</p>
				<Button
					variant="primary"
					size="small"
					disabled={ !! problem }
					accessibleWhenDisabled
					onClick={ () => frames.createFrame( ids ) }
				>
					{ __( 'Create frame', 'socialframe' ) }
				</Button>
			</Accordion>
		</div>
	);
}
