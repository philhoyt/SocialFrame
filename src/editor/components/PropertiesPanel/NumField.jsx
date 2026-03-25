import { useRef, useEffect } from '@wordpress/element';

/**
 * Compact labeled number input with Figma-style drag-to-scrub.
 *
 * - Hover anywhere on the field to get an ew-resize cursor.
 * - Click (no drag) → selects the text for immediate typing.
 * - Hold and drag horizontally → scrubs the value.
 * - Press Enter while typing → commits and blurs.
 *
 * @param {Object}   props
 * @param {string}   props.label            Short label shown before the input (e.g. "X", "W", "°").
 * @param {number}   props.value
 * @param {Function} props.onChange         Called with the new numeric value.
 * @param {boolean}  [props.readOnly=false]
 * @param {number}   [props.step=1]
 * @param {number}   [props.min]
 * @param {number}   [props.max]
 */
export function NumField( {
	label,
	value,
	onChange,
	readOnly = false,
	step = 1,
	min,
	max,
} ) {
	const inputRef = useRef( null );

	// Always-current prop values for use inside the stable document handlers.
	const liveRef = useRef( {} );
	liveRef.current = { value, onChange, step, min, max };

	// Drag state: null when idle, object when a mousedown is active.
	const dragRef = useRef( null );

	// Stable document-level handlers created once per mount.
	// They read from liveRef/dragRef so they never capture stale values.
	const stable = useRef( null );
	if ( ! stable.current ) {
		const onMove = ( e ) => {
			const d = dragRef.current;
			if ( ! d ) {
				return;
			}

			const dx = e.clientX - d.startX;
			if ( Math.abs( dx ) > 2 ) {
				d.moved = true;
			}
			if ( ! d.moved ) {
				return;
			}

			const { onChange, step, min, max } = liveRef.current;

			// Scale sensitivity so sub-1 step fields (e.g. line-height 0.01)
			// don't jump by huge amounts per pixel.
			const sensitivity = step < 1 ? 0.1 : 1;
			let v = d.startValue + dx * sensitivity;
			if ( min !== undefined ) {
				v = Math.max( min, v );
			}
			if ( max !== undefined ) {
				v = Math.min( max, v );
			}

			// Snap to nearest step, strip floating-point noise.
			const snapped = Math.round( v / step ) * step;
			onChange( parseFloat( snapped.toFixed( 10 ) ) );
		};

		const onUp = () => {
			document.removeEventListener( 'mousemove', onMove );
			document.removeEventListener( 'mouseup', onUp );
			document.body.style.cursor = '';
			document.body.style.userSelect = '';

			if ( ! dragRef.current?.moved ) {
				// Tap without drag → enter edit mode.
				inputRef.current?.select();
			}
			dragRef.current = null;
		};

		stable.current = { onMove, onUp };
	}

	// Remove listeners if the component unmounts mid-drag.
	useEffect(
		() => () => {
			document.removeEventListener( 'mousemove', stable.current.onMove );
			document.removeEventListener( 'mouseup', stable.current.onUp );
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
		},
		[]
	);

	function onMouseDown( e ) {
		if ( readOnly || e.button !== 0 ) {
			return;
		}
		// Prevent the label from auto-focusing the input; we handle focus
		// ourselves in onUp (select on tap, nothing on drag).
		e.preventDefault();
		dragRef.current = {
			startX: e.clientX,
			startValue: liveRef.current.value,
			moved: false,
		};
		document.body.style.cursor = 'ew-resize';
		document.body.style.userSelect = 'none';
		document.addEventListener( 'mousemove', stable.current.onMove );
		document.addEventListener( 'mouseup', stable.current.onUp );
	}

	function onKeyDown( e ) {
		if ( e.key === 'Enter' ) {
			e.preventDefault();
			e.target.blur();
		}
	}

	function onInputChange( e ) {
		const n = parseFloat( e.target.value );
		if ( ! isNaN( n ) ) {
			onChange( n );
		}
	}

	return (
		<label
			className="socialframe-num-field"
			onMouseDown={ onMouseDown }
			style={ { cursor: readOnly ? 'default' : 'ew-resize' } }
		>
			<span className="socialframe-num-field__label">{ label }</span>
			<input
				ref={ inputRef }
				className="socialframe-num-field__input"
				type="number"
				value={ value }
				step={ step }
				min={ min }
				max={ max }
				readOnly={ readOnly }
				onChange={ readOnly ? undefined : onInputChange }
				onKeyDown={ readOnly ? undefined : onKeyDown }
			/>
		</label>
	);
}
