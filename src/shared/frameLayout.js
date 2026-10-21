/**
 * Frames: a small auto layout, modelled on Penpot's flex layout.
 *
 * A frame is a layer (a Rect, or the artboard) carrying `sfFrame`: a
 * direction, padding, one gap, alignment on both axes, fixed or hug sizing
 * per axis, and an ordered list of child ids. Children carry `sfItem`: fixed
 * or fill width, their intended width, and how text may shrink to fit.
 *
 * The parent's `children` list is the only record of membership and order.
 * Layout runs in three passes: widths from the outside in, heights from the
 * inside out (text can only be measured once its width is known), then
 * positions from the outside in. Everything here is pure except the Fabric
 * adapter at the bottom, so it can be tested without a canvas.
 */

export const ELLIPSIS = '…';

const MIN_FONT = 6;
const MAX_FONT = 1000;
const MAX_SPACE = 5000;
const MAX_SIZE = 10000;
const MAX_GRAPHEMES = 5000;
const SHRINK_STEPS = 8;

/** Most nested frames, layout nodes, and children per frame laid out. */
export const LIMITS = { depth: 8, nodes: 200, children: 100, measures: 400 };

const DIRECTIONS = [ 'column', 'row' ];
const ALIGNS = [ 'start', 'center', 'end' ];
const SIZING = [ 'fixed', 'hug' ];

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
 * One of a list of allowed values, or the first.
 *
 * @param {unknown}  value   Raw value.
 * @param {string[]} allowed Allowed values.
 * @return {string} The value.
 */
function oneOf( value, allowed ) {
	return allowed.includes( value ) ? value : allowed[ 0 ];
}

/**
 * Validate a frame's settings, or null when absent or unusable.
 *
 * @param {unknown} raw The object's sfFrame.
 * @return {Object|null} The frame.
 */
export function readFrame( raw ) {
	if ( ! raw || typeof raw !== 'object' || ! Array.isArray( raw.children ) ) {
		return null;
	}
	const pad = raw.padding ?? {};
	const side = ( v ) => clamp( v, 0, MAX_SPACE, 0 );
	const children = [];
	for ( const id of raw.children ) {
		if ( typeof id === 'string' && id && ! children.includes( id ) ) {
			children.push( id );
		}
	}
	return {
		direction: oneOf( raw.direction, DIRECTIONS ),
		padding: {
			top: side( pad.top ),
			right: side( pad.right ),
			bottom: side( pad.bottom ),
			left: side( pad.left ),
		},
		gap: clamp( raw.gap, 0, MAX_SPACE, 0 ),
		alignX: oneOf( raw.alignX, ALIGNS ),
		alignY: oneOf( raw.alignY, ALIGNS ),
		width: oneOf( raw.width, SIZING ),
		height: oneOf( raw.height, SIZING ),
		children: children.slice( 0, LIMITS.children ),
	};
}

/**
 * Validate a child's layout settings, or null.
 *
 * @param {unknown} raw The object's sfItem.
 * @return {Object|null} The item.
 */
export function readItem( raw ) {
	if ( ! raw || typeof raw !== 'object' ) {
		return null;
	}
	const fontSize = clamp( raw.fontSize, MIN_FONT, MAX_FONT, 0 );
	return {
		width: raw.width === 'fill' ? 'fill' : 'fixed',
		w: clamp( raw.w, 0, MAX_SIZE, 0 ),
		flex: raw.flex === true,
		fontSize,
		minFontSize: clamp(
			raw.minFontSize,
			MIN_FONT,
			fontSize || MAX_FONT,
			MIN_FONT
		),
		maxHeight: clamp( raw.maxHeight, 0, MAX_SIZE, 0 ),
	};
}

/**
 * Whether a Fabric object may be laid out: no rotation or skew, the default
 * top-left origin, and not a group.
 *
 * @param {Object} obj Fabric object (or plain serialized object).
 * @return {boolean} True when it can be in a frame.
 */
export function canJoin( obj ) {
	return (
		!! obj &&
		String( obj.type ).toLowerCase() !== 'group' &&
		String( obj.type ).toLowerCase() !== 'activeselection' &&
		! obj.angle &&
		! obj.skewX &&
		! obj.skewY &&
		( obj.originX ?? 'left' ) === 'left' &&
		( obj.originY ?? 'top' ) === 'top'
	);
}

