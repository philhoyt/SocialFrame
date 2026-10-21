import { useCallback, useEffect, useMemo, useRef } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import * as fabric from 'fabric';

import { STORE_KEY } from '../store';
import {
	applyStackLayout,
	canFlex,
	canJoin,
	containInBox,
	joinStack,
	leaveStack,
	moveRow,
	readBox,
	readItem,
	readStack,
	shiftRowGap,
} from '../../shared/stackLayout';

const NONE = { overflow: 0, truncated: [], limit: null, restore: () => {} };

// Geometry a stack operation can change; snapshots restore it on undo.
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
 * Stack members with their validated item and live geometry.
 *
 * @param {Object} canvas Fabric canvas.
 * @param {Object} stack  Validated stack.
 * @return {Array<{id: string, item: Object, top: number, height: number}>} Members.
 */
function liveMembers( canvas, stack ) {
	const rows = new Set( stack.rows.map( ( r ) => r.id ) );
	return canvas
		.getObjects()
		.map( ( obj ) => ( { obj, item: readItem( obj.sfStackItem ) } ) )
		.filter(
			( { obj, item } ) =>
				item && rows.has( item.row ) && obj.id && canJoin( obj )
		)
		.map( ( { obj, item } ) => ( {
			id: obj.id,
			item,
			top: obj.top ?? 0,
			height: obj.getScaledHeight(),
		} ) );
}

/**
 * The vertical stack in the editor: keeps the layout current, records stack
 * changes as single undo steps, and exposes the operations the properties
 * panel uses.
 *
 * Layout is derived from the stack metadata, so it never adds history of its
 * own; it re-runs on every store revision (any change, undo or redo), after
 * fonts load, and while text is typed.
 *
 * @param {{current: Object}} fabricRef Fabric canvas ref.
 * @param {Object}            dispatch  Editor store actions.
 * @return {Object} Stack API.
 */
