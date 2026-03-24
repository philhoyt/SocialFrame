import { useState } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { RangeControl, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';

const { themeColors } = window.socialFrameConfig ?? {};

const FIT_MODES = [
	{ value: 'cover',   label: __( 'Cover',   'socialframe' ) },
	{ value: 'contain', label: __( 'Contain', 'socialframe' ) },
	{ value: 'fill',    label: __( 'Fill',    'socialframe' ) },
	{ value: 'none',    label: __( 'None',    'socialframe' ) },
];

export function ShapeProperties() {
	const props   = useSelect( ( select ) => select( STORE_KEY ).getSelectionProps() );
	const fabric  = useFabric();
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
			<div className="socialframe-props__section">
				<p className="socialframe-props__section-title">{ __( 'Shape', 'socialframe' ) }</p>

				<div className="socialframe-props__section">
					<p className="socialframe-props__section-title">{ __( 'Fill Color', 'socialframe' ) }</p>
					<div className="socialframe-color-row">
						{ ( themeColors ?? [] ).map( ( { color, name, slug } ) => (
							<button
								key={ slug }
								className={ `socialframe-color-swatch${ props.fill === color ? ' socialframe-color-swatch--active' : '' }` }
								style={ { background: color } }
								onClick={ () => update( { fill: color }, 'Fill color' ) }
								title={ name }
								aria-label={ name }
							/>
						) ) }
						{ /* Transparent / no fill option */ }
						<button
							className={ `socialframe-color-swatch${ ( ! props.fill || props.fill === 'transparent' ) ? ' socialframe-color-swatch--active' : '' }` }
							style={ { background: 'transparent', border: '2px dashed #666' } }
							onClick={ () => update( { fill: 'transparent' }, 'No fill' ) }
							title={ __( 'No fill', 'socialframe' ) }
							aria-label={ __( 'No fill', 'socialframe' ) }
						/>
					</div>
				</div>

				<RangeControl
					label={ __( 'Opacity', 'socialframe' ) }
					value={ Math.round( ( props.opacity ?? 1 ) * 100 ) }
					min={ 0 }
					max={ 100 }
					onChange={ ( v ) => update( { opacity: v / 100 }, 'Opacity' ) }
				/>

				<div className="socialframe-props__section">
					<p className="socialframe-props__section-title">{ __( 'Stroke Color', 'socialframe' ) }</p>
					<div className="socialframe-color-row">
						{ ( themeColors ?? [] ).map( ( { color, name, slug } ) => (
							<button
								key={ slug }
								className={ `socialframe-color-swatch${ props.stroke === color ? ' socialframe-color-swatch--active' : '' }` }
								style={ { background: color } }
								onClick={ () => update( { stroke: color }, 'Stroke color' ) }
								title={ name }
								aria-label={ name }
							/>
						) ) }
					</div>
				</div>

				<RangeControl
					label={ __( 'Stroke Width', 'socialframe' ) }
					value={ props.strokeWidth ?? 0 }
					min={ 0 }
					max={ 50 }
					onChange={ ( v ) => update( { strokeWidth: v }, 'Stroke width' ) }
				/>

				{ /* Corner radius — only for rect shapes */ }
				{ ( props.rx !== undefined ) && (
					<RangeControl
						label={ __( 'Corner Radius', 'socialframe' ) }
						value={ props.rx ?? 0 }
						min={ 0 }
						max={ 200 }
						onChange={ ( v ) => update( { rx: v, ry: v }, 'Corner radius' ) }
					/>
				) }
			</div>
			<div className="socialframe-props__section">
					<p className="socialframe-props__section-title">{ __( 'Image Fill', 'socialframe' ) }</p>
					<div className="socialframe-props__button-group" style={ { flexWrap: 'wrap', gap: 4, marginBottom: 8 } }>
						{ FIT_MODES.map( ( { value, label } ) => (
							<button
								key={ value }
								className={ `socialframe-props__toggle-btn${ fitMode === value ? ' socialframe-props__toggle-btn--active' : '' }` }
								onClick={ () => {
									setFitMode( value );
									if ( props.fill === null ) {
										fabric?.updateShapeImageFit( value );
									}
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
				</div>
		</div>
	);
}
