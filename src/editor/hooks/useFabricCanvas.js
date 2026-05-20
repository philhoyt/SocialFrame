import { useRef, useEffect, useCallback } from '@wordpress/element';
import { useDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import * as fabric from 'fabric';
import { initAligningGuidelines } from 'fabric/extensions';

import { STORE_KEY } from '../store';
import { FORMATS } from '../utils/formats';
import {
	createShape,
	createText,
	getObjectType,
	extractProperties,
	genId,
	getDefaultLayerName,
} from '../utils/fabricHelpers';

const COLLAGE_LAYOUTS = {
	'split-h': [
		{ x: 0, y: 0, w: 0.5, h: 1 },
		{ x: 0.5, y: 0, w: 0.5, h: 1 },
	],
	'split-v': [
		{ x: 0, y: 0, w: 1, h: 0.5 },
		{ x: 0, y: 0.5, w: 1, h: 0.5 },
	],
	'big-left': [
		{ x: 0, y: 0, w: 0.5, h: 1 },
		{ x: 0.5, y: 0, w: 0.5, h: 0.5 },
		{ x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
	],
	'big-right': [
		{ x: 0, y: 0, w: 0.5, h: 0.5 },
		{ x: 0, y: 0.5, w: 0.5, h: 0.5 },
		{ x: 0.5, y: 0, w: 0.5, h: 1 },
	],
	thirds: [
		{ x: 0, y: 0, w: 1 / 3, h: 1 },
		{ x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
		{ x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
	],
};

// Custom properties that survive canvas.toJSON() / loadFromJSON().
const CUSTOM_PROPS = [
	'id',
	'isArtboard',
	'sfShapeType',
	'isCollageZone',
	'collageZoneId',
	'collageLayoutId',
	'zoneFracX',
	'zoneFracY',
	'zoneFracW',
	'zoneFracH',
];

/**
 * Take a full canvas snapshot for undo/redo.
 *
 * @param {fabric.Canvas} canvas
 * @return {Object} Serialised canvas state.
 */
function snapshot( canvas ) {
	return canvas.toJSON( CUSTOM_PROPS );
}

/**
 * Restore the canvas from a snapshot previously taken with `snapshot()`.
 *
 * @param {fabric.Canvas} canvas
 * @param {Object}        snap   Snapshot to restore.
 * @param {Object}        deps   { artboardWRef, artboardHRef, setupArtboardRef, dispatch }.
 */
async function restoreSnapshot( canvas, snap, deps ) {
	await canvas.loadFromJSON( snap );
	canvas.backgroundColor = null;
	const artboard = canvas.getObjects().find( ( o ) => isArtboardObject( o ) );
	if ( artboard ) {
		deps.artboardWRef.current = Math.round( artboard.width );
		deps.artboardHRef.current = Math.round( artboard.height );
		deps.setupArtboardRef.current?.( artboard );
	}
	syncLayersToStore( canvas, deps.dispatch );
	canvas.discardActiveObject();
	canvas.renderAll();
	deps.dispatch.clearSelection();
	deps.dispatch.markDirty();
}

/**
 * Build a collage zone placeholder rect from fractional zone data.
 *
 * @param {Object} zone     { x, y, w, h } in artboard fractions.
 * @param {number} artW     Artboard width in px.
 * @param {number} artH     Artboard height in px.
 * @param {number} gapPx    Gap between zones in px.
 * @param {string} layoutId Shared layout ID for all zones in this group.
 * @return {fabric.Rect} Configured placeholder rect ready to add to the canvas.
 */
function createZoneRect( zone, artW, artH, gapPx, layoutId ) {
	const half = gapPx / 2;
	const rawLeft = zone.x * artW;
	const rawTop = zone.y * artH;
	const rawRight = rawLeft + zone.w * artW;
	const rawBottom = rawTop + zone.h * artH;

	const atLeft = zone.x < 0.001;
	const atTop = zone.y < 0.001;
	const atRight = zone.x + zone.w > 0.999;
	const atBottom = zone.y + zone.h > 0.999;

	const left = atLeft ? rawLeft : rawLeft + half;
	const top = atTop ? rawTop : rawTop + half;
	const right = atRight ? rawRight : rawRight - half;
	const bottom = atBottom ? rawBottom : rawBottom - half;

	return new fabric.Rect( {
		left: Math.round( left ),
		top: Math.round( top ),
		width: Math.max( 1, Math.round( right - left ) ),
		height: Math.max( 1, Math.round( bottom - top ) ),
		fill: '#d0d0d0',
		stroke: gapPx > 0 ? null : '#ffffff',
		strokeWidth: gapPx > 0 ? 0 : 2,
		selectable: false,
		evented: true,
		hoverCursor: 'pointer',
		isCollageZone: true,
		collageZoneId: genId(),
		collageLayoutId: layoutId,
		zoneFracX: zone.x,
		zoneFracY: zone.y,
		zoneFracW: zone.w,
		zoneFracH: zone.h,
	} );
}

/**
 * Initializes and manages the Fabric.js canvas instance.
 *
 * ARCHITECTURE:
 *   The Fabric canvas is sized to fill its container (the canvas-area div).
 *   The artboard is represented as a non-selectable Fabric.Rect at (0,0) with
 *   isArtboard: true.  Zoom and pan are applied via Fabric's viewport transform
 *   so objects that overflow the artboard remain accessible.
 *
 *   Undo/redo uses full canvas snapshots (snapshot-based). Before any mutation,
 *   `canvas.toJSON(CUSTOM_PROPS)` captures a before state; after the mutation
 *   an after state is captured. Undo calls `canvas.loadFromJSON(before)` and
 *   redo calls `canvas.loadFromJSON(after)`. Every operation is undoable with
 *   no manual bookkeeping per operation.
 *
 * @param {import('react').RefObject<HTMLCanvasElement>} canvasRef          Ref attached to the <canvas> element.
 * @param {import('react').RefObject<HTMLDivElement>}    areaRef            Ref attached to the container div.
 * @param {Object}                                       options
 * @param {string}                                       options.format     Format key, e.g. 'instagram-post'.
 * @param {string}                                       options.fabricJson Initial JSON string (may be empty).
 * @return {Object} Stable imperative API consumed via FabricContext.
 */
export function useFabricCanvas( canvasRef, areaRef, { format, fabricJson } ) {
	const fabricRef = useRef( null );
	const artboardWRef = useRef( FORMATS[ format ]?.width ?? 1080 );
	const artboardHRef = useRef( FORMATS[ format ]?.height ?? 1080 );
	const artboardRectRef = useRef( null );
	const setupArtboardRef = useRef( null );
	const fitToScreenRef = useRef( null );
	const snapRef = useRef( { enabled: false, size: 20 } );
	const spaceRef = useRef( false );
	const isPanningRef = useRef( false );
	const panStartRef = useRef( { x: 0, y: 0 } );
	const dispatch = useDispatch( STORE_KEY );

	/**
	 * Wrap any synchronous canvas mutation with automatic snapshot-based undo.
	 * Captures before + after states, renders, and pushes a history entry.
	 *
	 * @param {string}   label  Human-readable label shown in the undo UI.
	 * @param {Function} mutate Called with the canvas; make changes here.
	 */
	const withHistory = useCallback(
		( label, mutate ) => {
			const canvas = fabricRef.current;
			if ( ! canvas ) {
				return;
			}
			const deps = {
				artboardWRef,
				artboardHRef,
				setupArtboardRef,
				dispatch,
			};
			const before = snapshot( canvas );
			mutate( canvas );
			canvas.renderAll();
			const after = snapshot( canvas );
			dispatch.pushHistory( {
				label,
				undo: () => restoreSnapshot( canvas, before, deps ),
				redo: () => restoreSnapshot( canvas, after, deps ),
			} );
			dispatch.markDirty();
		},
		[ dispatch ]
	);

	// Initialize Fabric once on mount.
	useEffect( () => {
		if ( ! canvasRef.current || ! areaRef.current ) {
			return;
		}

		const artW = artboardWRef.current;
		const artH = artboardHRef.current;
		const container = areaRef.current;
		const initialW = container.clientWidth || 800;
		const initialH = container.clientHeight || 600;

		const canvas = new fabric.Canvas( canvasRef.current, {
			width: initialW,
			height: initialH,
			preserveObjectStacking: true,
			selection: true,
			backgroundColor: null,
		} );

		fabricRef.current = canvas;

		// Position Fabric's wrapper at the top-left of the container.
		canvas.wrapperEl.style.position = 'absolute';
		canvas.wrapperEl.style.top = '0';
		canvas.wrapperEl.style.left = '0';

		// ── fitToScreen ───────────────────────────────────────────────────────
		const fitToScreen = () => {
			const vW = canvas.width;
			const vH = canvas.height;
			const w = artboardWRef.current;
			const h = artboardHRef.current;
			const zoom = Math.min( vW / w, vH / h ) * 0.9;
			const panX = ( vW - w * zoom ) / 2;
			const panY = ( vH - h * zoom ) / 2;
			canvas.setViewportTransform( [ zoom, 0, 0, zoom, panX, panY ] );
			dispatch.setZoom( Math.round( zoom * 100 ) );
		};
		fitToScreenRef.current = fitToScreen;

		// ── Artboard setup helper ─────────────────────────────────────────────
		const setupArtboard = ( artboardObj ) => {
			artboardObj.isArtboard = true;
			artboardObj.set( {
				selectable: false,
				evented: false,
				hoverCursor: 'default',
				shadow: new fabric.Shadow( {
					color: 'rgba(0,0,0,0.5)',
					blur: 24,
					offsetX: 0,
					offsetY: 4,
				} ),
			} );
			artboardRectRef.current = artboardObj;
			canvas.sendObjectToBack( artboardObj );
		};
		setupArtboardRef.current = setupArtboard;

		if ( fabricJson ) {
			// ── Load existing JSON ─────────────────────────────────────────────
			try {
				canvas.loadFromJSON( fabricJson ).then( () => {
					const allObjects = canvas.getObjects();

					const isArtboardCandidate = ( o ) =>
						isArtboardObject( o ) ||
						( o.type === 'rect' &&
							Math.abs( o.left ?? 0 ) < 1 &&
							Math.abs( o.top ?? 0 ) < 1 &&
							( o.width ?? 0 ) >= 100 &&
							( o.height ?? 0 ) >= 100 );

					const candidates = allObjects.filter( isArtboardCandidate );
					const best =
						candidates.find( ( o ) => isArtboardObject( o ) ) ??
						candidates[ 0 ];

					candidates.forEach( ( o ) => {
						if ( o !== best ) {
							canvas.remove( o );
						}
					} );

					if ( best ) {
						artboardWRef.current = Math.round( best.width ?? artW );
						artboardHRef.current = Math.round(
							best.height ?? artH
						);
						setupArtboard( best );
					} else {
						let artFill = canvas.backgroundColor ?? '#ffffff';

						if ( canvas.backgroundImage ) {
							const bgImg = canvas.backgroundImage;
							const pT = shapeFitTransform(
								bgImg.width,
								bgImg.height,
								artW,
								artH,
								'cover'
							);
							artFill = new fabric.Pattern( {
								source: bgImg.getElement(),
								repeat: 'no-repeat',
								patternTransform: pT,
							} );
							canvas.backgroundImage = null;
						}

						const artboard = createArtboardRect(
							artW,
							artH,
							artFill
						);
						canvas.add( artboard );
						setupArtboard( artboard );
					}

					canvas.backgroundColor = null;
					syncLayersToStore( canvas, dispatch );
					canvas.renderAll();
					fitToScreen();
				} );
			} catch ( e ) {
				// eslint-disable-next-line no-console -- warn if stored JSON is corrupt
				console.warn(
					'SocialFrame: could not load fabricJson, starting blank.',
					e
				);
			}
		} else {
			// ── Fresh canvas — create artboard ────────────────────────────────
			const artboard = createArtboardRect( artW, artH, '#ffffff' );
			canvas.add( artboard );
			setupArtboard( artboard );
			fitToScreen();
		}

		// ── Enable smart alignment guides ─────────────────────────────────────
		const cleanupGuides = initAligningGuidelines( canvas, {
			color: 'rgba(0, 115, 170, 0.85)',
			width: 1,
			margin: 6,
		} );

		// ── ResizeObserver — keep canvas filling the container ────────────────
		const resizeObserver = new ResizeObserver( ( entries ) => {
			for ( const entry of entries ) {
				const { width, height } = entry.contentRect;
				if ( ! width || ! height ) {
					continue;
				}
				canvas.setDimensions( { width, height } );
				fitToScreenRef.current?.();
			}
		} );
		resizeObserver.observe( container );

		// ── Selection bridge ──────────────────────────────────────────────────
		canvas.on( 'selection:created', ( e ) =>
			syncSelection( e.selected?.[ 0 ], dispatch )
		);
		canvas.on( 'selection:updated', ( e ) =>
			syncSelection( e.selected?.[ 0 ], dispatch )
		);
		canvas.on( 'selection:cleared', () => dispatch.clearSelection() );

		// Sync selection props live during transform so the panel updates in real time.
		const syncActive = () => {
			const active = canvas.getActiveObject();
			if ( active ) {
				syncSelection( active, dispatch );
			}
		};
		canvas.on( 'object:moving', syncActive );
		canvas.on( 'object:scaling', syncActive );
		canvas.on( 'object:rotating', syncActive );
		canvas.on( 'object:resizing', syncActive );

		// ── Snapshot-based undo for canvas transforms (drag/resize/rotate) ────
		// A snapshot is taken on mouse:down:before so it captures the full
		// canvas state before Fabric processes the transform. object:modified
		// fires after the transform completes and pushes the history entry.
		let preTransformSnap = null;

		canvas.on( 'mouse:down:before', () => {
			if ( spaceRef.current ) {
				// Pan mode — discard selection and skip snapshot.
				canvas.discardActiveObject();
				preTransformSnap = null;
				return;
			}
			const active = canvas.getActiveObject();
			if ( active && ! isArtboardObject( active ) ) {
				preTransformSnap = snapshot( canvas );
			} else {
				preTransformSnap = null;
			}
		} );

		canvas.on( 'object:modified', ( e ) => {
			dispatch.markDirty();
			syncActive();

			const obj = e.target;
			if ( ! obj || isArtboardObject( obj ) || ! preTransformSnap ) {
				preTransformSnap = null;
				return;
			}

			const action = e.transform?.action ?? '';
			let label;
			if ( action === 'drag' ) {
				label = 'Move';
			} else if ( action === 'rotate' ) {
				label = 'Rotate';
			} else if ( action.startsWith( 'scale' ) ) {
				label = 'Resize';
			} else {
				label = 'Transform';
			}

			const before = preTransformSnap;
			preTransformSnap = null;
			const after = snapshot( canvas );
			const deps = {
				artboardWRef,
				artboardHRef,
				setupArtboardRef,
				dispatch,
			};
			dispatch.pushHistory( {
				label,
				undo: () => restoreSnapshot( canvas, before, deps ),
				redo: () => restoreSnapshot( canvas, after, deps ),
			} );
		} );

		canvas.on( 'object:added', ( e ) => {
			if ( isArtboardObject( e.target ) ) {
				return;
			}
			dispatch.markDirty();
			syncLayersToStore( canvas, dispatch );
		} );
		canvas.on( 'object:removed', ( e ) => {
			if ( isArtboardObject( e.target ) ) {
				return;
			}
			dispatch.markDirty();
			syncLayersToStore( canvas, dispatch );
		} );

		// ── Snap to grid ──────────────────────────────────────────────────────
		canvas.on( 'object:moving', ( e ) => {
			if ( ! snapRef.current.enabled ) {
				return;
			}
			const { size } = snapRef.current;
			const obj = e.target;
			obj.set( {
				left: Math.round( obj.left / size ) * size,
				top: Math.round( obj.top / size ) * size,
			} );
		} );

		// ── Double-click on mr handle: fit textbox to content width ──────────
		canvas.on( 'mouse:dblclick', ( e ) => {
			const obj = e.target;
			if ( ! obj || obj.type !== 'textbox' ) {
				return;
			}

			const mr = obj.oCoords?.mr;
			const ptr = e.pointer;
			if (
				! mr ||
				! ptr ||
				Math.hypot( ptr.x - mr.x, ptr.y - mr.y ) > 12
			) {
				return;
			}

			const prevWidth = obj.width;
			obj.set( 'width', 9999 );
			obj.initDimensions();
			const targetLineCount = obj._textLines.length;

			let maxLineWidth = 0;
			for ( let i = 0; i < obj._textLines.length; i++ ) {
				const measured = obj._measureLine( i );
				if ( measured.width > maxLineWidth ) {
					maxLineWidth = measured.width;
				}
			}

			let naturalWidth = Math.max( Math.ceil( maxLineWidth ), 50 );
			obj.set( 'width', naturalWidth );
			obj.initDimensions();
			while (
				obj._textLines.length > targetLineCount &&
				naturalWidth < 9999
			) {
				naturalWidth += 1;
				obj.set( 'width', naturalWidth );
				obj.initDimensions();
			}

			canvas.renderAll();

			if ( naturalWidth !== prevWidth ) {
				const deps = {
					artboardWRef,
					artboardHRef,
					setupArtboardRef,
					dispatch,
				};
				// Snapshot AFTER the width change (before was already the live canvas state).
				// We use the before snapshot that preTransformSnap already captured if the
				// user had the object selected, but for simplicity use a direct pair here.
				const after = snapshot( canvas );
				// Reconstruct before: temporarily reset and re-snapshot.
				obj.set( 'width', prevWidth );
				obj.initDimensions();
				const before = snapshot( canvas );
				obj.set( 'width', naturalWidth );
				obj.initDimensions();
				canvas.renderAll();

				dispatch.markDirty();
				dispatch.pushHistory( {
					label: 'Fit text to content',
					undo: () => restoreSnapshot( canvas, before, deps ),
					redo: () => restoreSnapshot( canvas, after, deps ),
				} );
			}
		} );

		// ── Auto-delete empty text objects ────────────────────────────────────
		canvas.on( 'text:editing:exited', ( e ) => {
			const obj = e.target;
			if ( obj && obj.text.trim() === '' ) {
				canvas.remove( obj );
				canvas.discardActiveObject();
				canvas.renderAll();
				dispatch.clearSelection();
			}
		} );

		// ── Ctrl/Cmd + scroll-wheel zoom ──────────────────────────────────────
		const handleWheel = ( e ) => {
			if ( ! e.ctrlKey && ! e.metaKey ) {
				return;
			}
			e.preventDefault();
			const zoom = canvas.getZoom();
			const newZoom = Math.max(
				0.05,
				Math.min( 8, zoom * ( e.deltaY > 0 ? 0.9 : 1.1 ) )
			);
			canvas.zoomToPoint(
				new fabric.Point( e.offsetX, e.offsetY ),
				newZoom
			);
			dispatch.setZoom( Math.round( newZoom * 100 ) );
		};
		container.addEventListener( 'wheel', handleWheel, { passive: false } );

		// ── Space + drag pan ──────────────────────────────────────────────────
		canvas.on( 'mouse:down', ( e ) => {
			if ( ! spaceRef.current ) {
				return;
			}
			isPanningRef.current = true;
			panStartRef.current = { x: e.e.clientX, y: e.e.clientY };
			canvas.selection = false;
			canvas.setCursor( 'grabbing' );
		} );

		canvas.on( 'mouse:move', ( e ) => {
			if ( ! isPanningRef.current ) {
				return;
			}
			const dx = e.e.clientX - panStartRef.current.x;
			const dy = e.e.clientY - panStartRef.current.y;
			panStartRef.current = { x: e.e.clientX, y: e.e.clientY };
			canvas.relativePan( new fabric.Point( dx, dy ) );
		} );

		canvas.on( 'mouse:up', () => {
			if ( ! isPanningRef.current ) {
				return;
			}
			isPanningRef.current = false;
			canvas.selection = true;
			canvas.setCursor( spaceRef.current ? 'grab' : 'default' );
		} );

		const handleKeyDown = ( e ) => {
			if ( e.code !== 'Space' ) {
				return;
			}
			const tag = e.target?.ownerDocument?.activeElement?.tagName;
			if (
				tag === 'INPUT' ||
				tag === 'TEXTAREA' ||
				e.target?.ownerDocument?.activeElement?.isContentEditable
			) {
				return;
			}
			if ( fabricRef.current?._activeObject?.isEditing ) {
				return;
			}
			e.preventDefault();
			if ( ! spaceRef.current ) {
				spaceRef.current = true;
				canvas.defaultCursor = 'grab';
				canvas.hoverCursor = 'grab';
				canvas.setCursor( 'grab' );
			}
		};
		const handleKeyUp = ( e ) => {
			if ( e.code !== 'Space' ) {
				return;
			}
			spaceRef.current = false;
			isPanningRef.current = false;
			canvas.defaultCursor = 'default';
			canvas.hoverCursor = 'move';
			canvas.selection = true;
			canvas.setCursor( 'default' );
		};
		document.addEventListener( 'keydown', handleKeyDown );
		document.addEventListener( 'keyup', handleKeyUp );

		// ── Outside-artboard dim overlay ──────────────────────────────────────
		const drawOverlay = () => {
			const ctx = canvas.contextContainer;
			const vt = canvas.viewportTransform;
			const zoom = vt[ 0 ];
			const panX = vt[ 4 ];
			const panY = vt[ 5 ];

			const overlayW = artboardWRef.current;
			const overlayH = artboardHRef.current;

			const artL = panX;
			const artT = panY;
			const artR = panX + overlayW * zoom;
			const artB = panY + overlayH * zoom;
			const w = canvas.width;
			const h = canvas.height;

			ctx.save();
			ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';

			if ( artT > 0 ) {
				ctx.fillRect( 0, 0, w, artT );
			}
			if ( artB < h ) {
				ctx.fillRect( 0, artB, w, h - artB );
			}
			const midTop = Math.max( 0, artT );
			const midBot = Math.min( h, artB );
			const midH = midBot - midTop;
			if ( midH > 0 && artL > 0 ) {
				ctx.fillRect( 0, midTop, artL, midH );
			}
			if ( midH > 0 && artR < w ) {
				ctx.fillRect( artR, midTop, w - artR, midH );
			}

			ctx.restore();
		};
		canvas.on( 'after:render', drawOverlay );

		// ── Collage zone: single click fills with image ───────────────────────
		canvas.on( 'mouse:up', ( e ) => {
			if ( spaceRef.current || isPanningRef.current ) {
				return;
			}
			const obj = e.target;
			if ( ! obj?.isCollageZone ) {
				return;
			}
			if ( ! window.wp?.media ) {
				return;
			}

			const deps = {
				artboardWRef,
				artboardHRef,
				setupArtboardRef,
				dispatch,
			};
			const before = snapshot( canvas );

			const frame = window.wp.media( {
				title: __( 'Select Image', 'socialframe' ),
				button: { text: __( 'Fill Zone', 'socialframe' ) },
				multiple: false,
				library: { type: 'image' },
			} );

			frame.on( 'select', () => {
				const attachment = frame
					.state()
					.get( 'selection' )
					.first()
					.toJSON();
				const zoneLeft = obj.left;
				const zoneTop = obj.top;
				const zoneWidth = obj.width;
				const zoneHeight = obj.height;
				const zoneId = obj.collageZoneId;
				const layoutId = obj.collageLayoutId;

				fabric.Image.fromURL( attachment.url, {
					crossOrigin: 'anonymous',
				} ).then( ( img ) => {
					const clipRect = new fabric.Rect( {
						left: zoneLeft,
						top: zoneTop,
						width: zoneWidth,
						height: zoneHeight,
						absolutePositioned: true,
					} );

					const scale = Math.max(
						zoneWidth / img.width,
						zoneHeight / img.height
					);

					img.set( {
						left: zoneLeft + zoneWidth / 2,
						top: zoneTop + zoneHeight / 2,
						scaleX: scale,
						scaleY: scale,
						originX: 'center',
						originY: 'center',
						clipPath: clipRect,
						collageZoneId: zoneId,
						collageLayoutId: layoutId,
						hasControls: false,
						lockMovementX: true,
						lockMovementY: true,
						lockRotation: true,
						lockScalingX: true,
						lockScalingY: true,
						hoverCursor: 'default',
					} );

					canvas.remove( obj );
					canvas.add( img );
					canvas.discardActiveObject();
					canvas.renderAll();

					const after = snapshot( canvas );
					dispatch.pushHistory( {
						label: __( 'Fill collage zone', 'socialframe' ),
						undo: () => restoreSnapshot( canvas, before, deps ),
						redo: () => restoreSnapshot( canvas, after, deps ),
					} );
					dispatch.markDirty();
					syncLayersToStore( canvas, dispatch );
				} );
			} );

			frame.open();
		} );

		// ── Collage zone: double-click filled image to swap ───────────────────
		canvas.on( 'mouse:dblclick', ( e ) => {
			const obj = e.target;
			if ( ! obj?.collageZoneId || obj.type !== 'image' ) {
				return;
			}
			const clipPath = obj.clipPath;
			if ( ! clipPath ) {
				return;
			}
			if ( ! window.wp?.media ) {
				return;
			}

			const deps = {
				artboardWRef,
				artboardHRef,
				setupArtboardRef,
				dispatch,
			};
			const before = snapshot( canvas );

			const frame = window.wp.media( {
				title: __( 'Replace Image', 'socialframe' ),
				button: { text: __( 'Replace', 'socialframe' ) },
				multiple: false,
				library: { type: 'image' },
			} );

			frame.on( 'select', () => {
				const attachment = frame
					.state()
					.get( 'selection' )
					.first()
					.toJSON();
				const zoneLeft = clipPath.left;
				const zoneTop = clipPath.top;
				const zoneWidth = clipPath.width;
				const zoneHeight = clipPath.height;

				fabric.Image.fromURL( attachment.url, {
					crossOrigin: 'anonymous',
				} ).then( ( newImg ) => {
					const newClipRect = new fabric.Rect( {
						left: zoneLeft,
						top: zoneTop,
						width: zoneWidth,
						height: zoneHeight,
						absolutePositioned: true,
					} );

					const scale = Math.max(
						zoneWidth / newImg.width,
						zoneHeight / newImg.height
					);

					newImg.set( {
						left: zoneLeft + zoneWidth / 2,
						top: zoneTop + zoneHeight / 2,
						scaleX: scale,
						scaleY: scale,
						originX: 'center',
						originY: 'center',
						clipPath: newClipRect,
						collageZoneId: obj.collageZoneId,
						collageLayoutId: obj.collageLayoutId,
						hasControls: false,
						lockMovementX: true,
						lockMovementY: true,
						lockRotation: true,
						lockScalingX: true,
						lockScalingY: true,
						hoverCursor: 'default',
					} );

					canvas.remove( obj );
					canvas.add( newImg );
					canvas.discardActiveObject();
					canvas.renderAll();

					const after = snapshot( canvas );
					dispatch.pushHistory( {
						label: __( 'Replace collage image', 'socialframe' ),
						undo: () => restoreSnapshot( canvas, before, deps ),
						redo: () => restoreSnapshot( canvas, after, deps ),
					} );
					dispatch.markDirty();
					syncLayersToStore( canvas, dispatch );
				} );
			} );

			frame.open();
		} );

		return () => {
			canvas.off( 'after:render', drawOverlay );
			cleanupGuides();
			resizeObserver.disconnect();
			container.removeEventListener( 'wheel', handleWheel );
			document.removeEventListener( 'keydown', handleKeyDown );
			document.removeEventListener( 'keyup', handleKeyUp );
			canvas.dispose();
			fabricRef.current = null;
			artboardRectRef.current = null;
		};
		// Run once — fabricJson is loaded inside the effect on first mount.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [] );

	// ── Imperative API ────────────────────────────────────────────────────────

	const getFabric = useCallback( () => fabricRef.current, [] );

	const getJSON = useCallback( () => {
		return fabricRef.current?.toJSON( CUSTOM_PROPS ) ?? null;
	}, [] );

	/**
	 * Export the artboard as a PNG data URL.
	 */
	const toDataURL = useCallback( () => {
		const canvas = fabricRef.current;
		const artboard = artboardRectRef.current;
		if ( ! canvas ) {
			return null;
		}

		const artW = artboardWRef.current;
		const artH = artboardHRef.current;
		const prevVT = [ ...canvas.viewportTransform ];
		const prevW = canvas.width;
		const prevH = canvas.height;

		const prevShadow = artboard?.shadow ?? null;
		if ( artboard ) {
			artboard.set( 'shadow', null );
		}

		const prevActive = canvas.getActiveObject();
		canvas.discardActiveObject();

		canvas.setDimensions( { width: artW, height: artH } );
		canvas.setViewportTransform( [ 1, 0, 0, 1, 0, 0 ] );
		canvas.renderAll();

		const dataURL = canvas.lowerCanvasEl.toDataURL( 'image/png' );

		if ( artboard ) {
			artboard.set( 'shadow', prevShadow );
		}
		canvas.setDimensions( { width: prevW, height: prevH } );
		canvas.setViewportTransform( prevVT );
		if ( prevActive ) {
			canvas.setActiveObject( prevActive );
		}
		canvas.renderAll();

		return dataURL;
	}, [] );

	const loadFromJSON = useCallback(
		( json ) => {
			const canvas = fabricRef.current;
			if ( ! canvas ) {
				return;
			}
			const artW = artboardWRef.current;
			const artH = artboardHRef.current;
			canvas.clear();
			canvas.backgroundColor = null;
			canvas.loadFromJSON( json ).then( () => {
				canvas.backgroundColor = null;

				const allObjects = canvas.getObjects();
				const artboard =
					allObjects.find( ( o ) => isArtboardObject( o ) ) ??
					allObjects.find(
						( o ) =>
							o.type === 'rect' &&
							Math.abs( o.left ?? 0 ) < 1 &&
							Math.abs( o.top ?? 0 ) < 1 &&
							Math.round( o.width ?? 0 ) === artW &&
							Math.round( o.height ?? 0 ) === artH
					);
				if ( artboard ) {
					const newW = Math.round( artboard.width ?? artW );
					const newH = Math.round( artboard.height ?? artH );
					artboardWRef.current = newW;
					artboardHRef.current = newH;
					setupArtboardRef.current?.( artboard );
					fitToScreenRef.current?.();
				}
				syncLayersToStore( canvas, dispatch );
				canvas.renderAll();
				dispatch.markDirty();
			} );
		},
		[ dispatch ]
	);

	const setBackground = useCallback(
		( color ) => {
			const artboard = artboardRectRef.current;
			if ( ! artboard ) {
				return;
			}
			withHistory( 'Background color', () => {
				artboard.set( 'fill', color );
				artboard.dirty = true;
			} );
		},
		[ withHistory ]
	);

	const addShape = useCallback(
		( type, overrides = {} ) => {
			const shape = createShape( type, overrides );
			withHistory( `Add ${ type }`, ( canvas ) => {
				canvas.add( shape );
				canvas.setActiveObject( shape );
			} );
		},
		[ withHistory ]
	);

	const addText = useCallback(
		( role, overrides = {} ) => {
			const canvas = fabricRef.current;
			if ( ! canvas ) {
				return;
			}
			const text = createText( role, overrides );
			withHistory( `Add ${ role } text`, ( c ) => {
				c.add( text );
				c.setActiveObject( text );
			} );
			// Enter editing after the history snapshot is taken.
			text.enterEditing();
			text.selectAll();
			canvas.renderAll();
		},
		[ withHistory ]
	);

	const addImage = useCallback(
		( src, overrides = {} ) => {
			const canvas = fabricRef.current;
			if ( ! canvas ) {
				return;
			}
			const artW = artboardWRef.current;
			const artH = artboardHRef.current;
			const deps = {
				artboardWRef,
				artboardHRef,
				setupArtboardRef,
				dispatch,
			};
			const before = snapshot( canvas );

			fabric.Image.fromURL( src, { crossOrigin: 'anonymous' } ).then(
				( img ) => {
					const maxSize = Math.min( artW, artH ) * 0.6;
					if ( img.width > maxSize || img.height > maxSize ) {
						const scale =
							maxSize / Math.max( img.width, img.height );
						img.scale( scale );
					}
					img.set( {
						left: artW / 2 - img.getScaledWidth() / 2,
						top: artH / 2 - img.getScaledHeight() / 2,
						...overrides,
					} );
					canvas.add( img );
					canvas.setActiveObject( img );
					canvas.renderAll();

					const after = snapshot( canvas );
					dispatch.pushHistory( {
						label: 'Add image',
						undo: () => restoreSnapshot( canvas, before, deps ),
						redo: () => restoreSnapshot( canvas, after, deps ),
					} );
					dispatch.markDirty();
				}
			);
		},
		[ dispatch ]
	);

	const addCollageLayout = useCallback(
		( layoutKey, gapPx = 0 ) => {
			const zones = COLLAGE_LAYOUTS[ layoutKey ];
			if ( ! zones ) {
				return;
			}
			withHistory(
				__( 'Add collage layout', 'socialframe' ),
				( canvas ) => {
					// Remove unfilled placeholder zones before inserting new layout.
					canvas
						.getObjects()
						.filter( ( o ) => o.isCollageZone && o.type === 'rect' )
						.forEach( ( o ) => canvas.remove( o ) );

					const layoutId = genId();
					zones.forEach( ( zone ) => {
						canvas.add(
							createZoneRect(
								zone,
								artboardWRef.current,
								artboardHRef.current,
								gapPx,
								layoutId
							)
						);
					} );
				}
			);
		},
		[ withHistory ]
	);

	const setCollageGap = useCallback( ( gapPx ) => {
		const canvas = fabricRef.current;
		if ( ! canvas ) {
			return;
		}
		const artW = artboardWRef.current;
		const artH = artboardHRef.current;
		const half = gapPx / 2;

		canvas
			.getObjects()
			.filter(
				( o ) =>
					o.isCollageZone &&
					o.type === 'rect' &&
					o.zoneFracX !== undefined
			)
			.forEach( ( rect ) => {
				const rawLeft = rect.zoneFracX * artW;
				const rawTop = rect.zoneFracY * artH;
				const rawRight = rawLeft + rect.zoneFracW * artW;
				const rawBottom = rawTop + rect.zoneFracH * artH;

				const atLeft = rect.zoneFracX < 0.001;
				const atTop = rect.zoneFracY < 0.001;
				const atRight = rect.zoneFracX + rect.zoneFracW > 0.999;
				const atBottom = rect.zoneFracY + rect.zoneFracH > 0.999;

				const left = atLeft ? rawLeft : rawLeft + half;
				const top = atTop ? rawTop : rawTop + half;
				const right = atRight ? rawRight : rawRight - half;
				const bottom = atBottom ? rawBottom : rawBottom - half;

				rect.set( {
					left: Math.round( left ),
					top: Math.round( top ),
					width: Math.max( 1, Math.round( right - left ) ),
					height: Math.max( 1, Math.round( bottom - top ) ),
					stroke: gapPx > 0 ? null : '#ffffff',
					strokeWidth: gapPx > 0 ? 0 : 2,
				} );
				rect.setCoords();
			} );

		canvas.renderAll();
	}, [] );

	const updateSelected = useCallback(
		( props, label = 'Update' ) => {
			const canvas = fabricRef.current;
			const obj = canvas?.getActiveObject();
			if ( ! canvas || ! obj ) {
				return;
			}
			withHistory( label, () => {
				obj.set( props );
				if ( obj.type === 'i-text' || obj.type === 'textbox' ) {
					obj.initDimensions();
				}
				dispatch.updateSelectionProperties( props );
			} );
		},
		[ withHistory, dispatch ]
	);

	const deleteSelected = useCallback( () => {
		const canvas = fabricRef.current;
		const obj = canvas?.getActiveObject();
		if ( ! canvas || ! obj ) {
			return;
		}
		const isFilledZone =
			obj.collageZoneId && obj.type === 'image' && obj.clipPath;
		withHistory(
			isFilledZone
				? __( 'Remove collage image', 'socialframe' )
				: 'Delete object',
			( c ) => {
				if ( isFilledZone ) {
					c.add( createZonePlaceholder( obj ) );
				}
				c.remove( obj );
				c.discardActiveObject();
				dispatch.clearSelection();
			}
		);
	}, [ withHistory, dispatch ] );

	const fillShapeWithImage = useCallback(
		async ( src, fitMode = 'cover' ) => {
			const canvas = fabricRef.current;
			const shape = canvas?.getActiveObject();
			if ( ! canvas || ! shape ) {
				return;
			}
			const deps = {
				artboardWRef,
				artboardHRef,
				setupArtboardRef,
				dispatch,
			};
			const before = snapshot( canvas );

			const img = await fabric.Image.fromURL( src, {
				crossOrigin: 'anonymous',
			} );
			const pattern = new fabric.Pattern( {
				source: img.getElement(),
				repeat: 'no-repeat',
				patternTransform: shapeFitTransform(
					img.width,
					img.height,
					shape.width,
					shape.height,
					fitMode
				),
			} );

			shape.set( 'fill', pattern );
			canvas.renderAll();

			const after = snapshot( canvas );
			dispatch.pushHistory( {
				label: 'Fill shape with image',
				undo: () => restoreSnapshot( canvas, before, deps ),
				redo: () => restoreSnapshot( canvas, after, deps ),
			} );
			dispatch.markDirty();
		},
		[ dispatch ]
	);

	const updateShapeImageFit = useCallback(
		( fitMode ) => {
			const canvas = fabricRef.current;
			const shape = canvas?.getActiveObject();
			if ( ! canvas || ! shape || ! shape.fill?.patternTransform ) {
				return;
			}
			const imgEl = shape.fill.source;
			if ( ! imgEl ) {
				return;
			}
			const imgW = imgEl.naturalWidth || imgEl.width;
			const imgH = imgEl.naturalHeight || imgEl.height;

			withHistory( 'Change image fit', () => {
				shape.set(
					'fill',
					new fabric.Pattern( {
						source: imgEl,
						repeat: 'no-repeat',
						patternTransform: shapeFitTransform(
							imgW,
							imgH,
							shape.width,
							shape.height,
							fitMode
						),
					} )
				);
				shape.dirty = true;
			} );
		},
		[ withHistory ]
	);

	const setBackgroundImage = useCallback(
		async ( src, fitMode = 'cover' ) => {
			const canvas = fabricRef.current;
			const artboard = artboardRectRef.current;
			if ( ! canvas || ! artboard ) {
				return;
			}
			const artW = artboardWRef.current;
			const artH = artboardHRef.current;
			const deps = {
				artboardWRef,
				artboardHRef,
				setupArtboardRef,
				dispatch,
			};
			const before = snapshot( canvas );

			const img = await fabric.Image.fromURL( src, {
				crossOrigin: 'anonymous',
			} );
			const pattern = new fabric.Pattern( {
				source: img.getElement(),
				repeat: 'no-repeat',
				patternTransform: shapeFitTransform(
					img.width,
					img.height,
					artW,
					artH,
					fitMode
				),
			} );

			artboard.set( 'fill', pattern );
			artboard.dirty = true;
			canvas.renderAll();

			const after = snapshot( canvas );
			dispatch.pushHistory( {
				label: 'Set background image',
				undo: () => restoreSnapshot( canvas, before, deps ),
				redo: () => restoreSnapshot( canvas, after, deps ),
			} );
			dispatch.markDirty();
		},
		[ dispatch ]
	);

	const updateBackgroundImageFit = useCallback(
		( fitMode ) => {
			const canvas = fabricRef.current;
			const artboard = artboardRectRef.current;
			if ( ! canvas || ! artboard || ! artboard.fill?.source ) {
				return;
			}
			const artW = artboardWRef.current;
			const artH = artboardHRef.current;
			const imgEl = artboard.fill.source;
			const imgW = imgEl.naturalWidth || imgEl.width;
			const imgH = imgEl.naturalHeight || imgEl.height;

			withHistory( 'Change background fit', () => {
				artboard.set(
					'fill',
					new fabric.Pattern( {
						source: imgEl,
						repeat: 'no-repeat',
						patternTransform: shapeFitTransform(
							imgW,
							imgH,
							artW,
							artH,
							fitMode
						),
					} )
				);
				artboard.dirty = true;
			} );
		},
		[ withHistory ]
	);

	const clearBackgroundImage = useCallback( () => {
		const artboard = artboardRectRef.current;
		if ( ! artboard ) {
			return;
		}
		withHistory( 'Remove background image', () => {
			artboard.set( 'fill', '#ffffff' );
		} );
	}, [ withHistory ] );

	const getBackgroundImageSrc = useCallback( () => {
		const artboard = artboardRectRef.current;
		if ( ! artboard?.fill?.source ) {
			return null;
		}
		return artboard.fill.source.src ?? null;
	}, [] );

	// ── Zoom / pan controls ───────────────────────────────────────────────────

	const fitView = useCallback( () => {
		fitToScreenRef.current?.();
	}, [] );

	const zoomIn = useCallback( () => {
		const canvas = fabricRef.current;
		if ( ! canvas ) {
			return;
		}
		const center = new fabric.Point( canvas.width / 2, canvas.height / 2 );
		const newZoom = Math.min( canvas.getZoom() * 1.25, 8 );
		canvas.zoomToPoint( center, newZoom );
		dispatch.setZoom( Math.round( newZoom * 100 ) );
	}, [ dispatch ] );

	const zoomOut = useCallback( () => {
		const canvas = fabricRef.current;
		if ( ! canvas ) {
			return;
		}
		const center = new fabric.Point( canvas.width / 2, canvas.height / 2 );
		const newZoom = Math.max( canvas.getZoom() / 1.25, 0.05 );
		canvas.zoomToPoint( center, newZoom );
		dispatch.setZoom( Math.round( newZoom * 100 ) );
	}, [ dispatch ] );

	// ── Alignment ─────────────────────────────────────────────────────────────

	const alignObject = useCallback(
		( direction ) => {
			const canvas = fabricRef.current;
			const obj = canvas?.getActiveObject();
			if ( ! canvas || ! obj ) {
				return;
			}
			withHistory( `Align ${ direction }`, () => {
				const bbox = obj.getBoundingRect();
				const offsetL = obj.left - bbox.left;
				const offsetT = obj.top - bbox.top;
				const artW = artboardWRef.current;
				const artH = artboardHRef.current;

				let newLeft = obj.left;
				let newTop = obj.top;

				switch ( direction ) {
					case 'left':
						newLeft = offsetL;
						break;
					case 'centerH':
						newLeft = ( artW - bbox.width ) / 2 + offsetL;
						break;
					case 'right':
						newLeft = artW - bbox.width + offsetL;
						break;
					case 'top':
						newTop = offsetT;
						break;
					case 'centerV':
						newTop = ( artH - bbox.height ) / 2 + offsetT;
						break;
					case 'bottom':
						newTop = artH - bbox.height + offsetT;
						break;
				}

				obj.set( { left: newLeft, top: newTop } );
				obj.setCoords();
				syncSelection( obj, dispatch );
			} );
		},
		[ withHistory, dispatch ]
	);

	const setSnapToGrid = useCallback( ( enabled, size = 20 ) => {
		snapRef.current = { enabled, size };
	}, [] );

	const getSnapToGrid = useCallback( () => ( { ...snapRef.current } ), [] );

	// ── Layer management ──────────────────────────────────────────────────────

	const selectById = useCallback( ( id ) => {
		const canvas = fabricRef.current;
		const obj = canvas?.getObjects().find( ( o ) => o.id === id );
		if ( ! canvas || ! obj ) {
			return;
		}
		canvas.setActiveObject( obj );
		canvas.renderAll();
	}, [] );

	const moveLayerUp = useCallback(
		( id ) => {
			withHistory( 'Move layer up', ( canvas ) => {
				const obj = canvas.getObjects().find( ( o ) => o.id === id );
				if ( ! obj ) {
					return;
				}
				canvas.bringObjectForward( obj );
				syncLayersToStore( canvas, dispatch );
			} );
		},
		[ withHistory, dispatch ]
	);

	const moveLayerDown = useCallback(
		( id ) => {
			withHistory( 'Move layer down', ( canvas ) => {
				const objects = canvas.getObjects();
				const obj = objects.find( ( o ) => o.id === id );
				if ( ! obj ) {
					return;
				}

				const minIdx = objects.findIndex(
					( o ) => ! isArtboardObject( o )
				);
				if ( objects.indexOf( obj ) <= minIdx ) {
					return;
				}

				canvas.sendObjectBackwards( obj );
				syncLayersToStore( canvas, dispatch );
			} );
		},
		[ withHistory, dispatch ]
	);

	const duplicateById = useCallback(
		async ( id ) => {
			const canvas = fabricRef.current;
			const obj = canvas?.getObjects().find( ( o ) => o.id === id );
			if ( ! canvas || ! obj ) {
				return;
			}
			const deps = {
				artboardWRef,
				artboardHRef,
				setupArtboardRef,
				dispatch,
			};
			const before = snapshot( canvas );

			const clone = await obj.clone();
			clone.set( {
				id: genId(),
				left: ( obj.left ?? 0 ) + 20,
				top: ( obj.top ?? 0 ) + 20,
			} );
			if ( obj.name ) {
				clone.name = obj.name;
			}
			canvas.add( clone );
			canvas.setActiveObject( clone );
			canvas.renderAll();
			syncLayersToStore( canvas, dispatch );

			const after = snapshot( canvas );
			dispatch.pushHistory( {
				label: 'Duplicate layer',
				undo: () => restoreSnapshot( canvas, before, deps ),
				redo: () => restoreSnapshot( canvas, after, deps ),
			} );
			dispatch.markDirty();
		},
		[ dispatch ]
	);

	const deleteById = useCallback(
		( id ) => {
			withHistory( 'Delete layer', ( canvas ) => {
				const obj = canvas.getObjects().find( ( o ) => o.id === id );
				if ( ! obj ) {
					return;
				}

				const isFilledZone =
					obj.collageZoneId && obj.type === 'image' && obj.clipPath;
				if ( isFilledZone ) {
					canvas.add( createZonePlaceholder( obj ) );
				}
				canvas.remove( obj );
				canvas.discardActiveObject();
				dispatch.clearSelection();
				syncLayersToStore( canvas, dispatch );
			} );
		},
		[ withHistory, dispatch ]
	);

	const renameById = useCallback(
		( id, name ) => {
			withHistory( 'Rename layer', ( canvas ) => {
				const obj = canvas.getObjects().find( ( o ) => o.id === id );
				if ( ! obj ) {
					return;
				}
				obj.name = name;
				syncLayersToStore( canvas, dispatch );
			} );
		},
		[ withHistory, dispatch ]
	);

	const duplicateSelected = useCallback( async () => {
		const canvas = fabricRef.current;
		const obj = canvas?.getActiveObject();
		if ( ! canvas || ! obj ) {
			return;
		}
		const deps = {
			artboardWRef,
			artboardHRef,
			setupArtboardRef,
			dispatch,
		};
		const before = snapshot( canvas );

		const clone = await obj.clone();
		clone.set( {
			id: genId(),
			left: ( obj.left ?? 0 ) + 20,
			top: ( obj.top ?? 0 ) + 20,
		} );
		if ( obj.name ) {
			clone.name = obj.name;
		}
		canvas.add( clone );
		canvas.setActiveObject( clone );
		canvas.renderAll();
		syncLayersToStore( canvas, dispatch );

		const after = snapshot( canvas );
		dispatch.pushHistory( {
			label: 'Duplicate',
			undo: () => restoreSnapshot( canvas, before, deps ),
			redo: () => restoreSnapshot( canvas, after, deps ),
		} );
		dispatch.markDirty();
	}, [ dispatch ] );

	const setLayerLocked = useCallback(
		( id, locked ) => {
			withHistory( locked ? 'Lock layer' : 'Unlock layer', ( canvas ) => {
				const obj = canvas.getObjects().find( ( o ) => o.id === id );
				if ( ! obj ) {
					return;
				}
				obj.set( { selectable: ! locked, evented: ! locked } );
				if ( locked ) {
					canvas.discardActiveObject();
				}
				syncLayersToStore( canvas, dispatch );
			} );
		},
		[ withHistory, dispatch ]
	);

	const setLayerVisible = useCallback(
		( id, visible ) => {
			withHistory( visible ? 'Show layer' : 'Hide layer', ( canvas ) => {
				const obj = canvas.getObjects().find( ( o ) => o.id === id );
				if ( ! obj ) {
					return;
				}
				obj.set( 'visible', visible );
				syncLayersToStore( canvas, dispatch );
			} );
		},
		[ withHistory, dispatch ]
	);

	const replaceImage = useCallback(
		async ( url ) => {
			const canvas = fabricRef.current;
			const obj = canvas?.getActiveObject();
			if ( ! canvas || ! obj || obj.type !== 'image' ) {
				return;
			}
			const deps = {
				artboardWRef,
				artboardHRef,
				setupArtboardRef,
				dispatch,
			};
			const before = snapshot( canvas );

			const newImg = await fabric.Image.fromURL( url, {
				crossOrigin: 'anonymous',
			} );
			obj.setElement( newImg.getElement() );
			canvas.renderAll();

			const after = snapshot( canvas );
			dispatch.pushHistory( {
				label: 'Replace image',
				undo: () => restoreSnapshot( canvas, before, deps ),
				redo: () => restoreSnapshot( canvas, after, deps ),
			} );
			dispatch.markDirty();
		},
		[ dispatch ]
	);

	return {
		getFabric,
		getJSON,
		toDataURL,
		loadFromJSON,
		setBackground,
		addShape,
		addText,
		addImage,
		addCollageLayout,
		setCollageGap,
		updateSelected,
		deleteSelected,
		replaceImage,
		fillShapeWithImage,
		updateShapeImageFit,
		setBackgroundImage,
		updateBackgroundImageFit,
		clearBackgroundImage,
		getBackgroundImageSrc,
		alignObject,
		setSnapToGrid,
		getSnapToGrid,
		fitView,
		zoomIn,
		zoomOut,
		selectById,
		moveLayerUp,
		moveLayerDown,
		duplicateById,
		deleteById,
		renameById,
		duplicateSelected,
		setLayerLocked,
		setLayerVisible,
	};
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Create the artboard sentinel rect.
 *
 * @param {number} artW Artboard width in canvas pixels.
 * @param {number} artH Artboard height in canvas pixels.
 * @param {*}      fill Fabric fill value (color string or Pattern).
 * @return {fabric.Rect} The artboard rectangle object.
 */
function createArtboardRect( artW, artH, fill ) {
	return new fabric.Rect( {
		id: 'artboard',
		isArtboard: true,
		width: artW,
		height: artH,
		fill,
		selectable: false,
		evented: false,
		hoverCursor: 'default',
	} );
}

/**
 * Reconstruct the placeholder Rect for a collage zone from a filled zone image.
 * Used when deleting a collage zone image so the zone stays fillable.
 *
 * @param {fabric.Image} img A collage zone image (must have collageZoneId, clipPath).
 * @return {fabric.Rect} A new placeholder rect matching the original zone.
 */
function createZonePlaceholder( img ) {
	const clip = img.clipPath;
	return new fabric.Rect( {
		left: clip.left,
		top: clip.top,
		width: clip.width,
		height: clip.height,
		fill: '#d0d0d0',
		stroke: '#ffffff',
		strokeWidth: 2,
		selectable: false,
		evented: true,
		hoverCursor: 'pointer',
		isCollageZone: true,
		collageZoneId: img.collageZoneId,
		collageLayoutId: img.collageLayoutId,
	} );
}

/**
 * Compute the patternTransform matrix [a,b,c,d,e,f] that positions an image
 * inside a shape's local coordinate space.
 *
 * Fabric v6 pre-shifts the pattern context by (-width/2, -height/2) before
 * applying patternTransform, so (0,0) in patternTransform space is the
 * TOP-LEFT of the shape's bounding box.  The shape spans (0,0)→(shapeW,shapeH).
 *
 * @param {number} imgW    Image natural width.
 * @param {number} imgH    Image natural height.
 * @param {number} shapeW  Shape unscaled width.
 * @param {number} shapeH  Shape unscaled height.
 * @param {string} fitMode 'cover'|'contain'|'fill'|'none'
 * @return {number[]} 6-element transform matrix.
 */
function shapeFitTransform( imgW, imgH, shapeW, shapeH, fitMode ) {
	switch ( fitMode ) {
		case 'cover': {
			const s = Math.max( shapeW / imgW, shapeH / imgH );
			return [
				s,
				0,
				0,
				s,
				( shapeW - imgW * s ) / 2,
				( shapeH - imgH * s ) / 2,
			];
		}
		case 'contain': {
			const s = Math.min( shapeW / imgW, shapeH / imgH );
			return [
				s,
				0,
				0,
				s,
				( shapeW - imgW * s ) / 2,
				( shapeH - imgH * s ) / 2,
			];
		}
		case 'fill':
			return [ shapeW / imgW, 0, 0, shapeH / imgH, 0, 0 ];
		default: // 'none' — natural size, centred within the shape
			return [ 1, 0, 0, 1, ( shapeW - imgW ) / 2, ( shapeH - imgH ) / 2 ];
	}
}

/**
 * Read a Fabric object's type and properties and write the selection to the store.
 *
 * @param {fabric.Object} obj      Selected Fabric object.
 * @param {Object}        dispatch Store dispatch object.
 */
function syncSelection( obj, dispatch ) {
	if ( ! obj ) {
		return;
	}
	const type = getObjectType( obj );
	const properties = extractProperties( obj, type );
	dispatch.setSelection( {
		type,
		objectId: obj.id ?? null,
		properties,
	} );
}

/**
 * @param {fabric.Object} o
 * @return {boolean} True if the object is the artboard sentinel.
 */
function isArtboardObject( o ) {
	return o.isArtboard || o.id === 'artboard';
}

function syncLayersToStore( canvas, dispatch ) {
	const objects = canvas
		.getObjects()
		.filter( ( o ) => ! isArtboardObject( o ) );
	objects.forEach( ( obj ) => {
		if ( ! obj.id ) {
			obj.id = genId();
		}
	} );
	const layers = [ ...objects ].reverse().map( ( obj ) => ( {
		id: obj.id,
		name: obj.name || getDefaultLayerName( obj ),
		type: getObjectType( obj ),
		locked: ! ( obj.selectable ?? true ),
		visible: obj.visible ?? true,
	} ) );
	dispatch.setLayers( layers );
}
