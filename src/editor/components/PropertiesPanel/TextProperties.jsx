import { useSelect } from '@wordpress/data';
import { SelectControl, RangeControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';

const { themeColors, themeFonts } = window.socialFrameConfig ?? {};

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
			<div className="socialframe-props__section">
				<p className="socialframe-props__section-title">{ __( 'Text', 'socialframe' ) }</p>

				{ fontOptions.length > 0 && (
					<SelectControl
						label={ __( 'Font', 'socialframe' ) }
						value={ props.fontFamily ?? '' }
						options={ fontOptions }
						onChange={ ( v ) => update( { fontFamily: v }, 'Font family' ) }
					/>
				) }

				<RangeControl
					label={ __( 'Size', 'socialframe' ) }
					value={ props.fontSize ?? 16 }
					min={ 8 }
					max={ 300 }
					onChange={ ( v ) => update( { fontSize: v }, 'Font size' ) }
				/>

				<div className="socialframe-props__section">
					<p className="socialframe-props__section-title">{ __( 'Style', 'socialframe' ) }</p>
					<div className="socialframe-props__button-group">
						<button
							className={ `socialframe-props__toggle-btn${ props.fontWeight === 'bold' ? ' socialframe-props__toggle-btn--active' : '' }` }
							onClick={ () => update(
								{ fontWeight: props.fontWeight === 'bold' ? 'normal' : 'bold' },
								'Bold text'
							) }
						>
							<strong>B</strong>
						</button>
						<button
							className={ `socialframe-props__toggle-btn${ props.fontStyle === 'italic' ? ' socialframe-props__toggle-btn--active' : '' }` }
							onClick={ () => update(
								{ fontStyle: props.fontStyle === 'italic' ? 'normal' : 'italic' },
								'Italic text'
							) }
						>
							<em>I</em>
						</button>
						<button
							className={ `socialframe-props__toggle-btn${ props.underline ? ' socialframe-props__toggle-btn--active' : '' }` }
							onClick={ () => update( { underline: ! props.underline }, 'Underline text' ) }
						>
							<u>U</u>
						</button>
					</div>
				</div>

				<div className="socialframe-props__section">
					<p className="socialframe-props__section-title">{ __( 'Alignment', 'socialframe' ) }</p>
					<div className="socialframe-props__button-group">
						{ [ 'left', 'center', 'right' ].map( ( align ) => (
							<button
								key={ align }
								className={ `socialframe-props__toggle-btn${ props.textAlign === align ? ' socialframe-props__toggle-btn--active' : '' }` }
								onClick={ () => update( { textAlign: align }, `Align ${ align }` ) }
							>
								{ align[0].toUpperCase() }
							</button>
						) ) }
					</div>
				</div>

				<div className="socialframe-props__section">
					<p className="socialframe-props__section-title">{ __( 'Color', 'socialframe' ) }</p>
					<div className="socialframe-color-row">
						{ ( themeColors ?? [] ).map( ( { color, name, slug } ) => (
							<button
								key={ slug }
								className={ `socialframe-color-swatch${ props.fill === color ? ' socialframe-color-swatch--active' : '' }` }
								style={ { background: color } }
								onClick={ () => update( { fill: color }, 'Text color' ) }
								title={ name }
								aria-label={ name }
							/>
						) ) }
					</div>
				</div>

				<div className="socialframe-props__section">
					<p className="socialframe-props__section-title">{ __( 'Background', 'socialframe' ) }</p>
					<div className="socialframe-color-row">
						<button
							className={ `socialframe-color-swatch socialframe-color-swatch--none${ ! props.backgroundColor ? ' socialframe-color-swatch--active' : '' }` }
							onClick={ () => update( { backgroundColor: '' }, 'Text background' ) }
							title={ __( 'None', 'socialframe' ) }
							aria-label={ __( 'None', 'socialframe' ) }
						/>
						{ ( themeColors ?? [] ).map( ( { color, name, slug } ) => (
							<button
								key={ slug }
								className={ `socialframe-color-swatch${ props.backgroundColor === color ? ' socialframe-color-swatch--active' : '' }` }
								style={ { background: color } }
								onClick={ () => update( { backgroundColor: color }, 'Text background' ) }
								title={ name }
								aria-label={ name }
							/>
						) ) }
					</div>
				</div>

				<RangeControl
					label={ __( 'Letter Spacing', 'socialframe' ) }
					value={ props.charSpacing ?? 0 }
					min={ -200 }
					max={ 800 }
					onChange={ ( v ) => update( { charSpacing: v }, 'Letter spacing' ) }
				/>

				<RangeControl
					label={ __( 'Line Height', 'socialframe' ) }
					value={ props.lineHeight ?? 1.16 }
					min={ 0.5 }
					max={ 4 }
					step={ 0.01 }
					onChange={ ( v ) => update( { lineHeight: v }, 'Line height' ) }
				/>

				<RangeControl
					label={ __( 'Opacity', 'socialframe' ) }
					value={ Math.round( ( props.opacity ?? 1 ) * 100 ) }
					min={ 0 }
					max={ 100 }
					onChange={ ( v ) => update( { opacity: v / 100 }, 'Opacity' ) }
				/>
			</div>
		</div>
	);
}