export function useStackLayout( fabricRef, dispatch ) {
	const resultRef = useRef( NONE );
	const frameRef = useRef( 0 );
	const exportingRef = useRef( false );
	const revision = useSelect(
		( select ) => select( STORE_KEY ).getRevision(),
		[]
	);

	const run = useCallback( () => {
		const canvas = fabricRef.current;
		if ( ! canvas ) {
			return;
		}
		resultRef.current = applyStackLayout( canvas );
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

	const snapshot = useCallback( () => {
		const canvas = fabricRef.current;
		const artboard = findArtboard( canvas );
		const objects = {};
		for ( const obj of canvas?.getObjects() ?? [] ) {
			if ( ! obj.id || obj === artboard ) {
				continue;
			}
			objects[ obj.id ] = {
				sfStackItem: obj.sfStackItem
					? { ...obj.sfStackItem }
					: undefined,
				sfBox: obj.sfBox ? { ...obj.sfBox } : undefined,
				...Object.fromEntries(
					GEOMETRY.filter( ( k ) => obj[ k ] !== undefined ).map(
						( k ) => [ k, obj[ k ] ]
					)
				),
			};
		}
		return {
			stack: artboard?.sfStack
				? JSON.parse( JSON.stringify( artboard.sfStack ) )
				: undefined,
			objects,
		};
	}, [ fabricRef ] );

	const restore = useCallback(
		( snap ) => {
			const canvas = fabricRef.current;
			const artboard = findArtboard( canvas );
			if ( ! canvas || ! artboard ) {
				return;
			}
			artboard.sfStack = snap.stack;
			for ( const obj of canvas.getObjects() ) {
				const saved = snap.objects[ obj.id ];
				if ( ! saved ) {
					continue;
				}
				const { sfStackItem, sfBox, ...geometry } = saved;
				obj.sfStackItem = sfStackItem;
				obj.sfBox = sfBox;
				obj.set( geometry );
				obj.initDimensions?.();
				obj.setCoords();
			}
			run();
			dispatch.markDirty();
		},
		[ fabricRef, run, dispatch ]
	);

	/**
	 * Change the stack and record the change as one undo step.
	 *
	 * @param {string}               label  History label.
	 * @param {() => (boolean|void)} mutate Applies the change; returns false to cancel.
	 * @param {Object}               before Snapshot to undo to (defaults to now).
	 */
	const commit = useCallback(
		( label, mutate, before = null ) => {
			const canvas = fabricRef.current;
			if ( ! canvas ) {
				return;
			}
			const from = before ?? snapshot();
			if ( mutate() === false ) {
				return;
			}
			run();
			const to = snapshot();
			dispatch.markDirty();
			dispatch.pushHistory( {
				label,
				undo: () => restore( from ),
				redo: () => restore( to ),
			} );
		},
		[ fabricRef, snapshot, run, restore, dispatch ]
	);

	/**
	 * Take over `object:modified` for stack members: a vertical drag sets the
	 * row's gap, a horizontal drag or resize moves an image's box.
	 *
	 * @param {Object} e Fabric event.
	 * @return {boolean} True when the stack recorded the change.
	 */
	const handleModified = useCallback(
		( e ) => {
			const canvas = fabricRef.current;
			const obj = e.target;
			const original = e.transform?.original;
			const artboard = findArtboard( canvas );
			const stack = readStack( artboard?.sfStack );
			const item = readItem( obj?.sfStackItem );
			if (
				! original ||
				! stack ||
				! item ||
				! stack.rows.some( ( r ) => r.id === item.row )
			) {
				return false;
			}

			const before = snapshot();
			before.objects[ obj.id ] = {
				...before.objects[ obj.id ],
				...Object.fromEntries(
					GEOMETRY.filter( ( k ) => original[ k ] !== undefined ).map(
						( k ) => [ k, original[ k ] ]
					)
				),
			};

			const action = e.transform?.action ?? '';
			commit(
				action === 'drag'
					? __( 'Move', 'socialframe' )
					: __( 'Resize', 'socialframe' ),
				() => {
					const box = readBox( obj.sfBox );
					if ( action === 'drag' ) {
						const dy = ( obj.top ?? 0 ) - ( original.top ?? 0 );
						if ( dy ) {
							artboard.sfStack = shiftRowGap(
								stack,
								item.row,
								dy
							);
						}
						if ( box ) {
							obj.sfBox = {
								...box,
								left:
									box.left +
									( obj.left ?? 0 ) -
									( original.left ?? 0 ),
							};
						}
					} else if ( box && action.startsWith( 'scale' ) ) {
						obj.sfBox = {
							left: obj.left ?? 0,
							width: obj.getScaledWidth(),
							height: obj.getScaledHeight(),
						};
					}
				},
				before
			);
			return true;
		},
		[ fabricRef, snapshot, commit ]
	);

	const findObject = useCallback(
		( id ) => fabricRef.current?.getObjects().find( ( o ) => o.id === id ),
		[ fabricRef ]
	);

	const join = useCallback(
		( id ) => {
			const canvas = fabricRef.current;
			const obj = findObject( id );
			const artboard = findArtboard( canvas );
			if ( ! obj || ! artboard || ! canJoin( obj ) || obj.sfStackItem ) {
				return;
			}
			commit( __( 'Add to stack', 'socialframe' ), () => {
				// An image joins whole: its box becomes its maximum size.
				if ( String( obj.type ).toLowerCase() === 'image' ) {
					const box = {
						left: obj.left ?? 0,
						width: obj.getScaledWidth(),
						height: obj.getScaledHeight(),
					};
					const el = obj.getElement?.();
					const fit = containInBox(
						{
							width: el?.naturalWidth || el?.width,
							height: el?.naturalHeight || el?.height,
						},
						box
					);
					obj.sfBox = box;
					if ( fit ) {
						obj.set( fit );
					}
				}

				const stack = readStack( artboard.sfStack );
				const members = stack ? liveMembers( canvas, stack ) : [];
				const result = joinStack( stack, members, {
					id,
					top: obj.top ?? 0,
					height: obj.getScaledHeight(),
				} );

				artboard.sfStack = result.stack;
				for ( const [ memberId, item ] of Object.entries(
					result.items
				) ) {
					const member = findObject( memberId );
					if ( member ) {
						member.sfStackItem = item;
					}
				}
				if ( canFlex( obj ) ) {
					obj.sfStackItem = {
						...obj.sfStackItem,
						flex: false,
						fontSize: obj.fontSize,
						minFontSize: Math.max(
							6,
							Math.round( obj.fontSize * 0.6 )
						),
					};
				}
			} );
		},
		[ fabricRef, findObject, commit ]
	);

	const leave = useCallback(
		( id ) => {
			const canvas = fabricRef.current;
			const obj = findObject( id );
			const artboard = findArtboard( canvas );
			const stack = readStack( artboard?.sfStack );
			const item = readItem( obj?.sfStackItem );
			if ( ! obj || ! stack || ! item ) {
				return;
			}
			commit( __( 'Remove from stack', 'socialframe' ), () => {
				const result = leaveStack(
					stack,
					liveMembers( canvas, stack ),
					id
				);
				artboard.sfStack = result.stack ?? undefined;
				for ( const [ memberId, next ] of Object.entries(
					result.items
				) ) {
					const member = findObject( memberId );
					if ( member ) {
						member.sfStackItem = next;
					}
				}
				if ( item.fontSize ) {
					obj.set( { fontSize: item.fontSize } );
					obj.initDimensions?.();
				}
				obj.sfStackItem = undefined;
				obj.sfBox = undefined;
			} );
		},
		[ fabricRef, findObject, commit ]
	);

	const setFlex = useCallback(
		( id, { flex, minFontSize } ) => {
			const obj = findObject( id );
			const item = readItem( obj?.sfStackItem );
			if ( ! obj || ! item || ! canFlex( obj ) ) {
				return;
			}
			commit( __( 'Change stack text fit', 'socialframe' ), () => {
				const base = item.fontSize || obj.fontSize;
				const next = {
					...obj.sfStackItem,
					flex: flex ?? item.flex,
					fontSize: base,
					minFontSize: Math.min(
						base,
						Math.max(
							6,
							Math.round( minFontSize ?? item.minFontSize )
						)
					),
				};
				obj.sfStackItem = next;
				if ( ! next.flex ) {
					obj.set( { fontSize: base } );
					obj.initDimensions?.();
				}
			} );
		},
		[ findObject, commit ]
	);

	const moveRowOf = useCallback(
		( id, dir ) => {
			const artboard = findArtboard( fabricRef.current );
			const stack = readStack( artboard?.sfStack );
			const item = readItem( findObject( id )?.sfStackItem );
			if ( ! stack || ! item ) {
				return;
			}
			commit(
				dir < 0
					? __( 'Move row up', 'socialframe' )
					: __( 'Move row down', 'socialframe' ),
				() => {
					const next = moveRow( stack, item.row, dir );
					if ( next === stack ) {
						return false;
					}
					artboard.sfStack = next;
				}
			);
		},
		[ fabricRef, findObject, commit ]
	);

	const setBottom = useCallback(
		( bottom ) => {
			const artboard = findArtboard( fabricRef.current );
			const stack = readStack( artboard?.sfStack );
			if ( ! stack ) {
				return;
			}
			commit( __( 'Change stack padding', 'socialframe' ), () => {
				artboard.sfStack = { ...stack, bottom: Math.max( 0, bottom ) };
			} );
		},
		[ fabricRef, commit ]
	);

	const removeStack = useCallback( () => {
		const canvas = fabricRef.current;
		const artboard = findArtboard( canvas );
		if ( ! artboard?.sfStack ) {
			return;
		}
		commit( __( 'Remove stack', 'socialframe' ), () => {
			for ( const obj of canvas.getObjects() ) {
				const item = readItem( obj.sfStackItem );
				if ( item?.fontSize ) {
					obj.set( { fontSize: item.fontSize } );
					obj.initDimensions?.();
				}
				obj.sfStackItem = undefined;
				obj.sfBox = undefined;
			}
			artboard.sfStack = undefined;
		} );
	}, [ fabricRef, commit ] );

	/**
	 * Stack details for the properties panel.
	 *
	 * @param {string|null} id Selected object id, or null for the artboard.
	 * @return {Object} Details.
	 */
	const getInfo = useCallback(
		( id ) => {
			const canvas = fabricRef.current;
			const artboard = findArtboard( canvas );
			const stack = readStack( artboard?.sfStack );
			const obj = id ? findObject( id ) : null;
			const item = stack ? readItem( obj?.sfStackItem ) : null;
			const rowIndex =
				item && stack
					? stack.rows.findIndex( ( r ) => r.id === item.row )
					: -1;
			const mates =
				item && canvas
					? canvas
							.getObjects()
							.filter(
								( o ) =>
									o !== obj &&
									readItem( o.sfStackItem )?.row === item.row
							)
							.map( ( o ) => o.name || o.id )
					: [];
			return {
				hasStack: !! stack,
				bottom: stack?.bottom ?? 0,
				inStack: rowIndex >= 0,
				canJoin: !! obj && canJoin( obj ),
				canFlex: !! obj && canFlex( obj ),
				flex: !! item?.flex,
				minFontSize: item?.minFontSize ?? 0,
				rowIndex,
				rowCount: stack?.rows.length ?? 0,
				rowMates: mates,
				overflow: resultRef.current.overflow,
				truncated: !! id && resultRef.current.truncated.includes( id ),
			};
		},
		[ fabricRef, findObject ]
	);

	/**
	 * Fold a font size change into a flexible member's base size, so the
	 * layout shrinks from the size the designer picked.
	 *
	 * @param {Object} obj   Fabric object.
	 * @param {Object} props Props about to be set.
	 * @return {Object} Props, with the stack item updated when needed.
	 */
	const withStackBase = useCallback( ( obj, props ) => {
		const item = readItem( obj?.sfStackItem );
		if ( ! item?.flex || props.fontSize === undefined ) {
			return props;
		}
		return {
			...props,
			sfStackItem: {
				...obj.sfStackItem,
				fontSize: props.fontSize,
				minFontSize: Math.min( item.minFontSize, props.fontSize ),
			},
		};
	}, [] );

	/**
	 * Lay out with truncation for an export, run `read`, then put the live
	 * layout back even if reading throws.
	 *
	 * @param {() => (string|null)} read Reads pixels from the canvas.
	 * @return {string|null} What read returns.
	 */
	const forExport = useCallback(
		( read ) => {
			const canvas = fabricRef.current;
			exportingRef.current = true;
			const layout = canvas
				? applyStackLayout( canvas, { truncate: true } )
				: NONE;
			try {
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
			join,
			leave,
			setFlex,
			moveRowOf,
			setBottom,
			removeStack,
			getInfo,
			withStackBase,
			forExport,
			result: resultRef,
			exporting: exportingRef,
		} ),
		[
			schedule,
			handleModified,
			join,
			leave,
			setFlex,
			moveRowOf,
			setBottom,
			removeStack,
			getInfo,
			withStackBase,
			forExport,
		]
	);
}
