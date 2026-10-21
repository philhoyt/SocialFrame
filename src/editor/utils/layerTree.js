/**
 * The Layers panel's tree: rows in display order, and where a dragged
 * selection would land. Pure, so it can be tested without a canvas.
 */
import { readTree } from '../../shared/frameLayout';

/**
 * The kind of a layer for icons and menus.
 *
 * @param {Object} obj Layer.
 * @return {string} 'artboard', 'text', 'image' or 'shape'.
 */
function kindOf( obj ) {
	if ( obj.isArtboard ) {
		return 'artboard';
	}
	const type = String( obj.type ).toLowerCase();
	if ( type === 'textbox' || type === 'i-text' || type === 'text' ) {
		return 'text';
	}
	return type === 'image' ? 'image' : 'shape';
}

/**
 * Rows for the Layers panel, top first.
 *
 * Layers outside a frame are listed in z-order. A frame's layers follow it,
 * one level deeper, in layout order. The artboard is the last row; layers
 * in its content layout stay in z-order and are marked `inLayout`.
 *
 * @param {Object[]} objects Canvas objects in z-order (bottom first).
 * @return {Object[]} Rows.
 */
export function buildRows( objects ) {
	const tree = readTree( objects );
	const ownedByFrame = ( id ) => {
		const p = tree.parent.get( id );
		return p !== undefined && ! tree.byId.get( p )?.isArtboard;
	};
	const rows = [];
	const add = ( obj, depth, parentId, index ) => {
		const kids = tree.children.get( obj.id ) ?? [];
		rows.push( {
			id: obj.id,
			name: obj.name || '',
			kind: kindOf( obj ),
			depth,
			parentId,
			index,
			isFrame: tree.frames.has( obj.id ),
			childCount: obj.isArtboard ? 0 : kids.length,
			inLayout:
				tree.byId.get( tree.parent.get( obj.id ) )?.isArtboard ?? false,
			hasLayout: obj.isArtboard ? tree.frames.has( obj.id ) : false,
			locked: obj.selectable === false,
			visible: obj.visible !== false,
		} );
		if ( obj.isArtboard ) {
			return;
		}
		kids.forEach( ( c, i ) => {
			const child = tree.byId.get( c );
			if ( child ) {
				add( child, depth + 1, obj.id, i );
			}
		} );
	};

	let artboard = null;
	for ( const obj of [ ...objects ].reverse() ) {
		if ( ! obj?.id ) {
			continue;
		}
		if ( obj.isArtboard ) {
			artboard = obj;
			continue;
		}
		if ( ! ownedByFrame( obj.id ) ) {
			add( obj, 0, null, -1 );
		}
	}
	if ( artboard ) {
		add( artboard, 0, null, -1 );
	}
	return rows;
}

/**
 * Rows still shown when some frames are collapsed.
 *
 * @param {Object[]}    rows      From buildRows().
 * @param {Set<string>} collapsed Collapsed frame ids.
 * @return {Object[]} Visible rows.
 */
export function visibleRows( rows, collapsed ) {
	const hidden = new Set();
	return rows.filter( ( row ) => {
		if (
			row.parentId &&
			( hidden.has( row.parentId ) || collapsed.has( row.parentId ) )
		) {
			hidden.add( row.id );
			return false;
		}
		return true;
	} );
}

/**
 * Ids whose frame (or any ancestor) is not also in the set, without the
 * artboard: a frame's layers travel with it.
 *
 * @param {Object[]} rows From buildRows().
 * @param {string[]} ids  Selected ids.
 * @return {string[]} Top-most ids, in tree order.
 */
export function rootsOf( rows, ids ) {
	const byId = new Map( rows.map( ( r ) => [ r.id, r ] ) );
	const set = new Set( ids );
	const inSelectedAncestor = ( id ) => {
		let up = byId.get( id )?.parentId;
		while ( up ) {
			if ( set.has( up ) ) {
				return true;
			}
			up = byId.get( up )?.parentId;
		}
		return false;
	};
	return rows
		.filter(
			( r ) =>
				set.has( r.id ) &&
				r.kind !== 'artboard' &&
				! inSelectedAncestor( r.id )
		)
		.map( ( r ) => r.id );
}

