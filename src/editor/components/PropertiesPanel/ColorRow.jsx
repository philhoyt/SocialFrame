import { __ } from '@wordpress/i18n';
import { ColorPickerButton } from './ColorPickerButton';

const { themeColors } = window.socialFrameConfig ?? {};

/**
 * A standardised color row: custom-picker swatch + theme swatches + optional "none" swatch.
 *
 * The picker button shows the current color when it is a custom (non-theme) value,
 * making it clear which color is active even when it isn't in the theme palette.
 *
 * @param {Object}   props
 * @param {string}   props.value        Current color value (hex string, 'transparent', '' or null).
 * @param {Function} props.onChange     Called with the new color string.
 * @param {boolean}  [props.showNone]   Render a "no color" swatch at the end.
 * @param {string}   [props.noneValue]  Value emitted when none is selected (default '').
 * @param {string}   [props.noneLabel]  Aria-label for the none swatch.
 * @param {string}   [props.pickerLabel] Aria-label for the picker button.
 */
export function ColorRow( {
	value,
	onChange,
	showNone    = false,
	noneValue   = '',
	noneLabel   = __( 'None', 'socialframe' ),
	pickerLabel = __( 'Custom color', 'socialframe' ),
} ) {
	const isNoneActive  = showNone && ( ! value || value === noneValue );
	const isThemeColor  = ( themeColors ?? [] ).some( ( t ) => t.color === value );
	// Show the current color on the picker button only when it is a custom (non-theme) value.
	const pickerColor   = ( ! isThemeColor && value && value !== noneValue ) ? value : null;

	return (
		<div className="socialframe-color-row">
			<ColorPickerButton
				color={ pickerColor }
				onChange={ onChange }
				label={ pickerLabel }
			/>

			{ ( themeColors ?? [] ).map( ( { color, name, slug } ) => (
				<button
					key={ slug }
					className={ `socialframe-color-swatch${ value === color ? ' socialframe-color-swatch--active' : '' }` }
					style={ { background: color } }
					onClick={ () => onChange( color ) }
					title={ name }
					aria-label={ name }
				/>
			) ) }

			{ showNone && (
				<button
					className={ `socialframe-color-swatch socialframe-color-swatch--none${ isNoneActive ? ' socialframe-color-swatch--active' : '' }` }
					onClick={ () => onChange( noneValue ) }
					title={ noneLabel }
					aria-label={ noneLabel }
				/>
			) }
		</div>
	);
}
