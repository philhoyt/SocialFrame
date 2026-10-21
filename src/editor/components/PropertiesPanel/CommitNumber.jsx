import { useEffect, useState } from '@wordpress/element';
import { TextControl } from '@wordpress/components';

/**
 * A number field that commits on blur or Enter, so typing a value is one
 * undo step.
 *
 * @param {Object}                  props
 * @param {string}                  props.label    Field label.
 * @param {number}                  props.value    Current value.
 * @param {number}                  props.min      Lowest value.
 * @param {(value: number) => void} props.onCommit Called with the new value.
 */
export function CommitNumber( { label, value, min = 0, onCommit } ) {
	const [ draft, setDraft ] = useState( String( value ) );
	useEffect( () => setDraft( String( value ) ), [ value ] );

	const commit = () => {
		const next = Math.max( min, Math.round( Number( draft ) ) );
		if ( Number.isFinite( next ) && next !== value ) {
			onCommit( next );
		} else {
			setDraft( String( value ) );
		}
	};

	return (
		<TextControl
			__next40pxDefaultSize
			__nextHasNoMarginBottom
			type="number"
			min={ min }
			label={ label }
			value={ draft }
			onChange={ setDraft }
			onBlur={ commit }
			onKeyDown={ ( e ) => {
				if ( e.key === 'Enter' ) {
					commit();
				}
			} }
		/>
	);
}
