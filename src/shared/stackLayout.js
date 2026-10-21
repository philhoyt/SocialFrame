/**
 * Vertical stack layout.
 *
 * A design can mark layers as members of one vertical stack. The artboard
 * holds the stack (`sfStack`): where it starts, the padding kept clear at the
 * bottom, and an ordered list of rows with the gap above each. Every member
 * (`sfStackItem`) names its row and its offset below the row's top, so layers
 * side by side move together. Stacked images (`sfBox`) keep their aspect ratio
 * inside a maximum box.
 *
 * The functions here are pure so they can be tested without Fabric; the
 * Fabric adapter at the bottom measures objects and applies the result.
 */

export const DEFAULT_BOTTOM = 60;
export const ELLIPSIS = '…';

const MIN_FONT = 6;
const MAX_FONT = 1000;
const MAX_SPACE = 5000;
const MAX_GRAPHEMES = 5000;
const SHRINK_STEPS = 8;
const TEXT_TYPES = [ 'textbox' ];

/**
 * A finite number clamped to a range, or a fallback.
 *
 * @param {unknown} value    Raw value.
 * @param {number}  min      Lowest allowed.
 * @param {number}  max      Highest allowed.
 * @param {number}  fallback Used when value is not a finite number.
 * @return {number} The clamped number.
 */
function clamp( value, min, max, fallback ) {
	const n = Number( value );
	if ( ! Number.isFinite( n ) ) {
		return fallback;
	}
	return Math.min( max, Math.max( min, n ) );
}

/**
 * Validate an artboard's stack, or null when it has none or it is unusable.
 *
 * @param {unknown} raw The artboard's sfStack.
 * @return {{top: number, bottom: number, rows: Array<{id: string, gap: number}>}|null} The stack.
 */
export function readStack( raw ) {
	if ( ! raw || typeof raw !== 'object' || ! Array.isArray( raw.rows ) ) {
		return null;
	}
	const seen = new Set();
	const rows = [];
	for ( const row of raw.rows ) {
		const id = typeof row?.id === 'string' ? row.id : '';
		if ( ! id || seen.has( id ) ) {
			continue;
		}
		seen.add( id );
		rows.push( { id, gap: clamp( row.gap, 0, MAX_SPACE, 0 ) } );
	}
	if ( ! rows.length ) {
		return null;
	}
	return {
		top: clamp( raw.top, -MAX_SPACE, MAX_SPACE, 0 ),
		bottom: clamp( raw.bottom, 0, MAX_SPACE, DEFAULT_BOTTOM ),
		rows,
	};
}

/**
 * Validate a member's stack item, or null.
 *
 * @param {unknown} raw The object's sfStackItem.
 * @return {Object|null} The item.
 */
export function readItem( raw ) {
	if ( ! raw || typeof raw !== 'object' || typeof raw.row !== 'string' ) {
		return null;
	}
	const fontSize = clamp( raw.fontSize, MIN_FONT, MAX_FONT, 0 );
	return {
		row: raw.row,
		offset: clamp( raw.offset, 0, MAX_SPACE, 0 ),
		flex: raw.flex === true,
		fontSize,
		minFontSize: clamp(
			raw.minFontSize,
			MIN_FONT,
			fontSize || MAX_FONT,
			MIN_FONT
		),
	};
}

/**
 * Validate an image's maximum box, or null.
 *
 * @param {unknown} raw The object's sfBox.
 * @return {{left: number, width: number, height: number}|null} The box.
 */
export function readBox( raw ) {
	if ( ! raw || typeof raw !== 'object' ) {
		return null;
	}
	const width = clamp( raw.width, 0, 10000, 0 );
	const height = clamp( raw.height, 0, 10000, 0 );
	if ( width <= 0 || height <= 0 ) {
		return null;
	}
	return { left: clamp( raw.left, -10000, 10000, 0 ), width, height };
}

