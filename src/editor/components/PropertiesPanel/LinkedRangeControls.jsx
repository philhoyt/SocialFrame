import { useState } from '@wordpress/element';
import { RangeControl, Tooltip } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

const IconLinked = () => (
	<svg width="12" height="16" viewBox="0 0 12 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<rect x="2" y="1" width="8" height="4.5" rx="2.25"/>
		<line x1="2.75" y1="5.5" x2="2.75" y2="10.5"/>
		<line x1="9.25" y1="5.5" x2="9.25" y2="10.5"/>
		<rect x="2" y="10.5" width="8" height="4.5" rx="2.25"/>
	</svg>
);

const IconUnlinked = () => (
	<svg width="12" height="16" viewBox="0 0 12 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<rect x="2" y="1" width="8" height="4.5" rx="2.25"/>
		<line x1="2.75" y1="5.5" x2="2.75" y2="7"/>
		<line x1="9.25" y1="5.5" x2="9.25" y2="7"/>
		<line x1="2.75" y1="9" x2="2.75" y2="10.5"/>
		<line x1="9.25" y1="9" x2="9.25" y2="10.5"/>
		<rect x="2" y="10.5" width="8" height="4.5" rx="2.25"/>
	</svg>
);

function clamp( v, min, max ) {
	if ( min !== undefined && v < min ) return min;
	if ( max !== undefined && v > max ) return max;
	return v;
}

/**
 * Two RangeControls with an optional link toggle between them.
 * When linked, adjusting one value shifts the other by the same delta.
 *
 * When linked, both values must be updated atomically to avoid stale-closure
 * issues in the parent. Provide `onChangeBoth(aVal, bVal)` for that case;
 * `onChangeA` / `onChangeB` are still called when unlinked.
 *
 * @param {Object}   props
 * @param {string}   props.aLabel
 * @param {number}   props.aValue
 * @param {number}   [props.aMin]
 * @param {number}   [props.aMax]
 * @param {number}   [props.aStep=1]
 * @param {Function} props.onChangeA       Called when only A changes (unlinked).
 * @param {string}   props.bLabel
 * @param {number}   props.bValue
 * @param {number}   [props.bMin]
 * @param {number}   [props.bMax]
 * @param {number}   [props.bStep=1]
 * @param {Function} props.onChangeB       Called when only B changes (unlinked).
 * @param {Function} props.onChangeBoth    Called with (aVal, bVal) when linked.
 * @param {string}   [props.lockLabel]     Tooltip shown when unlinked.
 * @param {string}   [props.unlockLabel]   Tooltip shown when linked.
 */
export function LinkedRangeControls( {
	aLabel, aValue, aMin, aMax, aStep = 1, onChangeA,
	bLabel, bValue, bMin, bMax, bStep = 1, onChangeB,
	onChangeBoth,
	lockLabel   = __( 'Lock aspect ratio', 'socialframe' ),
	unlockLabel = __( 'Unlock aspect ratio', 'socialframe' ),
} ) {
	const [ linked, setLinked ] = useState( false );

	function handleA( v ) {
		if ( linked ) {
			const newB = clamp( bValue + ( v - aValue ), bMin, bMax );
			onChangeBoth ? onChangeBoth( v, newB ) : ( onChangeA( v ), onChangeB( newB ) );
		} else {
			onChangeA( v );
		}
	}

	function handleB( v ) {
		if ( linked ) {
			const newA = clamp( aValue + ( v - bValue ), aMin, aMax );
			onChangeBoth ? onChangeBoth( newA, v ) : ( onChangeA( newA ), onChangeB( v ) );
		} else {
			onChangeB( v );
		}
	}

	return (
		<div className={ `socialframe-linked-controls${ linked ? ' is-linked' : '' }` }>
			<RangeControl
				label={ aLabel }
				value={ aValue }
				min={ aMin }
				max={ aMax }
				step={ aStep }
				onChange={ handleA }
			/>
			<div className="socialframe-linked-controls__bar">
				<Tooltip text={ linked ? unlockLabel : lockLabel }>
					<button
						className={ `socialframe-linked-controls__btn${ linked ? ' is-linked' : '' }` }
						onClick={ () => setLinked( ! linked ) }
						aria-label={ linked ? unlockLabel : lockLabel }
						aria-pressed={ linked }
					>
						{ linked ? <IconLinked /> : <IconUnlinked /> }
					</button>
				</Tooltip>
			</div>
			<RangeControl
				value={ bValue }
				min={ bMin }
				max={ bMax }
				step={ bStep }
				onChange={ handleB }
			/>
			<div className="socialframe-linked-controls__b-label">{ bLabel }</div>
		</div>
	);
}
