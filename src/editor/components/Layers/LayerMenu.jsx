import { useMemo, useRef } from '@wordpress/element';
import { useDispatch, useSelect } from '@wordpress/data';
import {
	MenuGroup,
	MenuItem,
	NavigableMenu,
	Popover,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';
import { resolveDrop, rootsOf } from '../../utils/layerTree';
import { RENAME_EVENT } from './LayerTree';

/**
 * The layer menu, opened by right-clicking a layer in the tree or on the
 * canvas (or Shift+F10 in the tree). It acts on the whole selection as it
 * was when the menu opened; with nothing selected it offers the artboard's
 * content layout.
 */
export function LayerMenu() {
	const fabric = useFabric();
	const { at, rows, selected } = useSelect( ( select ) => {
		const store = select( STORE_KEY );
		const selection = store.getSelection();
		return {
			at: store.getContextMenu(),
			rows: store.getLayers(),
			selected:
				selection.type === 'multi'
					? ( selection.properties?.ids ?? [] )
					: [ selection.objectId ].filter( Boolean ),
		};
	}, [] );
	const { closeContextMenu } = useDispatch( STORE_KEY );
	const opener = useRef( null );

	// Remember what had focus so it gets it back when the menu closes. This
	// runs while rendering, before the menu's own effects move focus, and
	// before the menu has a node of its own.
	if ( at && ! opener.current ) {
		// eslint-disable-next-line @wordpress/no-global-active-element
		opener.current = document.activeElement;
	}

	const anchor = useMemo(
		() =>
			at && {
				getBoundingClientRect: () =>
					new window.DOMRect( at.x, at.y, 0, 0 ),
			},
		[ at ]
	);

	if ( ! at || ! fabric ) {
		return null;
	}
	const { frames } = fabric;
	const byId = new Map( rows.map( ( r ) => [ r.id, r ] ) );
	const roots = rootsOf( rows, selected );
	const artboard = rows.find( ( r ) => r.kind === 'artboard' );

	const close = () => {
		closeContextMenu();
		const back = opener.current;
		opener.current = null;
		if ( back?.isConnected ) {
			back.focus();
		}
	};
	const run = ( fn ) => () => {
		close();
		fn();
	};

	if ( ! roots.length ) {
		return (
			<Popover
				anchor={ anchor }
				placement="bottom-start"
				onClose={ close }
				focusOnMount="firstElement"
				className="socialframe-layer-menu"
			>
				<NavigableMenu aria-label={ __( 'Artboard', 'socialframe' ) }>
					<MenuGroup>
						<MenuItem
							onClick={ run( () =>
								frames.setArtboardLayout(
									! artboard?.hasLayout
								)
							) }
						>
							{ artboard?.hasLayout
								? __( 'Turn off content layout', 'socialframe' )
								: __( 'Lay out content', 'socialframe' ) }
						</MenuItem>
					</MenuGroup>
				</NavigableMenu>
			</Popover>
		);
	}

	const objectsOf = ( ids ) => {
		const canvas = fabric.getFabric();
		return ids
			.map( ( id ) => canvas?.getObjects().find( ( o ) => o.id === id ) )
			.filter( Boolean );
	};
	const createProblem = frames.createProblem( roots );
	const parents = new Set( roots.map( ( id ) => byId.get( id )?.parentId ) );
	const targets = rows.filter(
		( r ) =>
			r.isFrame &&
			! ( parents.size === 1 && parents.has( r.id ) ) &&
			resolveDrop( rows, roots, r.id, 'inside' )
	);
	// Layers in a frame other than the artboard; they go back on top of it.
	const nested = roots.filter( ( id ) => {
		const parent = byId.get( byId.get( id )?.parentId );
		return parent && parent.kind !== 'artboard';
	} );
	const topFrameOf = ( id ) => {
		let cur = byId.get( id );
		while (
			cur?.parentId &&
			byId.get( cur.parentId )?.kind !== 'artboard'
		) {
			cur = byId.get( cur.parentId );
		}
		return cur?.id;
	};
	const frameIds = roots.filter(
		( id ) => byId.get( id )?.isFrame && byId.get( id )?.kind !== 'artboard'
	);
	const allLocked = roots.every( ( id ) => byId.get( id )?.locked );
	const allHidden = roots.every( ( id ) => ! byId.get( id )?.visible );

	return (
		<Popover
			anchor={ anchor }
			placement="bottom-start"
			onClose={ close }
			focusOnMount="firstElement"
			className="socialframe-layer-menu"
		>
			<NavigableMenu aria-label={ __( 'Layer actions', 'socialframe' ) }>
				<MenuGroup>
					<MenuItem
						disabled={ !! createProblem }
						accessibleWhenDisabled
						info={ createProblem || undefined }
						onClick={ run( () => frames.createFrame( roots ) ) }
					>
						{ __( 'Create frame', 'socialframe' ) }
					</MenuItem>
					{ nested.length > 0 && (
						<MenuItem
							onClick={ run( () =>
								frames.moveLayers( nested, {
									before: topFrameOf( nested[ 0 ] ),
								} )
							) }
						>
							{ __( 'Remove from frame', 'socialframe' ) }
						</MenuItem>
					) }
					{ frameIds.length > 0 && (
						<MenuItem
							onClick={ run( () =>
								frames.removeFrames( frameIds )
							) }
						>
							{ __(
								'Remove frame (keep layers)',
								'socialframe'
							) }
						</MenuItem>
					) }
				</MenuGroup>
				{ targets.length > 0 && (
					<MenuGroup label={ __( 'Add to frame', 'socialframe' ) }>
						{ targets.map( ( t ) => (
							<MenuItem
								key={ t.id }
								onClick={ run( () =>
									frames.moveLayers( roots, {
										parentId: t.id,
									} )
								) }
							>
								{ t.kind === 'artboard'
									? __(
											'Artboard content layout',
											'socialframe'
										)
									: t.name }
							</MenuItem>
						) ) }
					</MenuGroup>
				) }
				<MenuGroup>
					<MenuItem
						shortcut="⌘D"
						onClick={ run( () => fabric.duplicateMany( roots ) ) }
					>
						{ __( 'Duplicate', 'socialframe' ) }
					</MenuItem>
					<MenuItem
						onClick={ run( () => frames.shiftLayers( roots, 1 ) ) }
					>
						{ __( 'Bring forward', 'socialframe' ) }
					</MenuItem>
					<MenuItem
						onClick={ run( () => frames.shiftLayers( roots, -1 ) ) }
					>
						{ __( 'Send backward', 'socialframe' ) }
					</MenuItem>
				</MenuGroup>
				<MenuGroup>
					<MenuItem
						onClick={ run( () =>
							frames.setLayersProps(
								roots,
								{ locked: ! allLocked },
								allLocked
									? __( 'Unlock', 'socialframe' )
									: __( 'Lock', 'socialframe' )
							)
						) }
					>
						{ allLocked
							? __( 'Unlock', 'socialframe' )
							: __( 'Lock', 'socialframe' ) }
					</MenuItem>
					<MenuItem
						onClick={ run( () =>
							frames.setLayersProps(
								roots,
								{ visible: allHidden },
								allHidden
									? __( 'Show', 'socialframe' )
									: __( 'Hide', 'socialframe' )
							)
						) }
					>
						{ allHidden
							? __( 'Show', 'socialframe' )
							: __( 'Hide', 'socialframe' ) }
					</MenuItem>
					{ roots.length === 1 && (
						<MenuItem
							shortcut="F2"
							onClick={ () => {
								closeContextMenu();
								opener.current = null;
								window.dispatchEvent(
									new window.CustomEvent( RENAME_EVENT, {
										detail: { id: roots[ 0 ] },
									} )
								);
							} }
						>
							{ __( 'Rename', 'socialframe' ) }
						</MenuItem>
					) }
				</MenuGroup>
				<MenuGroup>
					<MenuItem
						isDestructive
						onClick={ run( () =>
							frames.removeObjects(
								objectsOf( roots ),
								__( 'Delete', 'socialframe' )
							)
						) }
					>
						{ __( 'Delete', 'socialframe' ) }
					</MenuItem>
				</MenuGroup>
			</NavigableMenu>
		</Popover>
	);
}
