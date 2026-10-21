import { useCallback, useEffect, useMemo, useRef } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import * as fabric from 'fabric';

import { STORE_KEY } from '../store';
import {
	applyFrameLayout,
	canBeFrame,
	canFlex,
	canJoin,
	readFrame,
	readItem,
	readTree,
} from '../../shared/frameLayout';

const NONE = { overflows: [], truncated: [], restore: () => {} };

// Geometry a frame operation can change; snapshots restore it on undo.
const GEOMETRY = [
	'left',
	'top',
	'width',
	'height',
	'scaleX',
	'scaleY',
	'cropX',
	'cropY',
	'fontSize',
];

const DEFAULT_FRAME = {
	direction: 'column',
	padding: { top: 0, right: 0, bottom: 0, left: 0 },
	gap: 0,
	alignX: 'start',
	alignY: 'start',
	width: 'hug',
	height: 'hug',
	children: [],
};

let frameCount = 0;

/**
 * A deep copy of plain layout data.
 *
 * @param {Object|undefined} value Data.
 * @return {Object|undefined} Copy.
 */
const copy = ( value ) =>
	value === undefined ? undefined : JSON.parse( JSON.stringify( value ) );

/**
 * Whether a fill colour draws nothing.
 *
 * @param {unknown} fill Fabric fill.
 * @return {boolean} True for no fill.
 */
const isClear = ( fill ) =>
	! fill ||
	fill === 'transparent' ||
	/^rgba\(.*,\s*0(\.0+)?\)$/.test( String( fill ).replace( /\s/g, '' ) );

/**
 * The artboard rect of a canvas.
 *
 * @param {Object} canvas Fabric canvas.
 * @return {Object|undefined} The artboard.
 */
function findArtboard( canvas ) {
	return canvas
		?.getObjects()
		.find( ( o ) => o.isArtboard || o.id === 'artboard' );
}

/**
 * Frames in the editor: keeps the layout current, records frame changes as
 * single undo steps (including objects created or removed), keeps each
 * frame's layers above it, and exposes the operations the panels use.
 *
 * Layout is derived from frame settings, so it never adds history of its
 * own; it re-runs on every store revision (any change, undo or redo), after
 * fonts load, while text is typed, and while a frame is dragged.
 *
 * @param {{current: Object}} fabricRef  Fabric canvas ref.
 * @param {Object}            dispatch   Editor store actions.
 * @param {() => void}        syncLayers Refreshes the Layers panel.
 * @return {Object} Frames API.
 */