/**
 * Ids from `from` to `to` in visible tree order, for shift-click.
 *
 * @param {Object[]} rows Visible rows.
 * @param {string}   from Anchor id.
 * @param {string}   to   Clicked id.
 * @return {string[]} Ids in the range, without the artboard.
 */
export function rangeOf( rows, from, to ) {
	const a = rows.findIndex( ( r ) => r.id === from );
	const b = rows.findIndex( ( r ) => r.id === to );
	if ( a < 0 || b < 0 ) {
		return [ to ];
	}
	const [ lo, hi ] = a < b ? [ a, b ] : [ b, a ];
	return rows
		.slice( lo, hi + 1 )
		.filter( ( r ) => r.kind !== 'artboard' )
		.map( ( r ) => r.id );
}

/**
 * Where a drop would put the dragged layers, or null when it isn't allowed.
 *
 * - Inside a frame row: the end of that frame. Inside the artboard row: the
 *   end of its content layout, when it has one.
 * - Before or after a layer in a frame: that frame, at that position.
 *   `index` counts the frame's layers with the dragged ones taken out.
 * - After an expanded frame that has layers: the start of that frame.
 * - Before or after a top-level layer: that place in z-order, taking the
 *   layers out of any frame.
 * - Never into a dragged frame or anything inside it, and never the artboard.
 *
 * @param {Object[]}    rows        From buildRows() (all rows, not only visible).
 * @param {string[]}    dragIds     Dragged ids (top-most).
 * @param {string}      overId      Row under the pointer.
 * @param {string}      zone        'before', 'after' or 'inside'.
 * @param {Set<string>} [collapsed] Collapsed frames.
 * @return {Object|null} `{ parentId, index }`, `{ before }`, `{ after }` or `{ edge }`.
 */
export function resolveDrop(
	rows,
	dragIds,
	overId,
	zone,
	collapsed = new Set()
) {
	const byId = new Map( rows.map( ( r ) => [ r.id, r ] ) );
	const over = byId.get( overId );
	const dragged = new Set( dragIds );
	if (
		! over ||
		! dragIds.length ||
		dragIds.some( ( id ) => byId.get( id )?.kind === 'artboard' )
	) {
		return null;
	}

	// Nothing may land in a dragged layer or anything inside it.
	const insideDragged = ( id ) => {
		let cur = id;
		while ( cur ) {
			if ( dragged.has( cur ) ) {
				return true;
			}
			cur = byId.get( cur )?.parentId;
		}
		return false;
	};

	const intoFrame = ( frameId, beforeChildId = null, after = false ) => {
		if ( insideDragged( frameId ) ) {
			return null;
		}
		// The artboard's layout members are listed at the top level.
		const isArtboard = byId.get( frameId )?.kind === 'artboard';
		const siblings = rows.filter(
			( r ) =>
				( isArtboard ? r.inLayout : r.parentId === frameId ) &&
				! dragged.has( r.id )
		);
		let index = siblings.length;
		if ( beforeChildId ) {
			const at = siblings.findIndex( ( r ) => r.id === beforeChildId );
			index = at < 0 ? siblings.length : at + ( after ? 1 : 0 );
		}
		return { parentId: frameId, index };
	};

	if ( over.kind === 'artboard' ) {
		if ( zone === 'before' ) {
			return { edge: 'bottom' };
		}
		return over.hasLayout ? intoFrame( over.id ) : null;
	}
	if ( insideDragged( overId ) ) {
		return null;
	}
	if ( zone === 'inside' ) {
		return over.isFrame ? intoFrame( over.id ) : null;
	}
	if (
		zone === 'after' &&
		over.isFrame &&
		over.childCount > 0 &&
		! collapsed.has( over.id )
	) {
		const first = rows.find(
			( r ) => r.parentId === over.id && ! dragged.has( r.id )
		);
		return intoFrame( over.id, first?.id ?? null );
	}
	if ( over.parentId && byId.get( over.parentId )?.kind !== 'artboard' ) {
		return intoFrame( over.parentId, over.id, zone === 'after' );
	}
	return zone === 'before' ? { before: over.id } : { after: over.id };
}