/**
 * Geometry for an image shown whole inside a box: as wide as the box allows,
 * never taller than it, centred horizontally. Mirrors FieldFiller's contain.
 *
 * @param {{width: number, height: number}}               natural Image size.
 * @param {{left: number, width: number, height: number}} box     Maximum box.
 * @return {Object|null} Fabric props, or null for unusable sizes.
 */
export function containInBox( natural, box ) {
	const natW = Number( natural?.width );
	const natH = Number( natural?.height );
	if ( ! ( natW > 0 && natH > 0 ) || ! box ) {
		return null;
	}
	const scale = Math.min( box.width / natW, box.height / natH );
	return {
		width: natW,
		height: natH,
		cropX: 0,
		cropY: 0,
		scaleX: scale,
		scaleY: scale,
		left: box.left + ( box.width - natW * scale ) / 2,
	};
}

/**
 * Members grouped into the stack's rows, in stack order.
 *
 * Members whose row is not in the stack are left out; offsets are shifted so
 * the topmost member of each row sits at offset 0.
 *
 * @param {Object}                            stack   Validated stack.
 * @param {Array<{id: string, item: Object}>} members Members with validated items.
 * @return {Array<{id: string, gap: number, members: Array}>} Rows.
 */
export function groupRows( stack, members ) {
	return stack.rows
		.map( ( row ) => {
			const own = members.filter( ( m ) => m.item.row === row.id );
			const base = own.length
				? Math.min( ...own.map( ( m ) => m.item.offset ) )
				: 0;
			return {
				id: row.id,
				gap: row.gap,
				members: own.map( ( m ) => ( {
					...m,
					item: { ...m.item, offset: m.item.offset - base },
				} ) ),
			};
		} )
		.filter( ( row ) => row.members.length );
}

/**
 * Place rows: each starts its gap below the previous row's bottom (the first
 * below the stack's top).
 *
 * @param {Object} stack   Validated stack.
 * @param {Array}  rows    Rows from groupRows().
 * @param {Object} heights Member heights by id.
 * @param {number} limit   Lowest y the stack may reach.
 * @return {{tops: Object, rowTops: Object, bottom: number, overflow: number}} Placement.
 */
export function computeStack( stack, rows, heights, limit ) {
	const tops = {};
	const rowTops = {};
	let cursor = stack.top;
	for ( const row of rows ) {
		const rowTop = cursor + row.gap;
		rowTops[ row.id ] = rowTop;
		let rowBottom = rowTop;
		for ( const m of row.members ) {
			tops[ m.id ] = rowTop + m.item.offset;
			rowBottom = Math.max(
				rowBottom,
				rowTop + m.item.offset + ( heights[ m.id ] ?? 0 )
			);
		}
		cursor = rowBottom;
	}
	return { tops, rowTops, bottom: cursor, overflow: cursor - limit };
}

/**
 * Split text into graphemes, keeping emoji and combined characters whole.
 *
 * @param {string} text Text.
 * @return {string[]} Graphemes.
 */
function graphemes( text ) {
	if ( typeof Intl !== 'undefined' && Intl.Segmenter ) {
		return Array.from(
			new Intl.Segmenter( undefined, {
				granularity: 'grapheme',
			} ).segment( text ),
			( s ) => s.segment
		);
	}
	return Array.from( text );
}

/**
 * The text cut after `count` graphemes, with an ellipsis.
 *
 * @param {string[]} parts Graphemes.
 * @param {number}   count Graphemes to keep.
 * @return {string} Shortened text.
 */
function cut( parts, count ) {
	return parts.slice( 0, count ).join( '' ).trimEnd() + ELLIPSIS;
}

/**
 * Largest value in [lo, hi] for which test() is true, assuming it is true at
 * lo (monotonic). Returns lo - 1 when even lo fails.
 *
 * @param {number}               lo   Lowest candidate.
 * @param {number}               hi   Highest candidate.
 * @param {(n: number)=>boolean} test Predicate.
 * @return {number} The largest passing value.
 */