export function useFrameLayout( fabricRef, dispatch, syncLayers ) {
	const resultRef = useRef( NONE );
	const frameRef = useRef( 0 );
	const exportingRef = useRef( false );
	const busyRef = useRef( false );
	const revision = useSelect(
		( select ) => select( STORE_KEY ).getRevision(),
		[]
	);

	const run = useCallback( () => {
		const canvas = fabricRef.current;
		if ( ! canvas ) {
			return;
		}
		resultRef.current = applyFrameLayout( canvas );
		canvas.requestRenderAll();
	}, [ fabricRef ] );

	const schedule = useCallback( () => {
		cancelAnimationFrame( frameRef.current );
		frameRef.current = requestAnimationFrame( run );
	}, [ run ] );

	useEffect( () => {
		schedule();
	}, [ revision, schedule ] );

	// Text measured before its web font arrived keeps fallback metrics.
	useEffect( () => {
		const fonts = document.fonts;
		if ( ! fonts ) {
			return;
		}
		let live = true;
		const remeasure = () => {
			if ( ! live || ! fabricRef.current ) {
				return;
			}
			fabric.cache.clearFontCache();
			fabricRef.current
				.getObjects()
				.forEach( ( obj ) => obj.initDimensions?.() );
			schedule();
		};
		fonts.ready.then( remeasure );
		fonts.addEventListener?.( 'loadingdone', remeasure );
		return () => {
			live = false;
			fonts.removeEventListener?.( 'loadingdone', remeasure );
			cancelAnimationFrame( frameRef.current );
		};
	}, [ fabricRef, schedule ] );

	const tree = useCallback(
		() => readTree( fabricRef.current?.getObjects() ?? [] ),
		[ fabricRef ]
	);

	const findObject = useCallback(
		( id ) => fabricRef.current?.getObjects().find( ( o ) => o.id === id ),
		[ fabricRef ]
	);

	const snapshot = useCallback( () => {
		const canvas = fabricRef.current;
		const order = [ ...( canvas?.getObjects() ?? [] ) ];
		const props = new Map();
		for ( const obj of order ) {
			props.set( obj, {
				sfFrame: copy( obj.sfFrame ),
				sfItem: copy( obj.sfItem ),
				...Object.fromEntries(
					GEOMETRY.filter( ( k ) => obj[ k ] !== undefined ).map(
						( k ) => [ k, obj[ k ] ]
					)
				),
			} );
		}
		return { order, props };
	}, [ fabricRef ] );

	const restore = useCallback(
		( snap ) => {
			const canvas = fabricRef.current;
			if ( ! canvas ) {
				return;
			}
			busyRef.current = true;
			try {
				canvas.discardActiveObject();
				const wanted = new Set( snap.order );
				for ( const obj of [ ...canvas.getObjects() ] ) {
					if ( ! wanted.has( obj ) ) {
						canvas.remove( obj );
					}
				}
				const present = new Set( canvas.getObjects() );
				snap.order.forEach( ( obj, i ) => {
					if ( ! present.has( obj ) ) {
						canvas.insertAt( i, obj );
					}
					canvas.moveObjectTo( obj, i );
					const { sfFrame, sfItem, ...geometry } =
						snap.props.get( obj );
					obj.sfFrame = copy( sfFrame );
					obj.sfItem = copy( sfItem );
					obj.set( geometry );
					obj.initDimensions?.();
					obj.setCoords();
				} );
			} finally {
				busyRef.current = false;
			}
			run();
			syncLayers();
			dispatch.clearSelection();
			dispatch.markDirty();
		},
		[ fabricRef, run, syncLayers, dispatch ]
	);

	/**
	 * Keep every frame's layers directly above it. The artboard's own layout
	 * leaves z-order alone, so free layers can stay behind or in front.
	 */
	const normalise = useCallback( () => {
		const canvas = fabricRef.current;
		if ( ! canvas ) {
			return;
		}
		const t = tree();
		const ownedBy = ( id ) => {
			const p = t.parent.get( id );
			return p !== undefined && ! t.byId.get( p )?.isArtboard;
		};
		const desired = [];
		const placed = new Set();
		const emit = ( obj ) => {
			if ( placed.has( obj ) ) {
				return;
			}
			placed.add( obj );
			desired.push( obj );
			for ( const c of t.children.get( obj.id ) ?? [] ) {
				const child = t.byId.get( c );
				if ( child ) {
					emit( child );
				}
			}
		};
		for ( const obj of canvas.getObjects() ) {
			if ( ownedBy( obj.id ) ) {
				continue;
			}
			if ( t.frames.has( obj.id ) && ! obj.isArtboard ) {
				emit( obj );
			} else if ( ! placed.has( obj ) ) {
				placed.add( obj );
				desired.push( obj );
			}
		}
		// Anything skipped (an orphan) keeps its relative place at the end.
		for ( const obj of canvas.getObjects() ) {
			if ( ! placed.has( obj ) ) {
				desired.push( obj );
			}
		}
		busyRef.current = true;
		try {
			desired.forEach( ( obj, i ) => {
				if ( canvas.getObjects()[ i ] !== obj ) {
					canvas.moveObjectTo( obj, i );
				}
			} );
		} finally {
			busyRef.current = false;
		}
	}, [ fabricRef, tree ] );

	/**
	 * Change frames and record the change as one undo step.
	 *
	 * @param {string}               label  History label.
	 * @param {() => (boolean|void)} mutate Applies the change; returns false to cancel.
	 * @param {Object|null}          before Snapshot to undo to (defaults to now).
	 */
	const commit = useCallback(
		( label, mutate, before = null ) => {
			const canvas = fabricRef.current;
			if ( ! canvas ) {
				return;
			}
			const from = before ?? snapshot();
			busyRef.current = true;
			let result;
			try {
				result = mutate();
			} finally {
				busyRef.current = false;
			}
			if ( result === false ) {
				return;
			}
			normalise();
			run();
			syncLayers();
			const to = snapshot();
			dispatch.markDirty();
			dispatch.pushHistory( {
				label,
				undo: () => restore( from ),
				redo: () => restore( to ),
			} );
		},
		[ fabricRef, snapshot, normalise, run, syncLayers, restore, dispatch ]
	);

	/**
	 * The `sfItem` a layer gets when it joins a frame.
	 *
	 * @param {Object} obj Fabric object.
	 * @return {Object} Item.
	 */
	const itemFor = useCallback( ( obj ) => {
		const existing = readItem( obj.sfItem );
		if ( existing ) {
			return { ...obj.sfItem };
		}
		const isText = obj.text !== undefined;
		const isImage = String( obj.type ).toLowerCase() === 'image';
		return {
			width: 'fixed',
			w: Math.round( isText ? obj.width : obj.getScaledWidth() ),
			...( isImage
				? { maxHeight: Math.round( obj.getScaledHeight() ) }
				: {} ),
			...( canFlex( obj )
				? {
						flex: false,
						fontSize: obj.fontSize,
						minFontSize: Math.max(
							6,
							Math.round( obj.fontSize * 0.6 )
						),
					}
				: {} ),
		};
	}, [] );

	/**
	 * Take a layer out of its frame, putting its own font size back.
	 *
	 * @param {Object} t   Tree.
	 * @param {Object} obj Fabric object.
	 */
	const release = useCallback( ( t, obj ) => {
		const parentId = t.parent.get( obj.id );
		const parent = parentId !== undefined ? t.byId.get( parentId ) : null;
		if ( parent?.sfFrame ) {
			parent.sfFrame = {
				...parent.sfFrame,
				children: parent.sfFrame.children.filter(
					( c ) => c !== obj.id
				),
			};
		}
		const item = readItem( obj.sfItem );
		if ( item?.flex && item.fontSize ) {
			obj.set( { fontSize: item.fontSize } );
			obj.initDimensions?.();
		}
		obj.sfItem = undefined;
	}, [] );

	/**
	 * Whether a layer can be put in a frame: eligible, and not the frame
	 * itself or one of its ancestors.
	 *
	 * @param {Object} t       Tree.
	 * @param {string} id      Layer id.
	 * @param {string} frameId Target frame id.
	 * @return {boolean} True when it can be added.
	 */
	const canAdd = ( t, id, frameId ) => {
		const obj = t.byId.get( id );
		if ( ! obj || obj.isArtboard || ! canJoin( obj ) || id === frameId ) {
			return false;
		}
		let up = frameId;
		while ( up !== undefined ) {
			if ( up === id ) {
				return false;
			}
			up = t.parent.get( up );
		}
		return true;
	};

	/**
	 * Why a selection can't become a frame, or '' when it can.
	 *
	 * @param {string[]} ids Selected layer ids.
	 * @return {string} Reason.
	 */
	const createProblem = useCallback(
		( ids ) => {
			const t = tree();
			const objs = ids.map( ( id ) => t.byId.get( id ) );
			if ( ! objs.length || objs.some( ( o ) => ! o || o.isArtboard ) ) {
				return __( 'Select layers on the canvas.', 'socialframe' );
			}
			if ( objs.some( ( o ) => ! canJoin( o ) ) ) {
				return __(
					'Rotated, skewed or grouped layers can’t be in a frame.',
					'socialframe'
				);
			}
			const parents = new Set( ids.map( ( id ) => t.parent.get( id ) ) );
			if ( parents.size > 1 ) {
				return __(
					'These layers are in different frames.',
					'socialframe'
				);
			}
			for ( const id of ids ) {
				let up = t.parent.get( id );
				while ( up !== undefined ) {
					if ( ids.includes( up ) ) {
						return __(
							'A frame and a layer inside it can’t both be selected.',
							'socialframe'
						);
					}
					up = t.parent.get( up );
				}
			}
			return '';
		},
		[ tree ]
	);

	/**
	 * Turn a selection into a frame.
	 *
	 * The selection is discarded first, so objects are back in canvas
	 * coordinates. If one selected rectangle encloses all the others, it
	 * becomes the frame (its fill is the background) with padding from the
	 * insets; otherwise a transparent frame is drawn around the selection.
	 *
	 * @param {string[]} ids Selected layer ids.
	 * @return {string|null} The new frame's id, or null.
	 */
	const createFrame = useCallback(
		( ids ) => {
			const canvas = fabricRef.current;
			canvas?.discardActiveObject();
			if ( ! canvas || createProblem( ids ) ) {
				return null;
			}
			let frameId = null;
			commit( __( 'Create frame', 'socialframe' ), () => {
				const t = tree();
				const objs = ids.map( ( id ) => t.byId.get( id ) );
				const box = ( o ) => ( {
					left: o.left ?? 0,
					top: o.top ?? 0,
					right: ( o.left ?? 0 ) + o.getScaledWidth(),
					bottom: ( o.top ?? 0 ) + o.getScaledHeight(),
				} );
				const contains = ( outer, inner ) =>
					outer.left <= inner.left + 0.5 &&
					outer.top <= inner.top + 0.5 &&
					outer.right >= inner.right - 0.5 &&
					outer.bottom >= inner.bottom - 0.5;

				const backgrounds = objs.filter(
					( o ) =>
						objs.length > 1 &&
						String( o.type ).toLowerCase() === 'rect' &&
						! o.sfFrame &&
						objs.every(
							( other ) =>
								other === o ||
								contains( box( o ), box( other ) )
						)
				);
				const background =
					backgrounds.length === 1 ? backgrounds[ 0 ] : null;
				const members = objs.filter( ( o ) => o !== background );

				const boxes = members.map( box );
				const bounds = {
					left: Math.min( ...boxes.map( ( b ) => b.left ) ),
					top: Math.min( ...boxes.map( ( b ) => b.top ) ),
					right: Math.max( ...boxes.map( ( b ) => b.right ) ),
					bottom: Math.max( ...boxes.map( ( b ) => b.bottom ) ),
				};
				const centres = boxes.map( ( b ) => ( {
					x: ( b.left + b.right ) / 2,
					y: ( b.top + b.bottom ) / 2,
				} ) );
				const spread = ( axis ) =>
					Math.max( ...centres.map( ( c ) => c[ axis ] ) ) -
					Math.min( ...centres.map( ( c ) => c[ axis ] ) );
				const direction =
					spread( 'y' ) >= spread( 'x' ) ? 'column' : 'row';
				const ordered = members
					.map( ( o, i ) => ( { o, b: boxes[ i ] } ) )
					.sort( ( a, b ) =>
						direction === 'column'
							? a.b.top - b.b.top
							: a.b.left - b.b.left
					);
				const spaces = ordered
					.slice( 1 )
					.map( ( { b }, i ) =>
						direction === 'column'
							? b.top - ordered[ i ].b.bottom
							: b.left - ordered[ i ].b.right
					);
				const gap = spaces.length
					? Math.max(
							0,
							Math.round(
								spaces.reduce( ( s, v ) => s + v, 0 ) /
									spaces.length
							)
						)
					: 0;

				let rect = background;
				let padding = { top: 0, right: 0, bottom: 0, left: 0 };
				if ( rect ) {
					const outer = box( rect );
					padding = {
						top: Math.max(
							0,
							Math.round( bounds.top - outer.top )
						),
						right: Math.max(
							0,
							Math.round( outer.right - bounds.right )
						),
						bottom: Math.max(
							0,
							Math.round( outer.bottom - bounds.bottom )
						),
						left: Math.max(
							0,
							Math.round( bounds.left - outer.left )
						),
					};
					rect.set( {
						width: rect.getScaledWidth(),
						height: rect.getScaledHeight(),
						scaleX: 1,
						scaleY: 1,
					} );
				} else {
					rect = new fabric.Rect( {
						left: bounds.left,
						top: bounds.top,
						width: bounds.right - bounds.left,
						height: bounds.bottom - bounds.top,
						fill: 'transparent',
						strokeWidth: 0,
					} );
					rect.id = `frame-${ Date.now() }-${ ++frameCount }`;
					rect.name = __( 'Frame', 'socialframe' );
					const lowest = Math.min(
						...members.map( ( o ) =>
							canvas.getObjects().indexOf( o )
						)
					);
					canvas.insertAt( lowest, rect );
				}
				frameId = rect.id;

				// Take the members' place in their old frame.
				const parentId = t.parent.get( ids[ 0 ] );
				const parent =
					parentId !== undefined ? t.byId.get( parentId ) : null;
				if ( parent?.sfFrame ) {
					const kids = parent.sfFrame.children;
					const at = kids.findIndex( ( c ) => ids.includes( c ) );
					parent.sfFrame = {
						...parent.sfFrame,
						children: [
							...kids
								.slice( 0, at )
								.filter( ( c ) => ! ids.includes( c ) ),
							rect.id,
							...kids
								.slice( at )
								.filter( ( c ) => ! ids.includes( c ) ),
						],
					};
				}
				if ( background ) {
					background.sfItem = parent
						? itemFor( background )
						: undefined;
				}

				rect.sfFrame = {
					...copy( DEFAULT_FRAME ),
					direction,
					gap,
					padding,
					alignX: background ? 'center' : 'start',
					alignY: background ? 'center' : 'start',
					children: ordered.map( ( { o } ) => o.id ),
				};
				if ( parent && ! background ) {
					rect.sfItem = itemFor( rect );
				}
				for ( const { o } of ordered ) {
					o.sfItem = itemFor( o );
				}
			} );
			const rect = frameId ? findObject( frameId ) : null;
			if ( rect ) {
				canvas.setActiveObject( rect );
				canvas.requestRenderAll();
			}
			return frameId;
		},
		[ fabricRef, createProblem, commit, tree, itemFor, findObject ]
	);

	const addToFrame = useCallback(
		( id, frameId ) => {
			const t = tree();
			const frame = t.byId.get( frameId );
			if ( ! frame?.sfFrame || ! canAdd( t, id, frameId ) ) {
				return;
			}
			commit( __( 'Add to frame', 'socialframe' ), () => {
				const obj = t.byId.get( id );
				if ( t.parent.has( id ) ) {
					release( t, obj );
				}
				obj.sfItem = itemFor( obj );
				frame.sfFrame = {
					...frame.sfFrame,
					children: [ ...frame.sfFrame.children, id ],
				};
			} );
		},
		[ tree, commit, release, itemFor ]
	);

	const removeFromFrame = useCallback(
		( id ) => {
			const t = tree();
			if ( ! t.parent.has( id ) ) {
				return;
			}
			commit( __( 'Remove from frame', 'socialframe' ), () =>
				release( t, t.byId.get( id ) )
			);
		},
		[ tree, commit, release ]
	);

	const moveInFrame = useCallback(
		( id, dir ) => {
			const t = tree();
			const parent = t.byId.get( t.parent.get( id ) );
			const kids = parent?.sfFrame?.children ?? [];
			const i = kids.indexOf( id );
			const j = i + dir;
			if ( i < 0 || j < 0 || j >= kids.length ) {
				return;
			}
			commit(
				dir < 0
					? __( 'Move up in frame', 'socialframe' )
					: __( 'Move down in frame', 'socialframe' ),
				() => {
					const next = [ ...kids ];
					[ next[ i ], next[ j ] ] = [ next[ j ], next[ i ] ];
					parent.sfFrame = { ...parent.sfFrame, children: next };
				}
			);
		},
		[ tree, commit ]
	);

	/**
	 * Remove a frame but keep its layers: they take its place in its parent
	 * (or become free). A frame with no fill is deleted; one with a fill
	 * stays as a plain rectangle.
	 */
	const removeFrame = useCallback(
		( frameId ) => {
			const canvas = fabricRef.current;
			const t = tree();
			const rect = t.byId.get( frameId );
			if ( ! rect?.sfFrame ) {
				return;
			}
			commit( __( 'Remove frame', 'socialframe' ), () => {
				const kids = t.children.get( frameId ) ?? [];
				const parentId = t.parent.get( frameId );
				const parent =
					parentId !== undefined ? t.byId.get( parentId ) : null;
				if ( parent?.sfFrame ) {
					const at = parent.sfFrame.children.indexOf( frameId );
					const next = [ ...parent.sfFrame.children ];
					next.splice( at, 1, ...kids );
					parent.sfFrame = { ...parent.sfFrame, children: next };
				} else {
					for ( const c of kids ) {
						const obj = t.byId.get( c );
						const item = readItem( obj?.sfItem );
						if ( obj && item?.flex && item.fontSize ) {
							obj.set( { fontSize: item.fontSize } );
						}
						if ( obj ) {
							obj.sfItem = undefined;
						}
					}
				}
				rect.sfFrame = undefined;
				if ( rect.isArtboard ) {
					return;
				}
				if ( isClear( rect.fill ) ) {
					canvas.remove( rect );
				} else {
					rect.sfItem = parent ? rect.sfItem : undefined;
				}
			} );
		},
		[ fabricRef, tree, commit ]
	);

	const setFrame = useCallback(
		( frameId, props, label = __( 'Change frame', 'socialframe' ) ) => {
			const rect = findObject( frameId );
			if ( ! rect?.sfFrame ) {
				return;
			}
			commit( label, () => {
				const next = readFrame( { ...rect.sfFrame, ...props } );
				if ( ! next ) {
					return false;
				}
				rect.sfFrame = { ...next, children: rect.sfFrame.children };
			} );
		},
		[ findObject, commit ]
	);

	const setItem = useCallback(
		( id, props ) => {
			const t = tree();
			const obj = t.byId.get( id );
			if ( ! obj || ! t.parent.has( id ) ) {
				return;
			}
			commit( __( 'Change layout', 'socialframe' ), () => {
				const item = { ...itemFor( obj ), ...props };
				if ( props.flex !== undefined && ! canFlex( obj ) ) {
					return false;
				}
				if ( item.flex ) {
					item.fontSize = item.fontSize || obj.fontSize;
					item.minFontSize = Math.min(
						item.fontSize,
						Math.max(
							6,
							Math.round(
								item.minFontSize ?? item.fontSize * 0.6
							)
						)
					);
				} else if ( item.fontSize ) {
					obj.set( { fontSize: item.fontSize } );
					obj.initDimensions?.();
				}
				obj.sfItem = item;
			} );
		},
		[ tree, commit, itemFor ]
	);

	const setArtboardLayout = useCallback(
		( on ) => {
			const artboard = findArtboard( fabricRef.current );
			if ( ! artboard || !! artboard.sfFrame === on ) {
				return;
			}
			if ( ! on ) {
				removeFrame( artboard.id );
				return;
			}
			commit( __( 'Lay out content', 'socialframe' ), () => {
				artboard.sfFrame = {
					...copy( DEFAULT_FRAME ),
					width: 'fixed',
					height: 'fixed',
				};
			} );
		},
		[ fabricRef, commit, removeFrame ]
	);

	/**
	 * Delete layers that take part in frames, as one undo step that also
	 * restores their frame membership.
	 *
	 * @param {Object[]} objs  Objects to delete.
	 * @param {string}   label History label.
	 */
	const removeObjects = useCallback(
		( objs, label ) => {
			const canvas = fabricRef.current;
			commit( label, () => {
				const t = tree();
				for ( const obj of objs ) {
					const kids = t.children.get( obj.id );
					if ( kids ) {
						for ( const c of kids ) {
							const child = t.byId.get( c );
							if ( child && ! objs.includes( child ) ) {
								release( t, child );
								if ( t.parent.get( obj.id ) !== undefined ) {
									// Lift the child into the deleted frame's parent.
									const parent = t.byId.get(
										t.parent.get( obj.id )
									);
									child.sfItem = itemFor( child );
									parent.sfFrame = {
										...parent.sfFrame,
										children: [
											...parent.sfFrame.children,
											c,
										],
									};
								}
							}
						}
					}
					if ( t.parent.has( obj.id ) ) {
						release( t, obj );
					}
					canvas.remove( obj );
				}
			} );
		},
		[ fabricRef, commit, tree, release, itemFor ]
	);

	/**
	 * Whether deleting these objects needs frame-aware handling.
	 *
	 * @param {Object[]} objs Objects.
	 * @return {boolean} True when any is a frame or in one.
	 */
	const involves = useCallback(
		( objs ) => {
			const t = tree();
			return objs.some(
				( o ) => t.frames.has( o.id ) || t.parent.has( o.id )
			);
		},
		[ tree ]
	);

	/**
	 * Keep frame lists tidy when a layer is removed some other way (an
	 * emptied text box, say). Skipped while frames change on purpose.
	 *
	 * @param {Object} obj Removed object.
	 */
	const handleRemoved = useCallback(
		( obj ) => {
			if ( busyRef.current || ! obj?.id ) {
				return;
			}
			for ( const other of fabricRef.current?.getObjects() ?? [] ) {
				if ( other.sfFrame?.children?.includes( obj.id ) ) {
					other.sfFrame = {
						...other.sfFrame,
						children: other.sfFrame.children.filter(
							( c ) => c !== obj.id
						),
					};
				}
			}
		},
		[ fabricRef ]
	);

	/**
	 * Take over `object:modified` for frame layers. A layer inside a frame is
	 * placed by it, so a drag snaps back; resizing a text box or image sets
	 * its intended width. Resizing a frame sets its size and fixes that axis.
	 *
	 * @param {Object} e Fabric event.
	 * @return {boolean} True when frames handled it.
	 */
	const handleModified = useCallback(
		( e ) => {
			const obj = e.target;
			const original = e.transform?.original;
			if ( ! obj || ! original || obj.type === 'activeselection' ) {
				if ( obj?.type === 'activeselection' ) {
					schedule();
				}
				return false;
			}
			const t = tree();
			const inFrame = t.parent.has( obj.id );
			const isFrame = t.frames.has( obj.id ) && ! obj.isArtboard;
			const action = e.transform?.action ?? '';
			const resized =
				action.startsWith( 'scale' ) || action === 'resizing';
			if ( ! inFrame && ! isFrame ) {
				return false;
			}
			if ( ! resized ) {
				if ( inFrame ) {
					// Placed by its frame: snap back.
					schedule();
					return true;
				}
				return false;
			}

			const before = snapshot();
			before.props.set( obj, {
				...before.props.get( obj ),
				...Object.fromEntries(
					GEOMETRY.filter( ( k ) => original[ k ] !== undefined ).map(
						( k ) => [ k, original[ k ] ]
					)
				),
			} );
			commit(
				__( 'Resize', 'socialframe' ),
				() => {
					if ( isFrame ) {
						const frame = readFrame( obj.sfFrame );
						const scaledX =
							( obj.scaleX ?? 1 ) !== ( original.scaleX ?? 1 );
						const scaledY =
							( obj.scaleY ?? 1 ) !== ( original.scaleY ?? 1 );
						obj.set( {
							width: obj.getScaledWidth(),
							height: obj.getScaledHeight(),
							scaleX: 1,
							scaleY: 1,
						} );
						obj.sfFrame = {
							...obj.sfFrame,
							width: scaledX ? 'fixed' : frame.width,
							height: scaledY ? 'fixed' : frame.height,
						};
					}
					if ( inFrame ) {
						const isText = obj.text !== undefined;
						obj.sfItem = {
							...itemFor( obj ),
							width: 'fixed',
							w: Math.round(
								isText ? obj.width : obj.getScaledWidth()
							),
						};
					}
				},
				before
			);
			return true;
		},
		[ schedule, tree, snapshot, commit, itemFor ]
	);

	/**
	 * Reorder a frame's layers (for a layer inside a frame) or move a frame
	 * with everything in it one step in z-order.
	 *
	 * @param {string} id  Layer id.
	 * @param {number} dir 1 to bring forward, -1 to send back.
	 * @return {boolean} True when frames handled it.
	 */
	const moveLayer = useCallback(
		( id, dir ) => {
			const canvas = fabricRef.current;
			const t = tree();
			if ( t.parent.has( id ) ) {
				// Layers panel lists top first: forward means earlier in the frame.
				moveInFrame( id, -dir );
				return true;
			}
			if ( ! t.frames.has( id ) || t.byId.get( id )?.isArtboard ) {
				return false;
			}
			const block = new Set();
			const collect = ( fid ) => {
				block.add( t.byId.get( fid ) );
				for ( const c of t.children.get( fid ) ?? [] ) {
					if ( t.frames.has( c ) ) {
						collect( c );
					} else {
						block.add( t.byId.get( c ) );
					}
				}
			};
			collect( id );
			commit(
				dir > 0
					? __( 'Move layer up', 'socialframe' )
					: __( 'Move layer down', 'socialframe' ),
				() => {
					const objs = canvas.getObjects();
					const inBlock = objs.filter( ( o ) => block.has( o ) );
					const rest = objs.filter( ( o ) => ! block.has( o ) );
					const first = objs.indexOf( inBlock[ 0 ] );
					const before = objs
						.slice( 0, first )
						.filter( ( o ) => ! block.has( o ) ).length;
					const at = Math.max(
						1,
						Math.min( rest.length, before + dir )
					);
					if ( at === before ) {
						return false;
					}
					const next = [
						...rest.slice( 0, at ),
						...inBlock,
						...rest.slice( at ),
					];
					next.forEach( ( o, i ) => canvas.moveObjectTo( o, i ) );
				}
			);
			return true;
		},
		[ fabricRef, tree, moveInFrame, commit ]
	);

	/**
	 * Fold a font size change into a flexible layer's base size, so the
	 * layout shrinks from the size the designer picked.
	 *
	 * @param {Object} obj   Fabric object.
	 * @param {Object} props Props about to be set.
	 * @return {Object} Props, with the item updated when needed.
	 */
	const withItemBase = useCallback( ( obj, props ) => {
		const item = readItem( obj?.sfItem );
		if ( ! item?.flex || props.fontSize === undefined ) {
			return props;
		}
		return {
			...props,
			sfItem: {
				...obj.sfItem,
				fontSize: props.fontSize,
				minFontSize: Math.min( item.minFontSize, props.fontSize ),
			},
		};
	}, [] );

	/**
	 * The box a replaced image in a frame is fitted into, or null.
	 *
	 * @param {Object} obj Image object.
	 * @return {{left: number, width: number, height: number}|null} Box.
	 */
	const imageBox = useCallback(
		( obj ) => {
			const t = tree();
			const item = t.parent.has( obj?.id )
				? readItem( obj.sfItem )
				: null;
			if ( ! item ) {
				return null;
			}
			return {
				left: obj.left ?? 0,
				width: item.w || obj.getScaledWidth(),
				height: item.maxHeight,
			};
		},
		[ tree ]
	);

	/**
	 * Frame details for the properties panel.
	 *
	 * @param {string|null} id Selected layer id, or null for the artboard.
	 * @return {Object} Details.
	 */
	const getInfo = useCallback(
		( id ) => {
			const canvas = fabricRef.current;
			const t = tree();
			const artboard = findArtboard( canvas );
			const obj = id ? t.byId.get( id ) : artboard;
			const parentId = obj ? t.parent.get( obj.id ) : undefined;
			const parent =
				parentId !== undefined ? t.byId.get( parentId ) : null;
			const siblings = parent ? ( t.children.get( parentId ) ?? [] ) : [];
			const label = ( o ) =>
				o.isArtboard
					? __( 'Artboard', 'socialframe' )
					: o.name || __( 'Frame', 'socialframe' );
			const overflowing = new Set(
				resultRef.current.overflows.map( ( o ) => o.frameId )
			);
			return {
				frame:
					obj && t.frames.has( obj.id )
						? t.frames.get( obj.id )
						: null,
				canBeFrame: !! obj && canBeFrame( obj ),
				inFrame: !! parent,
				parentId: parent?.id ?? null,
				parentName: parent ? label( parent ) : '',
				index: siblings.indexOf( obj?.id ),
				count: siblings.length,
				item: parent ? readItem( obj.sfItem ) : null,
				canJoin: !! obj && ! obj.isArtboard && canJoin( obj ),
				canFlex: !! obj && canFlex( obj ),
				isImage: String( obj?.type ).toLowerCase() === 'image',
				targets: [ ...t.frames.keys() ]
					.filter(
						( fid ) =>
							obj && canAdd( t, obj.id, fid ) && fid !== parentId
					)
					.map( ( fid ) => ( {
						id: fid,
						name: label( t.byId.get( fid ) ),
					} ) ),
				overflowing: !! obj && overflowing.has( obj.id ),
				truncated:
					!! obj && resultRef.current.truncated.includes( obj.id ),
			};
		},
		[ fabricRef, tree ]
	);

	/**
	 * Lay out with truncation for an export, run `read`, then put the live
	 * layout back even if layout or reading throws.
	 *
	 * @param {() => (string|null)} read Reads pixels from the canvas.
	 * @return {string|null} What read returns.
	 */
	const forExport = useCallback(
		( read ) => {
			const canvas = fabricRef.current;
			let layout = NONE;
			exportingRef.current = true;
			try {
				layout = canvas
					? applyFrameLayout( canvas, { truncate: true } )
					: NONE;
				return read();
			} finally {
				layout.restore();
				exportingRef.current = false;
				run();
			}
		},
		[ fabricRef, run ]
	);

	return useMemo(
		() => ( {
			schedule,
			handleModified,
			handleRemoved,
			createProblem,
			createFrame,
			addToFrame,
			removeFromFrame,
			moveInFrame,
			moveLayer,
			removeFrame,
			setFrame,
			setItem,
			setArtboardLayout,
			removeObjects,
			involves,
			getInfo,
			withItemBase,
			imageBox,
			forExport,
			result: resultRef,
			exporting: exportingRef,
			busy: busyRef,
		} ),
		[
			schedule,
			handleModified,
			handleRemoved,
			createProblem,
			createFrame,
			addToFrame,
			removeFromFrame,
			moveInFrame,
			moveLayer,
			removeFrame,
			setFrame,
			setItem,
			setArtboardLayout,
			removeObjects,
			involves,
			getInfo,
			withItemBase,
			imageBox,
			forExport,
		]
	);
}