/**
 * Whether text can shrink and truncate: a wrapping text box without
 * per-character font sizes.
 *
 * @param {Object} obj Fabric object.
 * @return {boolean} True when it can be flexible.
 */
export function canFlex( obj ) {
	if ( String( obj?.type ).toLowerCase() !== 'textbox' ) {
		return false;
	}
	const styles = obj.styles ?? {};
	return ! Object.values( styles ).some( ( line ) =>
		Object.values( line ?? {} ).some( ( s ) => s && 'fontSize' in s )
	);
}

/**
 * Whether an object can hold a layout: a rect or the artboard.
 *
 * @param {Object} obj Fabric object.
 * @return {boolean} True when it can be a frame.
 */
export function canBeFrame( obj ) {
	return (
		!! obj &&
		( obj.isArtboard || String( obj.type ).toLowerCase() === 'rect' ) &&
		canJoin( obj )
	);
}

/**
 * The layout tree of a set of objects.
 *
 * Invalid references are dropped deterministically: duplicate ids, missing
 * children, the artboard as a child, ineligible objects, a second parent
 * (the first frame in object order keeps it), cycles, and anything past the
 * depth, node or children limits.
 *
 * @param {Object[]} objects Objects in z-order, each with id and props.
 * @return {{frames: Map, parent: Map, children: Map, roots: string[], byId: Map, depth: Map}} Tree.
 */
export function readTree( objects ) {
	const byId = new Map();
	const duplicate = new Set();
	for ( const obj of objects ) {
		if ( ! obj?.id ) {
			continue;
		}
		if ( byId.has( obj.id ) ) {
			duplicate.add( obj.id );
		}
		byId.set( obj.id, obj );
	}
	for ( const id of duplicate ) {
		byId.delete( id );
	}

	const frames = new Map();
	for ( const obj of objects ) {
		const frame = canBeFrame( obj ) ? readFrame( obj.sfFrame ) : null;
		if ( frame && byId.get( obj.id ) === obj ) {
			if ( obj.isArtboard ) {
				frame.width = 'fixed';
				frame.height = 'fixed';
			}
			frames.set( obj.id, frame );
		}
	}

	const parent = new Map();
	for ( const [ frameId, frame ] of frames ) {
		for ( const childId of frame.children ) {
			const child = byId.get( childId );
			if (
				! child ||
				child.isArtboard ||
				childId === frameId ||
				parent.has( childId ) ||
				! canJoin( child )
			) {
				continue;
			}
			parent.set( childId, frameId );
		}
	}

	// Break cycles: a frame that reaches itself loses its parent link.
	for ( const id of frames.keys() ) {
		const seen = new Set( [ id ] );
		let up = parent.get( id );
		while ( up !== undefined ) {
			if ( seen.has( up ) ) {
				parent.delete( id );
				break;
			}
			seen.add( up );
			up = parent.get( up );
		}
	}

	const children = new Map();
	for ( const [ frameId, frame ] of frames ) {
		children.set(
			frameId,
			frame.children.filter( ( c ) => parent.get( c ) === frameId )
		);
	}

	// Roots in z-order (the artboard first), then depth and node limits.
	const roots = [ ...frames.keys() ].filter( ( id ) => ! parent.has( id ) );
	roots.sort(
		( a, b ) =>
			( byId.get( b ).isArtboard ? 1 : 0 ) -
			( byId.get( a ).isArtboard ? 1 : 0 )
	);
	const depth = new Map();
	let nodes = 0;
	const walk = ( id, level ) => {
		depth.set( id, level );
		nodes++;
		const kept = [];
		for ( const c of children.get( id ) ?? [] ) {
			const isFrame = frames.has( c );
			if (
				nodes >= LIMITS.nodes ||
				( isFrame && level + 1 >= LIMITS.depth )
			) {
				parent.delete( c );
				continue;
			}
			kept.push( c );
			if ( isFrame ) {
				walk( c, level + 1 );
			} else {
				depth.set( c, level + 1 );
				nodes++;
			}
		}
		children.set( id, kept );
	};
	for ( const root of roots ) {
		walk( root, 0 );
	}

	return { frames, parent, children, roots, byId, depth };
}

