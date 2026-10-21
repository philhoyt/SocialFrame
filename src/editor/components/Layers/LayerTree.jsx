import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { useDispatch, useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';
import { rangeOf, rootsOf, visibleRows } from '../../utils/layerTree';
import { LayerRow } from './LayerRow';
import { useLayerDrag } from './useLayerDrag';

export const RENAME_EVENT = 'socialframe:rename-layer';

/**
 * The Layers tree: always visible, multi-select, drag and drop, keyboard
 * navigation, and the layer menu on right-click or Shift+F10.
 */
export function LayerTree() {
	const fabric = useFabric();
	const { rows, selected } = useSelect( ( select ) => {
		const store = select( STORE_KEY );
		const selection = store.getSelection();
		return {
			rows: store.getLayers(),
			selected:
				selection.type === 'multi'
					? ( selection.properties?.ids ?? [] )
					: [ selection.objectId ].filter( Boolean ),
		};
	}, [] );
	const { openContextMenu } = useDispatch( STORE_KEY );

	const [ collapsed, setCollapsed ] = useState( () => new Set() );
	const [ focusedId, setFocusedId ] = useState( null );
	const [ renaming, setRenaming ] = useState( null );
	const [ renameValue, setRenameValue ] = useState( '' );
	const anchor = useRef( null );
	const rowRefs = useRef( new Map() );

	const shown = useMemo(
		() => visibleRows( rows, collapsed ),
		[ rows, collapsed ]
	);
	const byId = useMemo(
		() => new Map( rows.map( ( r ) => [ r.id, r ] ) ),
		[ rows ]
	);

	// Keep focus on a row that still exists.
	const focus = shown.some( ( r ) => r.id === focusedId )
		? focusedId
		: ( selected.find( ( id ) => shown.some( ( r ) => r.id === id ) ) ??
			shown[ 0 ]?.id ??
			null );

	const focusRow = ( id ) => {
		setFocusedId( id );
		rowRefs.current.get( id )?.focus();
	};

	// Open the frames around a layer selected on the canvas and show it.
	const selectedKey = selected.join( ',' );
	useEffect( () => {
		const ancestors = new Set();
		for ( const id of selected ) {
			let up = byId.get( id )?.parentId;
			while ( up ) {
				ancestors.add( up );
				up = byId.get( up )?.parentId;
			}
		}
		setCollapsed( ( prev ) =>
			[ ...ancestors ].some( ( id ) => prev.has( id ) )
				? new Set(
						[ ...prev ].filter( ( id ) => ! ancestors.has( id ) )
					)
				: prev
		);
		if ( selected.length === 1 ) {
			window.requestAnimationFrame( () =>
				rowRefs.current
					.get( selected[ 0 ] )
					?.scrollIntoView?.( { block: 'nearest' } )
			);
		}
	}, [ selectedKey ] ); // eslint-disable-line react-hooks/exhaustive-deps -- runs when the selection changes.

	// Rename requests from the layer menu.
	useEffect( () => {
		const start = ( e ) => {
			const row = byId.get( e.detail?.id );
			if ( row && row.kind !== 'artboard' ) {
				setRenaming( row.id );
				setRenameValue( row.name );
			}
		};
		window.addEventListener( RENAME_EVENT, start );
		return () => window.removeEventListener( RENAME_EVENT, start );
	}, [ byId ] );

	const drag = useLayerDrag( {
		rows,
		selected,
		collapsed,
		onDrop: ( ids, where ) => fabric?.frames.moveLayers( ids, where ),
	} );

	if ( ! fabric ) {
		return null;
	}
	const { frames } = fabric;

	const select = ( row, e ) => {
		// A range may end on the artboard row; rangeOf() leaves it out.
		if ( e?.shiftKey && anchor.current ) {
			fabric.selectByIds( rangeOf( shown, anchor.current, row.id ) );
			return;
		}
		if ( row.kind === 'artboard' ) {
			if ( ! ( e?.metaKey || e?.ctrlKey ) ) {
				fabric.selectByIds( [] );
			}
			return;
		}
		if ( e?.metaKey || e?.ctrlKey ) {
			const next = selected.includes( row.id )
				? selected.filter( ( id ) => id !== row.id )
				: [ ...selected, row.id ];
			anchor.current = row.id;
			fabric.selectByIds( next );
			return;
		}
		anchor.current = row.id;
		fabric.selectByIds( [ row.id ] );
	};

	const toggle = ( id ) =>
		setCollapsed( ( prev ) => {
			const next = new Set( prev );
			if ( next.has( id ) ) {
				next.delete( id );
			} else {
				next.add( id );
			}
			return next;
		} );

	const openMenu = ( row, at ) => {
		if ( row.kind !== 'artboard' && ! selected.includes( row.id ) ) {
			fabric.selectByIds( [ row.id ] );
		} else if ( row.kind === 'artboard' ) {
			fabric.selectByIds( [] );
		}
		openContextMenu( at );
	};

	const targetsFor = ( row ) =>
		selected.includes( row.id ) ? rootsOf( rows, selected ) : [ row.id ];

	const onKeyDown = ( row, e ) => {
		const handled = () => {
			e.preventDefault();
			e.stopPropagation();
		};
		if ( e.altKey && ( e.key === 'ArrowUp' || e.key === 'ArrowDown' ) ) {
			handled();
			frames.shiftLayers(
				targetsFor( row ),
				e.key === 'ArrowUp' ? 1 : -1
			);
			return;
		}
		const i = shown.findIndex( ( r ) => r.id === row.id );
		const expanded = row.isFrame && ! collapsed.has( row.id );
		switch ( e.key ) {
			case 'ArrowDown':
				handled();
				if ( shown[ i + 1 ] ) {
					focusRow( shown[ i + 1 ].id );
				}
				break;
			case 'ArrowUp':
				handled();
				if ( shown[ i - 1 ] ) {
					focusRow( shown[ i - 1 ].id );
				}
				break;
			case 'Home':
				handled();
				focusRow( shown[ 0 ]?.id );
				break;
			case 'End':
				handled();
				focusRow( shown[ shown.length - 1 ]?.id );
				break;
			case 'ArrowRight':
				handled();
				if ( row.isFrame && row.childCount ) {
					if ( ! expanded ) {
						toggle( row.id );
					} else if ( shown[ i + 1 ]?.parentId === row.id ) {
						focusRow( shown[ i + 1 ].id );
					}
				}
				break;
			case 'ArrowLeft':
				handled();
				if ( row.isFrame && row.childCount && expanded ) {
					toggle( row.id );
				} else if ( row.parentId ) {
					focusRow( row.parentId );
				}
				break;
			case 'Enter':
			case ' ':
				handled();
				select( row, e );
				break;
			case 'F2':
				if ( row.kind !== 'artboard' ) {
					handled();
					setRenaming( row.id );
					setRenameValue( row.name );
				}
				break;
			case 'Delete':
			case 'Backspace':
				handled();
				frames.removeObjects(
					targetsFor( row )
						.map( ( id ) =>
							fabric
								.getFabric()
								.getObjects()
								.find( ( o ) => o.id === id )
						)
						.filter( Boolean ),
					__( 'Delete', 'socialframe' )
				);
				break;
			case 'ContextMenu': {
				handled();
				const box = e.currentTarget.getBoundingClientRect();
				openMenu( row, { x: box.left + 24, y: box.bottom } );
				break;
			}
			default:
				if ( e.key === 'F10' && e.shiftKey ) {
					handled();
					const box = e.currentTarget.getBoundingClientRect();
					openMenu( row, { x: box.left + 24, y: box.bottom } );
				} else if (
					( e.metaKey || e.ctrlKey ) &&
					e.key.toLowerCase() === 'd'
				) {
					handled();
					fabric.duplicateMany( targetsFor( row ) );
				}
		}
	};

	const finishRename = ( id, save ) => {
		const name = renameValue.trim();
		setRenaming( null );
		if ( save && name && name !== byId.get( id )?.name ) {
			fabric.renameById( id, name );
		}
		rowRefs.current.get( id )?.focus();
	};

	const siblings = ( row ) =>
		shown.filter(
			( r ) => r.parentId === row.parentId && r.depth === row.depth
		);

	return (
		<div
			className="socialframe-tree"
			role="tree"
			tabIndex={ -1 }
			aria-label={ __( 'Layers', 'socialframe' ) }
			aria-multiselectable="true"
			onDragOver={ drag.onListDragOver }
			onDragLeave={ drag.onListDragLeave }
		>
			{ shown.map( ( row ) => {
				const set = siblings( row );
				return (
					<LayerRow
						key={ row.id }
						ref={ ( el ) => {
							if ( el ) {
								rowRefs.current.set( row.id, el );
							} else {
								rowRefs.current.delete( row.id );
							}
						} }
						row={ row }
						level={ row.depth + 1 }
						setSize={ set.length }
						posInSet={
							set.findIndex( ( r ) => r.id === row.id ) + 1
						}
						selected={ selected.includes( row.id ) }
						focused={ focus === row.id }
						expanded={ ! collapsed.has( row.id ) }
						renaming={ renaming === row.id }
						renameValue={ renameValue }
						indicator={
							drag.indicator?.id === row.id
								? drag.indicator.zone
								: null
						}
						dragProps={ drag.rowProps( row ) }
						onClick={ ( e ) => {
							setFocusedId( row.id );
							select( row, e );
						} }
						onDoubleClick={ () => {
							if ( row.kind !== 'artboard' ) {
								setRenaming( row.id );
								setRenameValue( row.name );
							}
						} }
						onKeyDown={ ( e ) => onKeyDown( row, e ) }
						onContextMenu={ ( e ) => {
							e.preventDefault();
							setFocusedId( row.id );
							openMenu( row, { x: e.clientX, y: e.clientY } );
						} }
						onToggle={ () => toggle( row.id ) }
						onRenameChange={ setRenameValue }
						onRenameDone={ ( save ) =>
							finishRename( row.id, save )
						}
						onLock={ () =>
							frames.setLayersProps(
								[ row.id ],
								{ locked: ! row.locked },
								row.locked
									? __( 'Unlock', 'socialframe' )
									: __( 'Lock', 'socialframe' )
							)
						}
						onHide={ () =>
							frames.setLayersProps(
								[ row.id ],
								{ visible: ! row.visible },
								row.visible
									? __( 'Hide', 'socialframe' )
									: __( 'Show', 'socialframe' )
							)
						}
					/>
				);
			} ) }
			{ ! rows.some( ( r ) => r.kind !== 'artboard' ) && (
				<p className="socialframe-tree__empty">
					{ __(
						'No layers yet. Add text, shapes or images from the toolbar.',
						'socialframe'
					) }
				</p>
			) }
		</div>
	);
}
