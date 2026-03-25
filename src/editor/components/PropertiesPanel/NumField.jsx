/**
 * Compact labeled number input — mimics Figma's X/Y/W/H fields.
 *
 * @param {Object}   props
 * @param {string}   props.label     Short label shown before the input (e.g. "X", "W", "°").
 * @param {number}   props.value
 * @param {Function} props.onChange  Called with the new numeric value.
 * @param {boolean}  [props.readOnly=false]
 * @param {number}   [props.step=1]
 * @param {number}   [props.min]
 * @param {number}   [props.max]
 */
export function NumField( { label, value, onChange, readOnly = false, step = 1, min, max } ) {
	return (
		<label className="socialframe-num-field">
			<span className="socialframe-num-field__label">{ label }</span>
			<input
				className="socialframe-num-field__input"
				type="number"
				value={ value }
				step={ step }
				min={ min }
				max={ max }
				readOnly={ readOnly }
				onChange={ readOnly ? undefined : ( e ) => onChange( Number( e.target.value ) ) }
			/>
		</label>
	);
}
