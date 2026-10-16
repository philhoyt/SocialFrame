import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';

export function FlipSection() {
	const props = useSelect( ( select ) =>
		select( STORE_KEY ).getSelectionProps()
	);
	const fabric = useFabric();

	return (
		<div
			className="socialframe-props__button-group"
			style={ { marginBottom: 12 } }
		>
			<button
				className={ `socialframe-props__toggle-btn${
					props.flipX ? ' socialframe-props__toggle-btn--active' : ''
				}` }
				aria-pressed={ !! props.flipX }
				onClick={ () =>
					fabric?.updateSelected(
						{ flipX: ! props.flipX },
						__( 'Flip horizontal', 'socialframe' )
					)
				}
				title={ __( 'Flip Horizontal', 'socialframe' ) }
			>
				{ __( '⇄ Flip H', 'socialframe' ) }
			</button>
			<button
				className={ `socialframe-props__toggle-btn${
					props.flipY ? ' socialframe-props__toggle-btn--active' : ''
				}` }
				aria-pressed={ !! props.flipY }
				onClick={ () =>
					fabric?.updateSelected(
						{ flipY: ! props.flipY },
						__( 'Flip vertical', 'socialframe' )
					)
				}
				title={ __( 'Flip Vertical', 'socialframe' ) }
			>
				{ __( '⇅ Flip V', 'socialframe' ) }
			</button>
		</div>
	);
}
