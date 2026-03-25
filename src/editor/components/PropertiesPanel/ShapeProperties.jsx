import { useState } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { RangeControl, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';
import { Accordion } from './Accordion';
import { NumField } from './NumField';
import { AlignmentSection } from './AlignmentSection';
import { FlipSection } from './FlipSection';
import { ShadowSection } from './ShadowSection';
import { ColorRow } from './ColorRow';

const FIT_MODES = [
	{ value: 'cover',   label: __( 'Cover',   'socialframe' ) },
	{ value: 'contain', label: __( 'Contain', 'socialframe' ) },
	{ value: 'fill',    label: __( 'Fill',    'socialframe' ) },
	{ value: 'none',    label: __( 'None',    'socialframe' ) },
];

export function ShapeProperties() {
	const props  = useSelect( ( select ) => select( STORE_KEY ).getSelectionProps() );
	const fabric = useFabric();
	const [ fitMode, setFitMode ] = useState( 'cover' );

	const update = ( partial, label ) => fabric?.updateSelected( partial, label );

	const handleFillWithImage = () => {
		if ( ! window.wp?.media ) return;
		const frame = window.wp.media( {
			title:    __( 'Choose Image', 'socialframe' ),
			button:   { text: __( 'Use Image', 'socialframe' ) },
			multiple: false,
			library:  { type: 'image' },
		} );
		frame.on( 'select', () => {
			const attachment = frame.state().get( 'selection' ).first().toJSON();
			fabric?.fillShapeWithImage( attachment.url, fitMode );
		} );
		frame.open();
	};

	return (
		<div className="socialframe-props">

			<Accordion title={ __( 'Position', 'socialframe' ) }>
				<div className="socialframe-num-grid">
					<NumField label="X" value={ Math.round( props.left   ?? 0 ) } onChange={ ( v ) => update( { left:   v }, 'Position X' ) } />
					<NumField label="Y" value={ Math.round( props.top    ?? 0 ) } onChange={ ( v ) => update( { top:    v }, 'Position Y' ) } />
					<NumField label="W" value={ Math.round( props.width  ?? 0 ) } onChange={ ( v ) => update( { width:  v }, 'Width' ) } />
					<NumField label="H" value={ Math.round( props.height ?? 0 ) } onChange={ ( v ) => update( { height: v }, 'Height' ) } />
					<NumField label="°" value={ Math.round( props.angle  ?? 0 ) } onChange={ ( v ) => update( { angle:   v }, 'Rotation' ) } />
					<NumField label="%" value={ Math.round( ( props.opacity ?? 1 ) * 100 ) } min={ 0 } max={ 100 } onChange={ ( v ) => update( { opacity: v / 100 }, 'Opacity' ) } />
				</div>

				{ props.rx !== undefined && (
					<RangeControl
						label={ __( 'Corner Radius', 'socialframe' ) }
						value={ props.rx ?? 0 }
						min={ 0 }
						max={ 200 }
						onChange={ ( v ) => update( { rx: v, ry: v }, 'Corner radius' ) }
						style={ { marginTop: 8 } }
					/>
				) }
			</Accordion>

			<Accordion title={ __( 'Fill', 'socialframe' ) }>
				<ColorRow
					value={ typeof props.fill === 'string' ? props.fill : null }
					onChange={ ( hex ) => update( { fill: hex }, 'Fill color' ) }
					showNone
					noneValue="transparent"
					noneLabel={ __( 'No fill', 'socialframe' ) }
				/>
			</Accordion>

			<Accordion title={ __( 'Stroke', 'socialframe' ) } defaultOpen={ false }>
				<ColorRow
					value={ props.stroke || null }
					onChange={ ( hex ) => update( { stroke: hex }, 'Stroke color' ) }
					style={ { marginBottom: 12 } }
				/>
				<RangeControl
					label={ __( 'Width', 'socialframe' ) }
					value={ props.strokeWidth ?? 0 }
					min={ 0 }
					max={ 50 }
					onChange={ ( v ) => update( { strokeWidth: v }, 'Stroke width' ) }
				/>
			</Accordion>

			<Accordion title={ __( 'Image Fill', 'socialframe' ) } defaultOpen={ false }>
				<div className="socialframe-props__subsection-label">{ __( 'Fit', 'socialframe' ) }</div>
				<div className="socialframe-props__button-group" style={ { flexWrap: 'wrap', marginBottom: 10 } }>
					{ FIT_MODES.map( ( { value, label } ) => (
						<button
							key={ value }
							className={ `socialframe-props__toggle-btn${ fitMode === value ? ' socialframe-props__toggle-btn--active' : '' }` }
							onClick={ () => {
								setFitMode( value );
								if ( props.fill === null ) fabric?.updateShapeImageFit( value );
							} }
						>
							{ label }
						</button>
					) ) }
				</div>
				<Button
					variant="secondary"
					onClick={ handleFillWithImage }
					style={ { width: '100%', justifyContent: 'center' } }
				>
					{ __( 'Fill with Image', 'socialframe' ) }
				</Button>
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
