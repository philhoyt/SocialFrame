import { useState } from '@wordpress/element';
import { Tooltip } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import { NumField } from './NumField';

// Persists across selection changes (component unmount/remount).
// Keyed so multiple independent LinkedNumFields instances stay independent.
const _linked = {};
function usePersistedLinked( key ) {
	const [ linked, setLinkedState ] = useState( () => _linked[ key ] ?? false );
	const setLinked = ( val ) => { _linked[ key ] = val; setLinkedState( val ); };
	return [ linked, setLinked ];
}

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

/**
 * Width + Height NumFields with an aspect-ratio lock toggle between them.
 * Spans both columns when placed inside a .socialframe-num-grid.
 *
 * When linked, both values must be updated atomically. Provide
 * `onChangeBoth(aVal, bVal)` for that; `onChangeA`/`onChangeB` handle
 * independent changes when unlinked.
 *
 * @param {Object}   props
 * @param {string}   props.aLabel
 * @param {number}   props.aValue
 * @param {number}   [props.aMin]
 * @param {number}   [props.aStep=1]
 * @param {Function} props.onChangeA
 * @param {string}   props.bLabel
 * @param {number}   props.bValue
 * @param {number}   [props.bMin]
 * @param {number}   [props.bStep=1]
 * @param {Function} props.onChangeB
 * @param {Function} props.onChangeBoth   Called with (aVal, bVal) when linked.
 * @param {string}   [props.stateKey]    Unique key so state persists across remounts.
 * @param {string}   [props.lockLabel]
 * @param {string}   [props.unlockLabel]
 */
export function LinkedNumFields( {
	aLabel, aValue, aMin, aStep = 1, onChangeA,
	bLabel, bValue, bMin, bStep = 1, onChangeB,
	onChangeBoth,
	stateKey    = 'default',
	lockLabel   = __( 'Lock aspect ratio', 'socialframe' ),
	unlockLabel = __( 'Unlock aspect ratio', 'socialframe' ),
} ) {
	const [ linked, setLinked ] = usePersistedLinked( stateKey );

	function handleA( v ) {
		if ( linked && aValue > 0 ) {
			const newB = Math.round( v * ( bValue / aValue ) );
			onChangeBoth ? onChangeBoth( v, newB ) : ( onChangeA( v ), onChangeB( newB ) );
		} else {
			onChangeA( v );
		}
	}

	function handleB( v ) {
		if ( linked && bValue > 0 ) {
			const newA = Math.round( v * ( aValue / bValue ) );
			onChangeBoth ? onChangeBoth( newA, v ) : ( onChangeA( newA ), onChangeB( v ) );
		} else {
			onChangeB( v );
		}
	}

	return (
		<div className={ `socialframe-linked-numfields${ linked ? ' is-linked' : '' }` }>
			<NumField
				label={ aLabel }
				value={ aValue }
				min={ aMin }
				step={ aStep }
				onChange={ handleA }
			/>
			<Tooltip text={ linked ? unlockLabel : lockLabel }>
				<button
					className={ `socialframe-linked-numfields__btn${ linked ? ' is-linked' : '' }` }
					onClick={ () => setLinked( ! linked ) }
					aria-label={ linked ? unlockLabel : lockLabel }
					aria-pressed={ linked }
				>
					{ linked ? <IconLinked /> : <IconUnlinked /> }
				</button>
			</Tooltip>
			<NumField
				label={ bLabel }
				value={ bValue }
				min={ bMin }
				step={ bStep }
				onChange={ handleB }
			/>
		</div>
	);
}
