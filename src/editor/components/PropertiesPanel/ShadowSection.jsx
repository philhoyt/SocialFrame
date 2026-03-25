import { useSelect } from '@wordpress/data';
import { RangeControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import * as fabric from 'fabric';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';
import { ColorPickerButton } from './ColorPickerButton';

const DEFAULT_SHADOW = { blur: 10, offsetX: 4, offsetY: 4, color: 'rgba(0,0,0,0.5)' };

export function ShadowSection() {
	const props     = useSelect( ( select ) => select( STORE_KEY ).getSelectionProps() );
	const fabricApi = useFabric();
	const hasShadow = !! props.shadow;
	const shadow    = props.shadow ?? DEFAULT_SHADOW;

	function applyShadow( overrides ) {
		fabricApi?.updateSelected( {
			shadow: new fabric.Shadow( { ...shadow, ...overrides } ),
		}, 'Shadow' );
	}

	return (
		<>
			<button
				className={ `socialframe-props__toggle-btn${ hasShadow ? ' socialframe-props__toggle-btn--active' : '' }` }
				style={ { width: '100%', marginBottom: hasShadow ? 12 : 0 } }
				onClick={ () => {
					if ( hasShadow ) {
						fabricApi?.updateSelected( { shadow: null }, 'Remove shadow' );
					} else {
						applyShadow( {} );
					}
				} }
			>
				{ hasShadow ? __( 'Shadow On', 'socialframe' ) : __( 'Shadow Off', 'socialframe' ) }
			</button>

			{ hasShadow && (
				<>
					<div className="socialframe-props__subsection-label" style={ { marginTop: 4 } }>
						{ __( 'Color', 'socialframe' ) }
					</div>
					<div className="socialframe-color-row" style={ { marginBottom: 12 } }>
						<ColorPickerButton
							color={ shadow.color || null }
							onChange={ ( hex ) => applyShadow( { color: hex } ) }
							label={ __( 'Shadow color', 'socialframe' ) }
						/>
					</div>

					<RangeControl
						label={ __( 'Blur', 'socialframe' ) }
						value={ shadow.blur }
						min={ 0 }
						max={ 50 }
						onChange={ ( v ) => applyShadow( { blur: v } ) }
					/>
					<RangeControl
						label={ __( 'Offset X', 'socialframe' ) }
						value={ shadow.offsetX }
						min={ -50 }
						max={ 50 }
						onChange={ ( v ) => applyShadow( { offsetX: v } ) }
					/>
					<RangeControl
						label={ __( 'Offset Y', 'socialframe' ) }
						value={ shadow.offsetY }
						min={ -50 }
						max={ 50 }
						onChange={ ( v ) => applyShadow( { offsetY: v } ) }
					/>
				</>
			) }
		</>
	);
}