/**
 * Pass 1, outside in: each node's width.
 *
 * A fixed frame uses its own width; a hug frame its children's intrinsic
 * widths plus padding and gaps. A fill child takes its parent's content
 * width (column) or an equal share of what is left (row); fill wins over a
 * child frame's own sizing.
 *
 * @param {Object} tree   From readTree().
 * @param {Object} sizes  Node sizes by id: {w, h} (intrinsic, own).
 * @param {string} rootId Root frame id.
 * @param {number} rootW  Root width when fixed.
 * @return {Map<string, number>} Width by id.
 */
export function resolveWidths( tree, sizes, rootId, rootW ) {
	const widths = new Map();

	const intrinsic = ( id ) => {
		const frame = tree.frames.get( id );
		const node = sizes[ id ];
		if ( ! frame && node?.image && node.maxHeight > 0 ) {
			// An image capped by its height is narrower than its slot; size
			// hugging frames to what it draws.
			const { width: natW, height: natH } = node.image;
			const capped =
				natH > 0 ? ( natW * node.maxHeight ) / natH : Infinity;
			return Math.min( node.w ?? 0, capped );
		}
		if ( ! frame || frame.width === 'fixed' ) {
			return node?.w ?? 0;
		}
		const kids = tree.children.get( id ) ?? [];
		const pad = frame.padding.left + frame.padding.right;
		if ( ! kids.length ) {
			return pad;
		}
		const ws = kids.map( intrinsic );
		return frame.direction === 'column'
			? Math.max( ...ws ) + pad
			: ws.reduce( ( a, b ) => a + b, 0 ) +
					frame.gap * ( kids.length - 1 ) +
					pad;
	};

	const assign = ( id, width ) => {
		widths.set( id, Math.max( 0, width ) );
		const frame = tree.frames.get( id );
		if ( ! frame ) {
			return;
		}
		const kids = tree.children.get( id ) ?? [];
		const content = Math.max(
			0,
			width - frame.padding.left - frame.padding.right
		);
		if ( frame.direction === 'column' ) {
			for ( const c of kids ) {
				assign( c, sizes[ c ]?.fill ? content : intrinsic( c ) );
			}
			return;
		}
		const fills = kids.filter( ( c ) => sizes[ c ]?.fill );
		const fixedSum =
			kids
				.filter( ( c ) => ! sizes[ c ]?.fill )
				.reduce( ( sum, c ) => sum + intrinsic( c ), 0 ) +
			frame.gap * Math.max( 0, kids.length - 1 );
		const share = fills.length
			? Math.max( 0, ( content - fixedSum ) / fills.length )
			: 0;
		for ( const c of kids ) {
			assign( c, sizes[ c ]?.fill ? share : intrinsic( c ) );
		}
	};

	const rootFrame = tree.frames.get( rootId );
	assign(
		rootId,
		rootFrame?.width === 'fixed' ? rootW : intrinsic( rootId )
	);
	return widths;
}

/**
 * Pass 2, inside out: each node's height, and the width it actually draws
 * at (an image narrower than its slot, say).
 *
 * @param {Object}                                tree    From readTree().
 * @param {Object}                                sizes   Node sizes by id: {h, image?: {width, height}, maxHeight}.
 * @param {Map}                                   widths  From resolveWidths().
 * @param {string}                                rootId  Root frame id.
 * @param {(id: string, width: number) => number} measure Height of a text at a width.
 * @return {{heights: Map, drawn: Map}} Heights and drawn widths by id.
 */