function searchLast( lo, hi, test ) {
	if ( ! test( lo ) ) {
		return lo - 1;
	}
	while ( lo < hi ) {
		const mid = Math.ceil( ( lo + hi ) / 2 );
		if ( test( mid ) ) {
			lo = mid;
		} else {
			hi = mid - 1;
		}
	}
	return lo;
}

/**
 * Fit the stack into its limit.
 *
 * 1. At base sizes, stop if it fits.
 * 2. Shrink every flexible text together towards its minimum size; the
 *    largest fitting step is found by binary search.
 * 3. Still too tall at minimum sizes: truncate flexible text from the last in
 *    stack order upwards, cutting at word boundaries and then graphemes.
 * 4. If fixed layers alone overflow, report it and stop.
 *
 * `measure( id, { fontSize, text } )` returns a member's height with those
 * values; omitted values mean the member's own. It is called a bounded number
 * of times: at most SHRINK_STEPS plus about 2·log2(length) per flexible text.
 *
 * @param {Object}                                                             stack   Validated stack.
 * @param {Array}                                                              rows    Rows from groupRows().
 * @param {Object}                                                             texts   Full text of each flexible member by id.
 * @param {number}                                                             limit   Lowest y the stack may reach.
 * @param {(id: string, values: {fontSize?: number, text?: string}) => number} measure Height of a member with given values.
 * @return {{fontSizes: Object, texts: Object, overflow: number, truncated: string[]}} Result.
 */
export function fitStack( stack, rows, texts, limit, measure ) {
	const members = rows.flatMap( ( row ) => row.members );
	const flex = members.filter( ( m ) => m.item.flex && m.item.fontSize > 0 );

	const layout = ( sizes, values ) => {
		const heights = {};
		for ( const m of members ) {
			heights[ m.id ] = measure( m.id, {
				fontSize: sizes[ m.id ],
				text: values[ m.id ],
			} );
		}
		return computeStack( stack, rows, heights, limit );
	};

	const sizesAt = ( t ) =>
		Object.fromEntries(
			flex.map( ( m ) => [
				m.id,
				Math.round(
					m.item.minFontSize +
						t * ( m.item.fontSize - m.item.minFontSize )
				),
			] )
		);

	const result = ( sizes, values, overflow, truncated = [] ) => ( {
		fontSizes: sizes,
		texts: values,
		overflow: Math.max( 0, overflow ),
		truncated,
	} );

	const base = sizesAt( 1 );
	const atBase = layout( base, {} );
	if ( atBase.overflow <= 0 || ! flex.length ) {
		return result( base, {}, atBase.overflow );
	}

	const smallest = sizesAt( 0 );
	if ( layout( smallest, {} ).overflow <= 0 ) {
		let lo = 0;
		let hi = 1;
		for ( let i = 0; i < SHRINK_STEPS; i++ ) {
			const mid = ( lo + hi ) / 2;
			if ( layout( sizesAt( mid ), {} ).overflow <= 0 ) {
				lo = mid;
			} else {
				hi = mid;
			}
		}
		return result( sizesAt( lo ), {}, 0 );
	}

	// Truncate from the last flexible text upwards.
	const values = {};
	const truncated = [];
	for ( const m of [ ...flex ].reverse() ) {
		const parts = graphemes( String( texts[ m.id ] ?? '' ) ).slice(
			0,
			MAX_GRAPHEMES
		);
		const fits = ( count ) =>
			layout( smallest, { ...values, [ m.id ]: cut( parts, count ) } )
				.overflow <= 0;

		// Word boundaries first, then graphemes into the next word.
		const breaks = [ 0 ];
		parts.forEach( ( g, i ) => {
			if ( /\s/.test( g ) ) {
				breaks.push( i );
			}
		} );
		const lastBreak = searchLast( 0, breaks.length - 1, ( i ) =>
			fits( breaks[ i ] )
		);

		truncated.push( m.id );
		if ( lastBreak < 0 ) {
			// Even an ellipsis alone is too tall: empty it and try earlier text.
			values[ m.id ] = '';
			continue;
		}
		const from = breaks[ lastBreak ];
		const to =
			lastBreak + 1 < breaks.length
				? breaks[ lastBreak + 1 ]
				: parts.length;
		const kept = searchLast( from, to, fits );
		values[ m.id ] = cut( parts, kept );
		return result(
			smallest,
			values,
			layout( smallest, values ).overflow,
			truncated
		);
	}

	return result(
		smallest,
		values,
		layout( smallest, values ).overflow,
		truncated
	);
}

