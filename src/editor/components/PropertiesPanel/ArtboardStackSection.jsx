import { useSelect } from '@wordpress/data';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';
import { Accordion } from './Accordion';
import { CommitNumber } from './StackSection';

/**
 * Stack settings shown with the artboard: the space kept clear at the
 * bottom, and removing the stack altogether.
 */
export function ArtboardStackSection() {
	const fabric = useFabric();
	// Re-read stack details after every change, undo and redo.
	useSelect( ( select ) => select( STORE_KEY ).getRevision(), [] );
	const stack = fabric?.stack;
	const info = stack?.getInfo( null );
	if ( ! info?.hasStack ) {
		return null;
	}

	return (
		<Accordion title={ __( 'Stack', 'socialframe' ) }>
			<CommitNumber
				label={ __( 'Bottom padding', 'socialframe' ) }
				value={ info.bottom }
				min={ 0 }
				onCommit={ ( bottom ) => stack.setBottom( bottom ) }
			/>
			{ info.overflow > 0 && (
				<p className="socialframe-props__hint socialframe-props__hint--warning">
					{ __(
						'The stack runs past the red line. Text set to shrink will be shortened on export.',
						'socialframe'
					) }
				</p>
			) }
			<Button
				variant="secondary"
				size="small"
				isDestructive
				onClick={ () => stack.removeStack() }
			>
				{ __( 'Remove stack', 'socialframe' ) }
			</Button>
		</Accordion>
	);
}