export function measureHeights( tree, sizes, widths, rootId, measure ) {
	const heights = new Map();
	const drawn = new Map();

	const visit = ( id ) => {
		const width = widths.get( id ) ?? 0;
		const frame = tree.frames.get( id );
		if ( frame ) {
			const kids = tree.children.get( id ) ?? [];
			kids.forEach( visit );
			drawn.set( id, width );
			if ( frame.height === 'fixed' ) {
				heights.set( id, sizes[ id ]?.h ?? 0 );
				return;
			}
			const hs = kids.map( ( c ) => heights.get( c ) ?? 0 );
			const content =
				frame.direction === 'column'
					? hs.reduce( ( a, b ) => a + b, 0 ) +
						frame.gap * Math.max( 0, kids.length - 1 )
					: Math.max( 0, ...hs );
			heights.set(
				id,
				content + frame.padding.top + frame.padding.bottom
			);
			return;
		}
		const node = sizes[ id ] ?? {};
		if ( node.image ) {
			const { width: natW, height: natH } = node.image;
			let scale = natW > 0 ? width / natW : 0;
			if ( node.maxHeight > 0 && natH * scale > node.maxHeight ) {
				scale = node.maxHeight / natH;
			}
			drawn.set( id, natW * scale );
			heights.set( id, natH * scale );
			return;
		}
		drawn.set( id, node.text || node.fill ? width : ( node.w ?? width ) );
		heights.set( id, node.text ? measure( id, width ) : ( node.h ?? 0 ) );
	};

	visit( rootId );
	return { heights, drawn };
}

/**
 * Pass 3, outside in: positions, and overflow per frame and axis.
 *
 * @param {Object}                      tree    From readTree().
 * @param {Map}                         widths  Slot widths.
 * @param {Map}                         heights Heights.
 * @param {Map}                         drawn   Drawn widths.
 * @param {string}                      rootId  Root frame id.
 * @param {{left: number, top: number}} origin  Root position.
 * @return {{positions: Map, overflows: Array<{frameId: string, axis: string, amount: number}>}} Placement.
 */
export function placeTree( tree, widths, heights, drawn, rootId, origin ) {
	const positions = new Map();
	const overflows = [];

	const offset = ( align, space, size ) => {
		if ( align === 'center' ) {
			return ( space - size ) / 2;
		}
		return align === 'end' ? space - size : 0;
	};

	const place = ( id, left, top ) => {
		positions.set( id, { left, top } );
		const frame = tree.frames.get( id );
		if ( ! frame ) {
			return;
		}
		const kids = tree.children.get( id ) ?? [];
		const cx = left + frame.padding.left;
		const cy = top + frame.padding.top;
		const cw = Math.max(
			0,
			( widths.get( id ) ?? 0 ) - frame.padding.left - frame.padding.right
		);
		const ch = Math.max(
			0,
			( heights.get( id ) ?? 0 ) -
				frame.padding.top -
				frame.padding.bottom
		);
		const gaps = frame.gap * Math.max( 0, kids.length - 1 );

		if ( frame.direction === 'column' ) {
			const total =
				kids.reduce( ( s, c ) => s + ( heights.get( c ) ?? 0 ), 0 ) +
				gaps;
			if ( total - ch > 0.5 ) {
				overflows.push( {
					frameId: id,
					axis: 'y',
					amount: total - ch,
				} );
			}
			let y = cy + ( total > ch ? 0 : offset( frame.alignY, ch, total ) );
			for ( const c of kids ) {
				const w = drawn.get( c ) ?? 0;
				place( c, cx + offset( frame.alignX, cw, w ), y );
				y += ( heights.get( c ) ?? 0 ) + frame.gap;
			}
			return;
		}

		const total =
			kids.reduce( ( s, c ) => s + ( drawn.get( c ) ?? 0 ), 0 ) + gaps;
		if ( total - cw > 0.5 ) {
			overflows.push( { frameId: id, axis: 'x', amount: total - cw } );
		}
		const tallest = Math.max(
			0,
			...kids.map( ( c ) => heights.get( c ) ?? 0 )
		);
		if ( tallest - ch > 0.5 ) {
			overflows.push( { frameId: id, axis: 'y', amount: tallest - ch } );
		}
		let x = cx + ( total > cw ? 0 : offset( frame.alignX, cw, total ) );
		for ( const c of kids ) {
			const h = heights.get( c ) ?? 0;
			place( c, x, cy + offset( frame.alignY, ch, h ) );
			x += ( drawn.get( c ) ?? 0 ) + frame.gap;
		}
	};

	place( rootId, origin.left, origin.top );
	return { positions, overflows };
}