/**
 * A new unique row id.
 *
 * @param {Array<{id: string}>} rows Existing rows.
 * @return {string} Id.
 */
function newRowId( rows ) {
	let n = rows.length + 1;
	while ( rows.some( ( r ) => r.id === `r${ n }` ) ) {
		n++;
	}
	return `r${ n }`;
}

/**
 * Current top and bottom of each row, from members' live geometry.
 *
 * @param {Object} stack   Validated stack.
 * @param {Array}  members Members with item, top and height.
 * @return {Array<{id: string, gap: number, top: number, bottom: number}>} Row bounds.
 */
function rowBounds( stack, members ) {
	return stack.rows
		.map( ( row ) => {
			const own = members.filter( ( m ) => m.item.row === row.id );
			if ( ! own.length ) {
				return null;
			}
			return {
				...row,
				top: Math.min( ...own.map( ( m ) => m.top ) ),
				bottom: Math.max( ...own.map( ( m ) => m.top + m.height ) ),
			};
		} )
		.filter( Boolean );
}

/**
 * Rebuild the stack's gaps from where rows currently sit, so a membership
 * change leaves every other layer where it is.
 *
 * @param {number} top    Stack top.
 * @param {Array}  bounds Rows with top and bottom, in stack order.
 * @return {Array<{id: string, gap: number}>} Rows with gaps.
 */
function gapsFromBounds( top, bounds ) {
	let cursor = top;
	return bounds.map( ( row ) => {
		const gap = Math.max( 0, row.top - cursor );
		cursor = row.bottom;
		return { id: row.id, gap };
	} );
}

/**
 * Add a layer to the stack, creating the stack if needed.
 *
 * The layer joins the row it overlaps most vertically, or becomes a new row
 * at its position. Gaps are rebuilt from current positions so nothing else
 * moves.
 *
 * @param {Object|null} stack   Validated stack, or null.
 * @param {Array}       members Current members: {id, item, top, height}.
 * @param {Object}      joiner  The layer: {id, top, height}.
 * @return {{stack: Object, items: Object}} New stack and every member's item by id.
 */
export function joinStack( stack, members, joiner ) {
	const current = stack ?? {
		top: joiner.top,
		bottom: DEFAULT_BOTTOM,
		rows: [],
	};
	const bounds = rowBounds( current, members );

	let target = null;
	let best = 0;
	for ( const row of bounds ) {
		const overlap =
			Math.min( row.bottom, joiner.top + joiner.height ) -
			Math.max( row.top, joiner.top );
		if ( overlap > best ) {
			best = overlap;
			target = row;
		}
	}

	const all = [
		...members,
		{ id: joiner.id, top: joiner.top, height: joiner.height, item: null },
	];
	let rowId;
	let ordered;
	if ( target ) {
		rowId = target.id;
		target.top = Math.min( target.top, joiner.top );
		target.bottom = Math.max( target.bottom, joiner.top + joiner.height );
		ordered = bounds;
	} else {
		rowId = newRowId( current.rows );
		ordered = [
			...bounds,
			{
				id: rowId,
				top: joiner.top,
				bottom: joiner.top + joiner.height,
			},
		].sort( ( a, b ) => a.top - b.top );
	}

	const top = Math.min( current.top, ordered[ 0 ].top );
	const next = {
		top,
		bottom: current.bottom,
		rows: gapsFromBounds( top, ordered ),
	};

	const rowTop = Object.fromEntries(
		ordered.map( ( r ) => [ r.id, r.top ] )
	);
	const items = {};
	for ( const m of all ) {
		const row = m.item ? m.item.row : rowId;
		items[ m.id ] = {
			...( m.item ?? {} ),
			row,
			offset: m.top - rowTop[ row ],
		};
	}

	return { stack: next, items };
}

