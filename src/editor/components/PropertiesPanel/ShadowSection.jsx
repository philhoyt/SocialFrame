import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import * as fabric from 'fabric';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';
import { ColorRow } from './ColorRow';
import { NumField } from './NumField';
import { LinkedNumFields } from './LinkedNumFields';

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
					<ColorRow
						value={ shadow.color || null }
						onChange={ ( hex ) => applyShadow( { color: hex } ) }
						pickerLabel={ __( 'Shadow color', 'socialframe' ) }
					/>

					<div style={ { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 } }>
						<NumField
							label="Blur"
							value={ shadow.blur }
							min={ 0 }
							onChange={ ( v ) => applyShadow( { blur: v } ) }
						/>
						<LinkedNumFields
							stateKey="shadow-offset"
							linkMode="delta"
							lockLabel={ __( 'Lock offsets', 'socialframe' ) }
							unlockLabel={ __( 'Unlock offsets', 'socialframe' ) }
							aLabel="X"
							aValue={ shadow.offsetX }
							aMin={ -200 }
							aMax={ 200 }
							onChangeA={ ( v ) => applyShadow( { offsetX: v } ) }
							bLabel="Y"
							bValue={ shadow.offsetY }
							bMin={ -200 }
							bMax={ 200 }
							onChangeB={ ( v ) => applyShadow( { offsetY: v } ) }
							onChangeBoth={ ( x, y ) => applyShadow( { offsetX: x, offsetY: y } ) }
						/>
					</div>
				</>
			) }
		</>
	);
}