/**
 * Flexible text a frame owns: descendants reached through children whose
 * height follows their content. Text behind a fixed-height child frame
 * belongs to that frame.
 *
 * @param {Object} tree    From readTree().
 * @param {string} frameId Frame id.
 * @param {Object} sizes   Node sizes by id (flex flag).
 * @return {string[]} Ids in layout order.
 */
export function ownedFlex( tree, frameId, sizes ) {
	const owned = [];
	const visit = ( id ) => {
		for ( const c of tree.children.get( id ) ?? [] ) {
			const frame = tree.frames.get( c );
			if ( frame ) {
				if ( frame.height !== 'fixed' ) {
					visit( c );
				}
			} else if ( sizes[ c ]?.flex ) {
				owned.push( c );
			}
		}
	};
	visit( frameId );
	return owned;
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
 * Fit flexible text into a frame.
 *
 * 1. At base sizes, stop if it fits.
 * 2. Shrink every flexible text together towards its minimum size; the
 *    largest fitting step is found by binary search.
 * 3. Still too tall at minimum sizes: truncate from the last flexible text
 *    upwards, cutting at word boundaries and then graphemes.
 * 4. If it still overflows, report it.
 *
 * `overflowFor( fontSizes, texts )` returns the frame's overflow with those
 * overrides; it is called a bounded number of times.
 *
 * @param {Array<{id: string, fontSize: number, minFontSize: number}>} flex        Flexible texts in layout order.
 * @param {Object}                                                     texts       Full text by id.
 * @param {(sizes: Object, texts: Object) => number}                   overflowFor Overflow with overrides.
 * @return {{fontSizes: Object, texts: Object, overflow: number, truncated: string[]}} Result.
 */
export function fitFrame( flex, texts, overflowFor ) {
	const sizesAt = ( t ) =>
		Object.fromEntries(
			flex.map( ( f ) => [
				f.id,
				Math.round(
					f.minFontSize + t * ( f.fontSize - f.minFontSize )
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
	const atBase = overflowFor( base, {} );
	if ( atBase <= 0 || ! flex.length ) {
		return result( base, {}, atBase );
	}

	const smallest = sizesAt( 0 );
	if ( overflowFor( smallest, {} ) <= 0 ) {
		let lo = 0;
		let hi = 1;
		for ( let i = 0; i < SHRINK_STEPS; i++ ) {
			const mid = ( lo + hi ) / 2;
			if ( overflowFor( sizesAt( mid ), {} ) <= 0 ) {
				lo = mid;
			} else {
				hi = mid;
			}
		}
		return result( sizesAt( lo ), {}, 0 );
	}

	const values = {};
	const truncated = [];
	for ( const f of [ ...flex ].reverse() ) {
		const parts = graphemes( String( texts[ f.id ] ?? '' ) ).slice(
			0,
			MAX_GRAPHEMES
		);
		const fits = ( count ) =>
			overflowFor( smallest, {
				...values,
				[ f.id ]: cut( parts, count ),
			} ) <= 0;

		const breaks = [ 0 ];
		parts.forEach( ( g, i ) => {
			if ( /\s/.test( g ) ) {
				breaks.push( i );
			}
		} );
		const lastBreak = searchLast( 0, breaks.length - 1, ( i ) =>
			fits( breaks[ i ] )
		);

		truncated.push( f.id );
		if ( lastBreak < 0 ) {
			values[ f.id ] = '';
			continue;
		}
		const from = breaks[ lastBreak ];
		const to =
			lastBreak + 1 < breaks.length
				? breaks[ lastBreak + 1 ]
				: parts.length;
		values[ f.id ] = cut( parts, searchLast( from, to, fits ) );
		return result(
			smallest,
			values,
			overflowFor( smallest, values ),
			truncated
		);
	}

	return result(
		smallest,
		values,
		overflowFor( smallest, values ),
		truncated
	);
}

/**
 * Geometry for an image shown whole inside a box: as wide as the box allows,
 * never taller than it, centred horizontally. Mirrors FieldFiller.
 *
 * @param {{width: number, height: number}}               natural Image size.
 * @param {{left: number, width: number, height: number}} box     Box.
 * @return {Object|null} Fabric props, or null for unusable sizes.
 */
export function containInBox( natural, box ) {
	const natW = Number( natural?.width );
	const natH = Number( natural?.height );
	if ( ! ( natW > 0 && natH > 0 ) || ! box ) {
		return null;
	}
	const scale = Math.min(
		box.width / natW,
		( box.height > 0 ? box.height : Infinity ) / natH
	);
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
 * Lay out every frame on a Fabric canvas.
 *
 * Sets members' positions, text widths and flexible font sizes, image scale,
 * and hug frames' sizes. With `truncate`, flexible text that still does not
 * fit is shortened with an ellipsis. `restore()` puts back every property
 * the layout changed.
 *
 * @param {Object}  canvas           Fabric canvas.
 * @param {Object}  options          Options.
 * @param {boolean} options.truncate Shorten text that does not fit.
 * @return {{overflows: Array, truncated: string[], restore: () => void}} Result.
 */
export function applyFrameLayout( canvas, { truncate = false } = {} ) {
	const objects = canvas?.getObjects?.() ?? [];
	const tree = readTree( objects );
	const none = { overflows: [], truncated: [], restore: () => {} };
	if ( ! tree.roots.length ) {
		return none;
	}

	// Every property the layout may change, recorded before it changes.
	const saved = new Map();
	const KEYS = [
		'left',
		'top',
		'width',
		'height',
		'scaleX',
		'scaleY',
		'cropX',
		'cropY',
		'fontSize',
		'text',
	];
	const touch = ( obj ) => {
		if ( ! saved.has( obj ) ) {
			saved.set(
				obj,
				Object.fromEntries(
					KEYS.filter( ( k ) => obj[ k ] !== undefined ).map(
						( k ) => [ k, obj[ k ] ]
					)
				)
			);
		}
	};
	const restore = () => {
		for ( const [ obj, values ] of saved ) {
			obj.set( values );
			obj.initDimensions?.();
			obj.setCoords?.();
		}
	};

	try {
		return layoutAll( tree, truncate, touch, restore );
	} catch ( error ) {
		restore();
		throw error;
	}
}

/**
 * Lay out every root of a tree. Split out of applyFrameLayout() so that an
 * error anywhere restores the canvas.
 *
 * @param {Object}                tree     From readTree().
 * @param {boolean}               truncate Shorten text that does not fit.
 * @param {(obj: Object) => void} touch    Records an object before it changes.
 * @param {() => void}            restore  Puts recorded objects back.
 * @return {{overflows: Array, truncated: string[], restore: () => void}} Result.
 */
function layoutAll( tree, truncate, touch, restore ) {
	const { byId } = tree;
	let budget = LIMITS.measures;
	const overflows = [];
	const truncated = [];

	// Per-node inputs, read once.
	const sizes = {};
	const fullText = {};
	for ( const [ id, obj ] of byId ) {
		const frame = tree.frames.get( id );
		const item = tree.parent.has( id ) ? readItem( obj.sfItem ) : null;
		const isText = obj.text !== undefined;
		const isImage = ! frame && String( obj.type ).toLowerCase() === 'image';
		const el = isImage ? obj.getElement?.() : null;
		// The element's natural size, so a cropped image is shown whole.
		const natural = isImage
			? {
					width: el?.naturalWidth || obj.width,
					height: el?.naturalHeight || obj.height,
				}
			: null;
		const ownW = frame
			? ( obj.width ?? 0 ) * ( obj.scaleX ?? 1 )
			: ( obj.getScaledWidth?.() ?? 0 );
		sizes[ id ] = {
			fill: item?.width === 'fill',
			w: item?.w || ( isText ? obj.width : ownW ),
			h: frame
				? ( obj.height ?? 0 ) * ( obj.scaleY ?? 1 )
				: ( obj.getScaledHeight?.() ?? 0 ),
			text: isText,
			flex: isText && !! item?.flex && canFlex( obj ),
			fontSize: item?.fontSize || obj.fontSize,
			minFontSize: item?.minFontSize ?? MIN_FONT,
			image: natural,
			maxHeight: item?.maxHeight ?? 0,
		};
		if ( isText ) {
			fullText[ id ] = obj.text;
		}
	}

	const fontSizes = {};
	const texts = {};
	const measureText = ( id, width, overrideSize, overrideText ) => {
		const obj = byId.get( id );
		budget--;
		const values = { width };
		const size =
			overrideSize ??
			fontSizes[ id ] ??
			( sizes[ id ].flex ? sizes[ id ].fontSize : undefined );
		if ( size !== undefined ) {
			values.fontSize = size;
		}
		values.text =
			overrideText ??
			( truncate ? texts[ id ] : undefined ) ??
			fullText[ id ];
		touch( obj );
		obj.set( values );
		obj.initDimensions?.();
		return obj.getScaledHeight();
	};

	for ( const rootId of tree.roots ) {
		const root = byId.get( rootId );
		const rootW = ( root.width ?? 0 ) * ( root.scaleX ?? 1 );
		const widths = resolveWidths( tree, sizes, rootId, rootW );

		// Fit fixed-height frames, innermost first.
		const order = [];
		const collect = ( id ) => {
			for ( const c of tree.children.get( id ) ?? [] ) {
				if ( tree.frames.has( c ) ) {
					collect( c );
				}
			}
			order.push( id );
		};
		collect( rootId );

		for ( const frameId of order ) {
			const frame = tree.frames.get( frameId );
			if ( frame.height !== 'fixed' ) {
				continue;
			}
			const flex = ownedFlex( tree, frameId, sizes ).map( ( id ) => ( {
				id,
				fontSize: sizes[ id ].fontSize,
				minFontSize: Math.min(
					sizes[ id ].minFontSize,
					sizes[ id ].fontSize
				),
			} ) );
			if ( ! flex.length ) {
				continue;
			}
			const overflowFor = ( sizeOverride, textOverride ) => {
				if ( budget <= 0 ) {
					return 0;
				}
				const { heights, drawn } = measureHeights(
					tree,
					sizes,
					widths,
					frameId,
					( id, width ) =>
						measureText(
							id,
							width,
							sizeOverride[ id ],
							textOverride[ id ]
						)
				);
				const placed = placeTree(
					tree,
					widths,
					heights,
					drawn,
					frameId,
					{
						left: 0,
						top: 0,
					}
				);
				return placed.overflows
					.filter( ( o ) => o.frameId === frameId && o.axis === 'y' )
					.reduce( ( s, o ) => s + o.amount, 0 );
			};
			const fit = fitFrame( flex, fullText, overflowFor );
			Object.assign( fontSizes, fit.fontSizes );
			Object.assign( texts, fit.texts );
			truncated.push( ...fit.truncated );
		}

		// Final measure and placement with the fitted sizes.
		const { heights, drawn } = measureHeights(
			tree,
			sizes,
			widths,
			rootId,
			( id, width ) => measureText( id, width )
		);
		const placed = placeTree( tree, widths, heights, drawn, rootId, {
			left: root.left ?? 0,
			top: root.top ?? 0,
		} );
		overflows.push( ...placed.overflows );

		for ( const [ id, pos ] of placed.positions ) {
			const obj = byId.get( id );
			const frame = tree.frames.get( id );
			touch( obj );
			if ( id !== rootId ) {
				obj.set( { left: pos.left, top: pos.top } );
			}
			if ( frame && ! obj.isArtboard ) {
				obj.set( {
					width: widths.get( id ),
					height: heights.get( id ),
					scaleX: 1,
					scaleY: 1,
				} );
			} else if (
				sizes[ id ]?.fill &&
				! sizes[ id ].text &&
				! sizes[ id ].image
			) {
				// A fill shape stretches to its slot.
				obj.set( { width: widths.get( id ) / ( obj.scaleX || 1 ) } );
			} else if ( sizes[ id ]?.image ) {
				const { width: natW, height: natH } = sizes[ id ].image;
				const scale = natW > 0 ? ( drawn.get( id ) ?? 0 ) / natW : 1;
				obj.set( {
					width: natW,
					height: natH,
					cropX: 0,
					cropY: 0,
					scaleX: scale,
					scaleY: scale,
				} );
			}
			obj.setCoords?.();
		}
	}

	return {
		overflows,
		truncated: [ ...new Set( truncated ) ],
		restore,
	};
}
