import { useSelect } from '@wordpress/data';
import { SelectControl, RangeControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';
import { Accordion } from './Accordion';
import { NumField } from './NumField';
import { AlignmentSection } from './AlignmentSection';
import { FlipSection } from './FlipSection';
import { ShadowSection } from './ShadowSection';
import { ColorRow } from './ColorRow';

const { themeFonts } = window.socialFrameConfig ?? {};

export function TextProperties() {
	const props  = useSelect( ( select ) => select( STORE_KEY ).getSelectionProps() );
	const fabric = useFabric();

	const update = ( partial, label ) => fabric?.updateSelected( partial, label );

	const fontOptions = ( themeFonts ?? [] ).map( ( f ) => ( {
		label: f.name,
		value: f.fontFamily,
	} ) );

	return (
		<div className="socialframe-props">

			<Accordion title={ __( 'Position', 'socialframe' ) }>
				<div className="socialframe-num-grid">
					<NumField label="X" value={ Math.round( props.left   ?? 0 ) } onChange={ ( v ) => update( { left:  v }, 'Position X' ) } />
					<NumField label="Y" value={ Math.round( props.top    ?? 0 ) } onChange={ ( v ) => update( { top:   v }, 'Position Y' ) } />
					<NumField label="W" value={ Math.round( props.width  ?? 0 ) } onChange={ ( v ) => update( { width: v }, 'Width' ) } />
					<NumField label="H" value={ Math.round( props.height ?? 0 ) } readOnly />
					<NumField label="°" value={ Math.round( props.angle  ?? 0 ) } onChange={ ( v ) => update( { angle:   v }, 'Rotation' ) } />
					<NumField label="%" value={ Math.round( ( props.opacity ?? 1 ) * 100 ) } min={ 0 } max={ 100 } onChange={ ( v ) => update( { opacity: v / 100 }, 'Opacity' ) } />
				</div>
			</Accordion>

			<Accordion title={ __( 'Typography', 'socialframe' ) }>
				{ fontOptions.length > 0 && (
					<SelectControl
						label={ __( 'Font', 'socialframe' ) }
						value={ props.fontFamily ?? '' }
						options={ fontOptions }
						onChange={ ( v ) => update( { fontFamily: v }, 'Font family' ) }
					/>
				) }

				<div className="socialframe-num-grid" style={ { marginBottom: 12 } }>
					<NumField label="Size" value={ props.fontSize ?? 16 }          min={ 8 } max={ 300 } onChange={ ( v ) => update( { fontSize:    v },      'Font size' ) } />
					<NumField label="LH"   value={ props.lineHeight  ?? 1.16 }     step={ 0.01 } min={ 0.5 } max={ 4 } onChange={ ( v ) => update( { lineHeight:  v },      'Line height' ) } />
					<NumField label="LS"   value={ props.charSpacing ?? 0 }        min={ -200 } max={ 800 } onChange={ ( v ) => update( { charSpacing: v },      'Letter spacing' ) } />
				</div>

				<div className="socialframe-props__subsection-label">{ __( 'Style', 'socialframe' ) }</div>
				<div className="socialframe-props__button-group" style={ { marginBottom: 10 } }>
					<button
						className={ `socialframe-props__toggle-btn${ props.fontWeight === 'bold' ? ' socialframe-props__toggle-btn--active' : '' }` }
						onClick={ () => update( { fontWeight: props.fontWeight === 'bold' ? 'normal' : 'bold' }, 'Bold' ) }
					><strong>B</strong></button>
					<button
						className={ `socialframe-props__toggle-btn${ props.fontStyle === 'italic' ? ' socialframe-props__toggle-btn--active' : '' }` }
						onClick={ () => update( { fontStyle: props.fontStyle === 'italic' ? 'normal' : 'italic' }, 'Italic' ) }
					><em>I</em></button>
					<button
						className={ `socialframe-props__toggle-btn${ props.underline ? ' socialframe-props__toggle-btn--active' : '' }` }
						onClick={ () => update( { underline: ! props.underline }, 'Underline' ) }
					><u>U</u></button>
				</div>

				<div className="socialframe-props__subsection-label">{ __( 'Alignment', 'socialframe' ) }</div>
				<div className="socialframe-props__button-group">
					{ [ 'left', 'center', 'right' ].map( ( align ) => (
						<button
							key={ align }
							className={ `socialframe-props__toggle-btn${ props.textAlign === align ? ' socialframe-props__toggle-btn--active' : '' }` }
							onClick={ () => update( { textAlign: align }, `Align ${ align }` ) }
						>
							{ align[ 0 ].toUpperCase() }
						</button>
					) ) }
				</div>
			</Accordion>

			<Accordion title={ __( 'Fill', 'socialframe' ) }>
				<ColorRow
					value={ typeof props.fill === 'string' ? props.fill : null }
					onChange={ ( hex ) => update( { fill: hex }, 'Text color' ) }
				/>
			</Accordion>

			<Accordion title={ __( 'Background', 'socialframe' ) } defaultOpen={ false }>
				<ColorRow
					value={ props.backgroundColor || null }
					onChange={ ( hex ) => update( { backgroundColor: hex }, 'Text background' ) }
					showNone
					noneValue=""
					noneLabel={ __( 'No background', 'socialframe' ) }
				/>
			</Accordion>

			<Accordion title={ __( 'Layout', 'socialframe' ) } defaultOpen={ false }>
				<FlipSection />
				<AlignmentSection />
			</Accordion>

			<Accordion title={ __( 'Effects', 'socialframe' ) } defaultOpen={ false }>
				<ShadowSection />
			</Accordion>

		</div>
	);
}