/**
 * Remove a layer from the stack. An emptied row is dropped and its space
 * folded into the gap of the row below; the last member removes the stack.
 *
 * @param {Object} stack   Validated stack.
 * @param {Array}  members Current members: {id, item, top, height}.
 * @param {string} id      The leaving layer.
 * @return {{stack: Object|null, items: Object}} New stack and remaining items by id.
 */
export function leaveStack( stack, members, id ) {
	const rest = members.filter( ( m ) => m.id !== id );
	if ( ! rest.length ) {
		return { stack: null, items: {} };
	}
	const bounds = rowBounds( stack, rest );
	const next = {
		top: stack.top,
		bottom: stack.bottom,
		rows: gapsFromBounds( stack.top, bounds ),
	};
	const rowTop = Object.fromEntries( bounds.map( ( r ) => [ r.id, r.top ] ) );
	const items = {};
	for ( const m of rest ) {
		items[ m.id ] = { ...m.item, offset: m.top - rowTop[ m.item.row ] };
	}
	return { stack: next, items };
}

/**
 * Swap a row with its neighbour. Gaps stay in place, so the rhythm of the
 * stack is kept and only the content order changes.
 *
 * @param {Object} stack Validated stack.
 * @param {string} rowId Row to move.
 * @param {number} dir   -1 for up, 1 for down.
 * @return {Object} New stack (unchanged when the move is impossible).
 */
export function moveRow( stack, rowId, dir ) {
	const i = stack.rows.findIndex( ( r ) => r.id === rowId );
	const j = i + dir;
	if ( i < 0 || j < 0 || j >= stack.rows.length ) {
		return stack;
	}
	const rows = stack.rows.map( ( r ) => ( { ...r } ) );
	[ rows[ i ].id, rows[ j ].id ] = [ rows[ j ].id, rows[ i ].id ];
	return { ...stack, rows };
}

/**
 * Change a row's gap by a drag distance, never below zero.
 *
 * @param {Object} stack Validated stack.
 * @param {string} rowId Row.
 * @param {number} delta Vertical drag distance.
 * @return {Object} New stack.
 */
export function shiftRowGap( stack, rowId, delta ) {
	return {
		...stack,
		rows: stack.rows.map( ( r ) =>
			r.id === rowId
				? { ...r, gap: clamp( r.gap + delta, 0, MAX_SPACE, 0 ) }
				: r
		),
	};
}

/**
 * Whether a Fabric object may be a stack member.
 *
 * @param {Object} obj Fabric object.
 * @return {boolean} True when it can join.
 */
export function canJoin( obj ) {
	return (
		!! obj &&
		! obj.isArtboard &&
		String( obj.type ).toLowerCase() !== 'group' &&
		! obj.angle &&
		! obj.skewX &&
		! obj.skewY &&
		( obj.originX ?? 'left' ) === 'left' &&
		( obj.originY ?? 'top' ) === 'top'
	);
}

/**
 * Whether a Fabric object's text can shrink and truncate: a wrapping text
 * box without per-character font sizes.
 *
 * @param {Object} obj Fabric object.
 * @return {boolean} True when it can be flexible.
 */
export function canFlex( obj ) {
	if ( ! TEXT_TYPES.includes( String( obj?.type ).toLowerCase() ) ) {
		return false;
	}
	const styles = obj.styles ?? {};
	return ! Object.values( styles ).some( ( line ) =>
		Object.values( line ?? {} ).some( ( s ) => s && 'fontSize' in s )
	);
}

