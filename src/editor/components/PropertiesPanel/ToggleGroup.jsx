/**
 * A row of mutually exclusive buttons in the panel's toggle style.
 *
 * @param {Object}                                props
 * @param {string}                                props.label    Group label for screen readers.
 * @param {string}                                props.value    Selected value.
 * @param {Array<{value: string, label: string}>} props.options  Choices.
 * @param {(value: string) => void}               props.onChange Called with the picked value.
 */
export function ToggleGroup( { label, value, options, onChange } ) {
	return (
		<div
			className="socialframe-props__button-group"
			role="group"
			aria-label={ label }
		>
			{ options.map( ( option ) => (
				<button
					key={ option.value }
					type="button"
					className={ `socialframe-props__toggle-btn${
						value === option.value
							? ' socialframe-props__toggle-btn--active'
							: ''
					}` }
					aria-pressed={ value === option.value }
					style={ { flex: 1 } }
					onClick={ () => onChange( option.value ) }
				>
					{ option.label }
				</button>
			) ) }
		</div>
	);
}
