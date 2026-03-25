import { useRef, useEffect, useCallback } from '@wordpress/element';
import { useDispatch } from '@wordpress/data';
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

/**
 * Initializes and manages the Fabric.js canvas instance.
 *
 * ARCHITECTURE:
 *   The Fabric canvas is sized to fill its container (the canvas-area div).
 *   The artboard is represented as a non-selectable Fabric.Rect at (0,0) with
 *   isArtboard: true.  Zoom and pan are applied via Fabric's viewport transform
 *   so objects that overflow the artboard remain accessible.
 *
 * @param {React.RefObject} canvasRef          Ref attached to the <canvas> element.
 * @param {React.RefObject} areaRef            Ref attached to the container div.
 * @param {Object}          options
 * @param {string}          options.format     Format key, e.g. 'instagram-post'.
 * @param {string}          options.fabricJson Initial JSON string (may be empty).
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
			// Read from refs so this works correctly after a template load changes
			// the artboard dimensions.
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
			// Store in ref so loadFromJSON can call it after template loads.
			// Re-stamp isArtboard so it survives future in-memory cycles even if
			// Fabric v6 didn't restore the custom property from JSON on load.
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
					// Fabric v6 does not reliably restore custom properties (id,
					// isArtboard) after loadFromJSON, so we use three layers of
					// detection in order of specificity:
					//   1. isArtboard flag (set in-memory, may not survive JSON)
					//   2. id === 'artboard' (serialised custom prop, may not survive)
					//   3. Geometry: a rect at (0,0) whose dimensions match the format
					const allObjects = canvas.getObjects();

					// Geometry fallback: any rect at (0,0) that is reasonably large.
					// This covers the case where a template with different dimensions
					// was saved — the format-derived artW/artH won't match.
					const isArtboardCandidate = ( o ) =>
						isArtboardObject( o ) ||
						( o.type === 'rect' &&
							Math.abs( o.left ?? 0 ) < 1 &&
							Math.abs( o.top ?? 0 ) < 1 &&
							( o.width ?? 0 ) >= 100 &&
							( o.height ?? 0 ) >= 100 );

					// Remove every artboard candidate first, keeping the best one.
					// This cleans up duplicate rects that may have been created by
					// previous broken loads (one from JSON + one from the else-branch).
					const candidates = allObjects.filter( isArtboardCandidate );

					// Keep the first candidate (prefer one with known markers).
					const best =
						candidates.find( ( o ) => isArtboardObject( o ) ) ??
						candidates[ 0 ];

					// Remove any extra duplicates silently (don't fire object:removed listener).
					candidates.forEach( ( o ) => {
						if ( o !== best ) {
							canvas.remove( o );
						}
					} );

					if ( best ) {
						// Update dimension refs from the actual artboard so fitToScreen
						// and the overlay use the correct size (template may differ from format).
						artboardWRef.current = Math.round( best.width ?? artW );
						artboardHRef.current = Math.round( best.height ?? artH );
						setupArtboard( best );
					} else {
						// Truly blank / old-format canvas — migrate backgroundColor.
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
				// eslint-disable-next-line no-console
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

		// Mark dirty, sync selection, and push a history entry for every
		// direct canvas transform (drag, resize, rotate).
		canvas.on( 'object:modified', ( e ) => {
			dispatch.markDirty();
			syncActive();

			const obj = e.target;
			if ( ! obj || isArtboardObject( obj ) ) {
				return;
			}

			const original = e.transform?.original;
			if ( ! original ) {
				return;
			}

			const KEYS = [
				'left',
				'top',
				'scaleX',
				'scaleY',
				'angle',
				'flipX',
				'flipY',
				'skewX',
				'skewY',
			];
			const before = Object.fromEntries(
				KEYS.map( ( k ) => [ k, original[ k ] ] )
			);
			const after = Object.fromEntries(
				KEYS.map( ( k ) => [ k, obj[ k ] ] )
			);

			const action = e.transform?.action ?? '';
			const label =
				action === 'drag'
					? 'Move'
					: action === 'rotate'
					? 'Rotate'
					: action.startsWith( 'scale' )
					? 'Resize'
					: 'Transform';

			dispatch.pushHistory( {
				label,
				undo: () => {
					obj.set( before );
					obj.setCoords();
					canvas.requestRenderAll();
					dispatch.markDirty();
				},
				redo: () => {
					obj.set( after );
					obj.setCoords();
					canvas.requestRenderAll();
					dispatch.markDirty();
				},
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

		// ── Double-click on mr handle: fit textbox to content width ─────────
		canvas.on( 'mouse:dblclick', ( e ) => {
			const obj = e.target;
			if ( ! obj || obj.type !== 'textbox' ) {
				return;
			}

			// Only trigger when the double-click lands on the middle-right (mr)
			// transform handle. oCoords and absolutePointer are both in scene
			// (canvas) coordinates so the distance check is straightforward.
			// oCoords are in viewport space (canvas element px); e.pointer matches.
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

			// Use _measureLine to get the widest line at unconstrained width.
			let maxLineWidth = 0;
			for ( let i = 0; i < obj._textLines.length; i++ ) {
				const measured = obj._measureLine( i );
				if ( measured.width > maxLineWidth ) {
					maxLineWidth = measured.width;
				}
			}

			// Start at ceil of measured width then nudge up 1px at a time until
			// Fabric's own wrapping logic agrees the text fits (line count stable).
			// This beats any fixed buffer because it uses the exact same code path.
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
				dispatch.markDirty();
				dispatch.pushHistory( {
					label: 'Fit text to content',
					undo: () => {
						obj.set( 'width', prevWidth );
						obj.initDimensions();
						canvas.renderAll();
					},
					redo: () => {
						obj.set( 'width', naturalWidth );
						obj.initDimensions();
						canvas.renderAll();
					},
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
		// Discard active object on mouse-down when space is held so Fabric
		// doesn't start an object drag instead of a pan.
		canvas.on( 'mouse:down:before', () => {
			if ( ! spaceRef.current ) {
				return;
			}
			canvas.discardActiveObject();
		} );

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
			const tag = document.activeElement?.tagName;
			if (
				tag === 'INPUT' ||
				tag === 'TEXTAREA' ||
				document.activeElement?.isContentEditable
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
		// Drawn directly onto the canvas context after each render so that
		// objects which overflow the artboard appear as visible but dimmed ghosts.
		const drawOverlay = () => {
			const ctx = canvas.contextContainer;
			const vt = canvas.viewportTransform;
			const zoom = vt[ 0 ];
			const panX = vt[ 4 ];
			const panY = vt[ 5 ];

			// Read from refs so the overlay updates when a template changes the
			// artboard dimensions.
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

			// Top strip (above artboard).
			if ( artT > 0 ) {
				ctx.fillRect( 0, 0, w, artT );
			}
			// Bottom strip (below artboard).
			if ( artB < h ) {
				ctx.fillRect( 0, artB, w, h - artB );
			}
			// Left and right strips (beside the artboard, clamped to its height).
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

	/** Serialize the canvas to JSON, including isArtboard marker on each object. */
	const getJSON = useCallback( () => {
		return fabricRef.current?.toJSON( [ 'id', 'isArtboard', 'sfShapeType' ] ) ?? null;
	}, [] );

	/**
	 * Export the artboard as a PNG data URL.
	 * Temporarily resets the canvas to artboard dimensions + identity viewport
	 * so the export is pixel-perfect regardless of current zoom/pan.
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

		// Temporarily disable artboard shadow for a clean export.
		const prevShadow = artboard?.shadow ?? null;
		if ( artboard ) {
			artboard.set( 'shadow', null );
		}

		// Deselect any active object so transform handles don't appear in the export.
		const prevActive = canvas.getActiveObject();
		canvas.discardActiveObject();

		canvas.setDimensions( { width: artW, height: artH } );
		canvas.setViewportTransform( [ 1, 0, 0, 1, 0, 0 ] );
		canvas.renderAll();

		// Read pixels directly from the lower canvas — Fabric v6's toDataURL() creates
		// an offscreen canvas internally whose context is null after setDimensions().
		const dataURL = canvas.lowerCanvasEl.toDataURL( 'image/png' );

		// Restore viewport, shadow, and selection.
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

	const loadFromJSON = useCallback( ( json ) => {
		const canvas = fabricRef.current;
		if ( ! canvas ) {
			return;
		}
		const artW = artboardWRef.current;
		const artH = artboardHRef.current;
		// Clear existing objects and background before loading the template so
		// old content doesn't bleed through (Fabric v6 does not auto-clear).
		canvas.clear();
		canvas.backgroundColor = null;
		canvas.loadFromJSON( json ).then( () => {
			// Fabric applies the JSON's "background" property to canvas.backgroundColor
			// during loadFromJSON. Clear it — the artboard rect owns the background.
			canvas.backgroundColor = null;

			// Re-detect and re-apply artboard setup so the artboardRectRef stays
			// accurate after a template is loaded onto an existing canvas.
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
				// If the template uses different dimensions, update the refs so
				// all subsequent operations (export, alignment, overlay) use the
				// correct artboard size.
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
	}, [ dispatch ] );

	/** Set the artboard background color. */
	const setBackground = useCallback(
		( color ) => {
			const canvas = fabricRef.current;
			const artboard = artboardRectRef.current;
			if ( ! canvas || ! artboard ) {
				return;
			}
			const prev = artboard.fill;
			artboard.set( 'fill', color );
			canvas.renderAll();
			dispatch.markDirty();
			dispatch.pushHistory( {
				label: 'Background color',
				undo: () => {
					artboard.set( 'fill', prev );
					artboard.dirty = true;
					canvas.renderAll();
				},
				redo: () => {
					artboard.set( 'fill', color );
					canvas.renderAll();
				},
			} );
		},
		[ dispatch ]
	);

	const addShape = useCallback(
		( type, overrides = {} ) => {
			const canvas = fabricRef.current;
			if ( ! canvas ) {
				return;
			}
			const shape = createShape( type, overrides );
			canvas.add( shape );
			canvas.setActiveObject( shape );
			canvas.renderAll();
			dispatch.pushHistory( {
				label: `Add ${ type }`,
				undo: () => {
					canvas.remove( shape );
					canvas.discardActiveObject();
					canvas.renderAll();
				},
				redo: () => {
					canvas.add( shape );
					canvas.setActiveObject( shape );
					canvas.renderAll();
				},
			} );
		},
		[ dispatch ]
	);

	const addText = useCallback(
		( role, overrides = {} ) => {
			const canvas = fabricRef.current;
			if ( ! canvas ) {
				return;
			}
			const text = createText( role, overrides );
			canvas.add( text );
			canvas.setActiveObject( text );
			canvas.renderAll();
			text.enterEditing();
			text.selectAll();
			canvas.renderAll();
			dispatch.pushHistory( {
				label: `Add ${ role } text`,
				undo: () => {
					canvas.remove( text );
					canvas.discardActiveObject();
					canvas.renderAll();
				},
				redo: () => {
					canvas.add( text );
					canvas.setActiveObject( text );
					canvas.renderAll();
				},
			} );
		},
		[ dispatch ]
	);

	const addImage = useCallback(
		( src, overrides = {} ) => {
			const canvas = fabricRef.current;
			if ( ! canvas ) {
				return;
			}
			const artW = artboardWRef.current;
			const artH = artboardHRef.current;

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
					dispatch.pushHistory( {
						label: 'Add image',
						undo: () => {
							canvas.remove( img );
							canvas.discardActiveObject();
							canvas.renderAll();
						},
						redo: () => {
							canvas.add( img );
							canvas.setActiveObject( img );
							canvas.renderAll();
						},
					} );
				}
			);
		},
		[ dispatch ]
	);

	const updateSelected = useCallback(
		( props, label = 'Update' ) => {
			const canvas = fabricRef.current;
			const obj = canvas?.getActiveObject();
			if ( ! obj ) {
				return;
			}

			const prevProps = {};
			Object.keys( props ).forEach( ( k ) => {
				prevProps[ k ] = obj.get( k );
			} );

			obj.set( props );
			if ( obj.type === 'i-text' || obj.type === 'textbox' ) {
				obj.initDimensions();
			}
			canvas.requestRenderAll();

			dispatch.updateSelectionProperties( props );
			dispatch.markDirty();

			dispatch.pushHistory( {
				label,
				undo: () => {
					obj.set( prevProps );
					if ( obj.type === 'i-text' || obj.type === 'textbox' ) {
						obj.initDimensions();
					}
					canvas.requestRenderAll();
					dispatch.updateSelectionProperties( prevProps );
				},
				redo: () => {
					obj.set( props );
					if ( obj.type === 'i-text' || obj.type === 'textbox' ) {
						obj.initDimensions();
					}
					canvas.requestRenderAll();
					dispatch.updateSelectionProperties( props );
				},
			} );
		},
		[ dispatch ]
	);

	const deleteSelected = useCallback( () => {
		const canvas = fabricRef.current;
		const obj = canvas?.getActiveObject();
		if ( ! obj ) {
			return;
		}

		canvas.remove( obj );
		canvas.discardActiveObject();
		canvas.renderAll();
		dispatch.clearSelection();

		dispatch.pushHistory( {
			label: 'Delete object',
			undo: () => {
				canvas.add( obj );
				canvas.setActiveObject( obj );
				canvas.renderAll();
			},
			redo: () => {
				canvas.remove( obj );
				canvas.discardActiveObject();
				canvas.renderAll();
			},
		} );
	}, [ dispatch ] );

	// ── Shape fill with image ─────────────────────────────────────────────────

	const fillShapeWithImage = useCallback(
		async ( src, fitMode = 'cover' ) => {
			const canvas = fabricRef.current;
			const shape = canvas?.getActiveObject();
			if ( ! canvas || ! shape ) {
				return;
			}

			const img = await fabric.Image.fromURL( src, {
				crossOrigin: 'anonymous',
			} );
			const imgW = img.width;
			const imgH = img.height;

			const patternTransform = shapeFitTransform(
				imgW,
				imgH,
				shape.width,
				shape.height,
				fitMode
			);

			const pattern = new fabric.Pattern( {
				source: img.getElement(),
				repeat: 'no-repeat',
				patternTransform,
			} );

			const prevFill = shape.fill;
			shape.set( 'fill', pattern );
			canvas.renderAll();
			dispatch.markDirty();

			dispatch.pushHistory( {
				label: 'Fill shape with image',
				undo: () => {
					shape.set( 'fill', prevFill );
					shape.dirty = true;
					canvas.renderAll();
					dispatch.markDirty();
				},
				redo: () => {
					shape.set( 'fill', pattern );
					shape.dirty = true;
					canvas.renderAll();
					dispatch.markDirty();
				},
			} );
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

			const newPattern = new fabric.Pattern( {
				source: imgEl,
				repeat: 'no-repeat',
				patternTransform: shapeFitTransform(
					imgW,
					imgH,
					shape.width,
					shape.height,
					fitMode
				),
			} );

			shape.set( 'fill', newPattern );
			shape.dirty = true;
			canvas.renderAll();
			dispatch.markDirty();
		},
		[ dispatch ]
	);

	// ── Artboard background image (stored as Pattern fill on the artboard) ────

	const setBackgroundImage = useCallback(
		async ( src, fitMode = 'cover' ) => {
			const canvas = fabricRef.current;
			const artboard = artboardRectRef.current;
			if ( ! canvas || ! artboard ) {
				return;
			}

			const artW = artboardWRef.current;
			const artH = artboardHRef.current;
			const prev = artboard.fill;
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
			dispatch.markDirty();

			dispatch.pushHistory( {
				label: 'Set background image',
				undo: () => {
					artboard.set( 'fill', prev );
					artboard.dirty = true;
					canvas.renderAll();
					dispatch.markDirty();
				},
				redo: () => {
					artboard.set( 'fill', pattern );
					artboard.dirty = true;
					canvas.renderAll();
					dispatch.markDirty();
				},
			} );
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

			const newPattern = new fabric.Pattern( {
				source: imgEl,
				repeat: 'no-repeat',
				patternTransform: shapeFitTransform(
					imgW,
					imgH,
					artW,
					artH,
					fitMode
				),
			} );

			artboard.set( 'fill', newPattern );
			artboard.dirty = true;
			canvas.renderAll();
			dispatch.markDirty();
		},
		[ dispatch ]
	);

	const clearBackgroundImage = useCallback( () => {
		const canvas = fabricRef.current;
		const artboard = artboardRectRef.current;
		if ( ! canvas || ! artboard ) {
			return;
		}

		const prev = artboard.fill;
		artboard.set( 'fill', '#ffffff' );
		canvas.renderAll();
		dispatch.markDirty();

		dispatch.pushHistory( {
			label: 'Remove background image',
			undo: () => {
				artboard.set( 'fill', prev );
				artboard.dirty = true;
				canvas.renderAll();
				dispatch.markDirty();
			},
			redo: () => {
				artboard.set( 'fill', '#ffffff' );
				canvas.renderAll();
				dispatch.markDirty();
			},
		} );
	}, [ dispatch ] );

	/**
	 * Returns the src URL of the artboard background image, or null if the
	 * artboard fill is a solid color.
	 */
	const getBackgroundImageSrc = useCallback( () => {
		const artboard = artboardRectRef.current;
		if ( ! artboard?.fill?.source ) {
			return null;
		}
		return artboard.fill.source.src ?? null;
	}, [] );

	// ── Zoom / pan controls ───────────────────────────────────────────────────

	/** Re-fit the artboard to fill ~90% of the viewport. */
	const fitView = useCallback( () => {
		fitToScreenRef.current?.();
	}, [] );

	/** Zoom in 25% toward the viewport center. */
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

	/** Zoom out 25% from the viewport center. */
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

	/** Align the selected object relative to the artboard boundaries. */
	const alignObject = useCallback(
		( direction ) => {
			const canvas = fabricRef.current;
			const obj = canvas?.getActiveObject();
			if ( ! canvas || ! obj ) {
				return;
			}

			const bbox = obj.getBoundingRect();
			const offsetL = obj.left - bbox.left;
			const offsetT = obj.top - bbox.top;
			const artW = artboardWRef.current;
			const artH = artboardHRef.current;
			const prevLeft = obj.left;
			const prevTop = obj.top;

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
			canvas.renderAll();
			syncSelection( obj, dispatch );
			dispatch.markDirty();
			dispatch.pushHistory( {
				label: `Align ${ direction }`,
				undo: () => {
					obj.set( { left: prevLeft, top: prevTop } );
					obj.setCoords();
					canvas.renderAll();
				},
				redo: () => {
					obj.set( { left: newLeft, top: newTop } );
					obj.setCoords();
					canvas.renderAll();
				},
			} );
		},
		[ dispatch ]
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
			const canvas = fabricRef.current;
			const obj = canvas?.getObjects().find( ( o ) => o.id === id );
			if ( ! canvas || ! obj ) {
				return;
			}
			canvas.bringObjectForward( obj );
			canvas.renderAll();
			syncLayersToStore( canvas, dispatch );
			dispatch.markDirty();
			dispatch.pushHistory( {
				label: 'Move layer up',
				undo: () => {
					canvas.sendObjectBackwards( obj );
					canvas.renderAll();
					syncLayersToStore( canvas, dispatch );
					dispatch.markDirty();
				},
				redo: () => {
					canvas.bringObjectForward( obj );
					canvas.renderAll();
					syncLayersToStore( canvas, dispatch );
					dispatch.markDirty();
				},
			} );
		},
		[ dispatch ]
	);

	const moveLayerDown = useCallback(
		( id ) => {
			const canvas = fabricRef.current;
			const obj = canvas?.getObjects().find( ( o ) => o.id === id );
			if ( ! canvas || ! obj ) {
				return;
			}

			// Prevent sending below the artboard (always at the bottom of the stack).
			const objects = canvas.getObjects();
			const minIdx = objects.findIndex(
				( o ) => ! isArtboardObject( o )
			);
			if ( objects.indexOf( obj ) <= minIdx ) {
				return;
			}

			canvas.sendObjectBackwards( obj );
			canvas.renderAll();
			syncLayersToStore( canvas, dispatch );
			dispatch.markDirty();
			dispatch.pushHistory( {
				label: 'Move layer down',
				undo: () => {
					canvas.bringObjectForward( obj );
					canvas.renderAll();
					syncLayersToStore( canvas, dispatch );
					dispatch.markDirty();
				},
				redo: () => {
					canvas.sendObjectBackwards( obj );
					canvas.renderAll();
					syncLayersToStore( canvas, dispatch );
					dispatch.markDirty();
				},
			} );
		},
		[ dispatch ]
	);

	const duplicateById = useCallback(
		async ( id ) => {
			const canvas = fabricRef.current;
			const obj = canvas?.getObjects().find( ( o ) => o.id === id );
			if ( ! canvas || ! obj ) {
				return;
			}
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
			dispatch.markDirty();
			dispatch.pushHistory( {
				label: 'Duplicate layer',
				undo: () => {
					canvas.remove( clone );
					canvas.renderAll();
					syncLayersToStore( canvas, dispatch );
					dispatch.markDirty();
				},
				redo: () => {
					canvas.add( clone );
					canvas.setActiveObject( clone );
					canvas.renderAll();
					syncLayersToStore( canvas, dispatch );
					dispatch.markDirty();
				},
			} );
		},
		[ dispatch ]
	);

	const deleteById = useCallback(
		( id ) => {
			const canvas = fabricRef.current;
			const obj = canvas?.getObjects().find( ( o ) => o.id === id );
			if ( ! canvas || ! obj ) {
				return;
			}
			canvas.remove( obj );
			canvas.discardActiveObject();
			canvas.renderAll();
			dispatch.clearSelection();
			syncLayersToStore( canvas, dispatch );
			dispatch.markDirty();
			dispatch.pushHistory( {
				label: 'Delete layer',
				undo: () => {
					canvas.add( obj );
					canvas.renderAll();
					syncLayersToStore( canvas, dispatch );
					dispatch.markDirty();
				},
				redo: () => {
					canvas.remove( obj );
					canvas.discardActiveObject();
					canvas.renderAll();
					syncLayersToStore( canvas, dispatch );
					dispatch.markDirty();
				},
			} );
		},
		[ dispatch ]
	);

	const renameById = useCallback(
		( id, name ) => {
			const canvas = fabricRef.current;
			const obj = canvas?.getObjects().find( ( o ) => o.id === id );
			if ( ! canvas || ! obj ) {
				return;
			}
			const prev = obj.name;
			obj.name = name;
			syncLayersToStore( canvas, dispatch );
			dispatch.markDirty();
			dispatch.pushHistory( {
				label: 'Rename layer',
				undo: () => {
					obj.name = prev;
					syncLayersToStore( canvas, dispatch );
					dispatch.markDirty();
				},
				redo: () => {
					obj.name = name;
					syncLayersToStore( canvas, dispatch );
					dispatch.markDirty();
				},
			} );
		},
		[ dispatch ]
	);

	/** Duplicate the currently active object, offset by 20px. */
	const duplicateSelected = useCallback( async () => {
		const canvas = fabricRef.current;
		const obj = canvas?.getActiveObject();
		if ( ! canvas || ! obj ) {
			return;
		}
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
		dispatch.markDirty();
		dispatch.pushHistory( {
			label: 'Duplicate',
			undo: () => {
				canvas.remove( clone );
				canvas.renderAll();
				syncLayersToStore( canvas, dispatch );
				dispatch.markDirty();
			},
			redo: () => {
				canvas.add( clone );
				canvas.setActiveObject( clone );
				canvas.renderAll();
				syncLayersToStore( canvas, dispatch );
				dispatch.markDirty();
			},
		} );
	}, [ dispatch ] );

	const setLayerLocked = useCallback(
		( id, locked ) => {
			const canvas = fabricRef.current;
			const obj = canvas?.getObjects().find( ( o ) => o.id === id );
			if ( ! canvas || ! obj ) {
				return;
			}
			const prevLocked = ! obj.selectable;
			obj.set( { selectable: ! locked, evented: ! locked } );
			if ( locked ) {
				canvas.discardActiveObject();
			}
			canvas.renderAll();
			syncLayersToStore( canvas, dispatch );
			dispatch.markDirty();
			dispatch.pushHistory( {
				label: locked ? 'Lock layer' : 'Unlock layer',
				undo: () => {
					obj.set( {
						selectable: ! prevLocked,
						evented: ! prevLocked,
					} );
					syncLayersToStore( canvas, dispatch );
					canvas.renderAll();
				},
				redo: () => {
					obj.set( {
						selectable: ! locked,
						evented: ! locked,
					} );
					if ( locked ) {
						canvas.discardActiveObject();
					}
					syncLayersToStore( canvas, dispatch );
					canvas.renderAll();
				},
			} );
		},
		[ dispatch ]
	);

	const setLayerVisible = useCallback(
		( id, visible ) => {
			const canvas = fabricRef.current;
			const obj = canvas?.getObjects().find( ( o ) => o.id === id );
			if ( ! canvas || ! obj ) {
				return;
			}
			const prevVisible = obj.visible ?? true;
			obj.set( 'visible', visible );
			canvas.renderAll();
			syncLayersToStore( canvas, dispatch );
			dispatch.markDirty();
			dispatch.pushHistory( {
				label: visible ? 'Show layer' : 'Hide layer',
				undo: () => {
					obj.set( 'visible', prevVisible );
					syncLayersToStore( canvas, dispatch );
					canvas.renderAll();
				},
				redo: () => {
					obj.set( 'visible', visible );
					syncLayersToStore( canvas, dispatch );
					canvas.renderAll();
				},
			} );
		},
		[ dispatch ]
	);

	const replaceImage = useCallback( async ( url ) => {
		const canvas = fabricRef.current;
		const obj = canvas?.getActiveObject();
		if ( ! canvas || ! obj || obj.type !== 'image' ) {
			return;
		}
		const prevElement = obj.getElement();
		const newImg = await fabric.Image.fromURL( url, {
			crossOrigin: 'anonymous',
		} );
		const newElement = newImg.getElement();
		obj.setElement( newElement );
		canvas.renderAll();
		dispatch.markDirty();
		dispatch.pushHistory( {
			label: 'Replace image',
			undo: () => {
				obj.setElement( prevElement );
				canvas.renderAll();
				dispatch.markDirty();
			},
			redo: () => {
				obj.setElement( newElement );
				canvas.renderAll();
				dispatch.markDirty();
			},
		} );
	}, [ dispatch ] );

	return {
		getFabric,
		getJSON,
		toDataURL,
		loadFromJSON,
		setBackground,
		addShape,
		addText,
		addImage,
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
 * @return {fabric.Rect}
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
 * Map a Fabric object type to a selection type string.
 *
 * @param {fabric.Object} obj
 * @param                 dispatch
 * @return {'text'|'image'|'shape'|'none'}
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
 * Rebuild the layers list in the store from the current canvas objects.
 * The artboard sentinel is excluded.  Layers are ordered front-to-back.
 *
 * @param {fabric.Canvas} canvas
 * @param {Object}        dispatch
 * @param                 o
 */
function isArtboardObject( o ) {
	return o.isArtboard || o.id === 'artboard';
}

function syncLayersToStore( canvas, dispatch ) {
	const objects = canvas
		.getObjects()
		.filter( ( o ) => ! isArtboardObject( o ) );
	// Ensure every object has a stable ID before syncing to the store.
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
