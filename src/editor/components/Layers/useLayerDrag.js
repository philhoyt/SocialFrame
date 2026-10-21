import { useCallback, useRef, useState } from '@wordpress/element';
import { __, sprintf, _n } from '@wordpress/i18n';

import { resolveDrop, rootsOf } from '../../utils/layerTree';

export const DRAG_TYPE = 'application/x-socialframe-layers';
const EDGE = 32;

/**
 * Which part of a row the pointer is over.
 *
 * @param {DragEvent} e       Drag event on a row.
 * @param {boolean}   canNest Whether the row accepts layers inside it.
 * @return {string} 'before', 'after' or 'inside'.
 */
function zoneOf( e, canNest ) {
	const box = e.currentTarget.getBoundingClientRect();
	const y = ( e.clientY - box.top ) / box.height;
	if ( canNest ) {
		if ( y < 0.25 ) {
			return 'before';
		}
		return y > 0.75 ? 'after' : 'inside';
	}
	return y < 0.5 ? 'before' : 'after';
}

/**
 * Drag and drop for the Layers tree.
 *
 * Only drags that started in the tree are accepted (a custom MIME type plus
 * in-memory state); the drop is checked again when it happens rather than
 * trusting the indicator.
 *
 * @param {Object}                                  options
 * @param {Object[]}                                options.rows      All rows.
 * @param {string[]}                                options.selected  Selected ids.
 * @param {Set}                                     options.collapsed Collapsed frame ids.
 * @param {(ids: string[], target: Object) => void} options.onDrop    Called with the dragged ids and where they land.
 * @return {Object} Row props and the current indicator.
 */
export function useLayerDrag( { rows, selected, collapsed, onDrop } ) {
	const drag = useRef( null );
	const [ indicator, setIndicator ] = useState( null );

	const clear = useCallback( () => {
		drag.current = null;
		setIndicator( null );
	}, [] );

	const target = useCallback(
		( e, row ) => {
			if ( ! drag.current ) {
				return null;
			}
			const zone = zoneOf( e, row.isFrame || row.kind === 'artboard' );
			const where = resolveDrop(
				rows,
				drag.current,
				row.id,
				zone,
				collapsed
			);
			return where ? { zone, where } : null;
		},
		[ rows, collapsed ]
	);

	const rowProps = ( row ) => ( {
		draggable: row.kind !== 'artboard',
		onDragStart: ( e ) => {
			const ids = selected.includes( row.id )
				? rootsOf( rows, selected )
				: [ row.id ];
			drag.current = ids;
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData( DRAG_TYPE, JSON.stringify( ids ) );
			e.dataTransfer.setData(
				'text/plain',
				sprintf(
					/* translators: %d: number of layers being dragged. */
					_n( '%d layer', '%d layers', ids.length, 'socialframe' ),
					ids.length
				)
			);
		},
		onDragOver: ( e ) => {
			if ( ! e.dataTransfer.types.includes( DRAG_TYPE ) ) {
				return;
			}
			const hit = target( e, row );
			if ( ! hit ) {
				setIndicator( null );
				return;
			}
			e.preventDefault();
			e.dataTransfer.dropEffect = 'move';
			setIndicator( ( prev ) =>
				prev?.id === row.id && prev.zone === hit.zone
					? prev
					: { id: row.id, zone: hit.zone }
			);
		},
		onDrop: ( e ) => {
			const hit = target( e, row );
			const ids = drag.current;
			clear();
			if ( ! hit || ! ids ) {
				return;
			}
			e.preventDefault();
			onDrop( ids, hit.where );
		},
		onDragEnd: clear,
	} );

	/**
	 * Scroll the list while dragging near its top or bottom edge.
	 *
	 * @param {DragEvent} e Drag event on the list.
	 */
	const onListDragOver = ( e ) => {
		if ( ! drag.current ) {
			return;
		}
		const box = e.currentTarget.getBoundingClientRect();
		if ( e.clientY < box.top + EDGE ) {
			e.currentTarget.scrollTop -= 8;
		} else if ( e.clientY > box.bottom - EDGE ) {
			e.currentTarget.scrollTop += 8;
		}
	};

	return {
		rowProps,
		indicator,
		onListDragOver,
		onListDragLeave: ( e ) => {
			if ( ! e.currentTarget.contains( e.relatedTarget ) ) {
				setIndicator( null );
			}
		},
		cancel: clear,
		label: __( 'Drag to reorder or move into a frame', 'socialframe' ),
	};
}
