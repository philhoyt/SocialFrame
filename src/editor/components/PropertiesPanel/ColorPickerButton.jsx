import { Dropdown } from '@wordpress/components';
import { ColorPicker } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * A color swatch button that opens a Dropdown with a full hex ColorPicker.
 *
 * @param {Object}   props
 * @param {string}   props.color     Current color value (hex string or null).
 * @param {Function} props.onChange  Called with the new hex string.
 * @param {string}   [props.label]   Accessible label for the swatch button.
 */
export function ColorPickerButton( { color, onChange, label = __( 'Custom color', 'socialframe' ) } ) {
	return (
		<Dropdown
			popoverProps={ { placement: 'left-start' } }
			renderToggle={ ( { isOpen, onToggle } ) => (
				<button
					className={ `socialframe-color-swatch socialframe-color-picker-btn${ ( isOpen || color ) ? ' socialframe-color-swatch--active' : '' }` }
					style={ {
						background:  color || 'transparent',
						borderColor: color ? undefined : '#555',
						borderStyle: color ? undefined : 'dashed',
						position:    'relative',
					} }
					onClick={ onToggle }
					title={ label }
					aria-label={ label }
					aria-expanded={ isOpen }
				>
					{ ! color && (
						<span style={ { fontSize: 14, lineHeight: 1, color: '#888' } }>+</span>
					) }
				</button>
			) }
			renderContent={ () => (
				<div style={ { padding: 8 } }>
					<ColorPicker
						color={ color || '#000000' }
						onChange={ ( hex ) => onChange( hex ) }
						enableAlpha={ false }
						copyFormat="hex"
					/>
				</div>
			) }
		/>
	);
}