/**
 * Lay out a Fabric canvas's stack.
 *
 * Applies member tops and flexible font sizes. With `truncate`, flexible text
 * that still does not fit is shortened with an ellipsis; call `restore()` to
 * put text, sizes and tops back. `truncated` lists the text that is, or on
 * export would be, shortened.
 *
 * @param {Object}  canvas           Fabric canvas.
 * @param {Object}  options          Options.
 * @param {boolean} options.truncate Shorten text that does not fit.
 * @return {{overflow: number, truncated: string[], limit: number|null, restore: () => void}} Result.
 */
export function applyStackLayout( canvas, { truncate = false } = {} ) {
	const none = {
		overflow: 0,
		truncated: [],
		limit: null,
		restore: () => {},
	};
	const objects = canvas?.getObjects?.() ?? [];
	const artboard = objects.find( ( o ) => o.isArtboard );
	const stack = readStack( artboard?.sfStack );
	if ( ! stack ) {
		return none;
	}

	const byId = {};
	const members = [];
	for ( const obj of objects ) {
		const item = readItem( obj.sfStackItem );
		if ( ! item || ! obj.id || ! canJoin( obj ) ) {
			continue;
		}
		const flex = item.flex && canFlex( obj );
		byId[ obj.id ] = obj;
		members.push( {
			id: obj.id,
			item: {
				...item,
				flex,
				fontSize: flex ? item.fontSize || obj.fontSize : 0,
			},
		} );
	}
	const rows = groupRows( stack, members );
	if ( ! rows.length ) {
		return none;
	}

	const saved = members.map( ( m ) => {
		const obj = byId[ m.id ];
		return { obj, top: obj.top, fontSize: obj.fontSize, text: obj.text };
	} );
	const texts = Object.fromEntries(
		members.map( ( m ) => [ m.id, byId[ m.id ].text ] )
	);

	const set = ( obj, values ) => {
		obj.set( values );
		obj.initDimensions?.();
	};
	const measure = ( id, { fontSize, text } ) => {
		const obj = byId[ id ];
		const values = {};
		if ( fontSize !== undefined ) {
			values.fontSize = fontSize;
		}
		if ( obj.text !== undefined ) {
			values.text = text ?? texts[ id ];
		}
		if ( Object.keys( values ).length ) {
			set( obj, values );
		}
		return obj.getScaledHeight();
	};

	const artboardHeight =
		( artboard.height ?? 0 ) * ( artboard.scaleY ?? 1 ) +
		( artboard.top ?? 0 );
	const limit = artboardHeight - stack.bottom;
	const fit = fitStack( stack, rows, texts, limit, measure );

	const heights = {};
	for ( const m of members ) {
		const obj = byId[ m.id ];
		const values = {};
		if ( fit.fontSizes[ m.id ] !== undefined ) {
			values.fontSize = fit.fontSizes[ m.id ];
		}
		if ( obj.text !== undefined ) {
			values.text =
				truncate && fit.texts[ m.id ] !== undefined
					? fit.texts[ m.id ]
					: texts[ m.id ];
		}
		if ( Object.keys( values ).length ) {
			set( obj, values );
		}
		heights[ m.id ] = obj.getScaledHeight();
	}

	const placed = computeStack( stack, rows, heights, limit );
	for ( const m of members ) {
		byId[ m.id ].set( { top: placed.tops[ m.id ] } );
		byId[ m.id ].setCoords?.();
	}

	// Overflow is what is on the canvas now: without truncation, text that
	// would be shortened on export still overflows, which the editor marks.
	return {
		overflow: Math.max( 0, placed.overflow ),
		truncated: fit.truncated,
		limit,
		restore: () => {
			for ( const s of saved ) {
				const values = { top: s.top };
				if ( s.fontSize !== undefined ) {
					values.fontSize = s.fontSize;
				}
				if ( s.text !== undefined ) {
					values.text = s.text;
				}
				set( s.obj, values );
				s.obj.setCoords?.();
			}
		},
	};
}
