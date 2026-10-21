import { useEffect, useRef, useState } from '@wordpress/element';
import { TextControl } from '@wordpress/components';

const SETTLE_MS = 400;

/**
 * A number field that applies its value shortly after typing stops, and at
 * once on Enter, blur, or when the panel closes (clicking the canvas
 * deselects the layer and unmounts the panel before blur would fire).
 *
 * @param {Object}                  props
 * @param {string}                  props.label    Field label.
 * @param {number}                  props.value    Current value.
 * @param {number}                  props.min      Lowest value.
 * @param {(value: number) => void} props.onCommit Called with the new value.
 */
export function CommitNumber( { label, value, min = 0, onCommit } ) {
	const [ draft, setDraft ] = useState( String( value ) );
	const live = useRef( { draft, value, onCommit } );
	live.current = { draft, value, onCommit };
	const timer = useRef( 0 );

	useEffect( () => setDraft( String( value ) ), [ value ] );

	/**
	 * Apply the latest draft if it is a new, valid number.
	 *
	 * @return {boolean} True when a value was applied.
	 */
	const flush = () => {
		clearTimeout( timer.current );
		const current = live.current;
		if ( current.draft.trim() === '' ) {
			return false;
		}
		const next = Math.max( min, Math.round( Number( current.draft ) ) );
		if ( ! Number.isFinite( next ) || next === current.value ) {
			return false;
		}
		current.onCommit( next );
		return true;
	};

	// Apply anything still pending when the panel closes.
	useEffect( () => () => flush(), [] ); // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<TextControl
			__next40pxDefaultSize
			__nextHasNoMarginBottom
			type="number"
			min={ min }
			label={ label }
			value={ draft }
			onChange={ ( next ) => {
				setDraft( next );
				live.current.draft = next;
				clearTimeout( timer.current );
				timer.current = setTimeout( flush, SETTLE_MS );
			} }
			onBlur={ () => {
				if ( ! flush() ) {
					setDraft( String( live.current.value ) );
				}
			} }
			onKeyDown={ ( e ) => {
				if ( e.key === 'Enter' ) {
					flush();
				}
			} }
		/>
	);
}
