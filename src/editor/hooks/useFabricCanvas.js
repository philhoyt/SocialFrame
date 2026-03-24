import { useRef, useEffect, useCallback } from '@wordpress/element';
import { useDispatch } from '@wordpress/data';
import * as fabric from 'fabric';

import { STORE_KEY } from '../store';
import { FORMATS } from '../utils/formats';
import { createShape, createText, getObjectType, extractProperties } from '../utils/fabricHelpers';

/**
 * Initializes and manages the Fabric.js canvas instance.
 *
 * ARCHITECTURE RULE:
 *   Fabric owns canvas state. React (via the @wordpress/data store) owns UI state.
 *   Never put Fabric objects into React state. Never call setState from Fabric event handlers.
 *   The only data crossing Fabric → React: selection type, selected object properties, dirty flag.
 *   The only data crossing React → Fabric: object mutations, insertions, deletions, JSON load.
 *
 * @param {React.RefObject} canvasRef Ref attached to the <canvas> element.
 * @param {Object} options
 * @param {string} options.format  Format key, e.g. 'instagram-post'.
 * @param {string} options.fabricJson Initial Fabric JSON to load (may be empty).
 * @returns {Object} Stable imperative API consumed via FabricContext.
 */
export function useFabricCanvas( canvasRef, { format, fabricJson } ) {
	const fabricRef = useRef( null );
	const dispatch  = useDispatch( STORE_KEY );

	// Initialize Fabric once on mount.
	useEffect( () => {
		if ( ! canvasRef.current ) return;

		const { width, height } = FORMATS[ format ] ?? { width: 1080, height: 1080 };

		const canvas = new fabric.Canvas( canvasRef.current, {
			width,
			height,
			preserveObjectStacking: true,
			selection: true,
			backgroundColor: '#ffffff',
		} );

		fabricRef.current = canvas;

		// Load existing JSON if present.
		if ( fabricJson ) {
			try {
				canvas.loadFromJSON( fabricJson ).then( () => canvas.renderAll() );
			} catch ( e ) {
				// eslint-disable-next-line no-console
				console.warn( 'SocialFrame: could not load fabricJson, starting with blank canvas.', e );
			}
		}

		// Bridge Fabric selection events → store.
		canvas.on( 'selection:created', ( e ) => syncSelection( e.selected?.[ 0 ], dispatch ) );
		canvas.on( 'selection:updated', ( e ) => syncSelection( e.selected?.[ 0 ], dispatch ) );
		canvas.on( 'selection:cleared', ()   => dispatch.clearSelection() );

		// Mark dirty on any canvas mutation.
		canvas.on( 'object:modified', () => dispatch.markDirty() );
		canvas.on( 'object:added',    () => dispatch.markDirty() );
		canvas.on( 'object:removed',  () => dispatch.markDirty() );

		return () => {
			canvas.dispose();
			fabricRef.current = null;
		};
		// Run once — fabricJson is loaded via the loadFromJSON call below when it changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [] );

	// ── Imperative API ────────────────────────────────────────────────────────

	const getFabric = useCallback( () => fabricRef.current, [] );

	const getJSON = useCallback( () => {
		return fabricRef.current?.toJSON( [ 'id' ] ) ?? null;
	}, [] );

	const toDataURL = useCallback( () => {
		return fabricRef.current?.toDataURL( { format: 'png', multiplier: 1 } ) ?? null;
	}, [] );

	const loadFromJSON = useCallback( ( json ) => {
		const canvas = fabricRef.current;
		if ( ! canvas ) return;
		canvas.loadFromJSON( json ).then( () => canvas.renderAll() );
	}, [] );

	const setBackground = useCallback( ( color ) => {
		const canvas = fabricRef.current;
		if ( ! canvas ) return;
		const prev = canvas.backgroundColor;
		canvas.set( 'backgroundColor', color );
		canvas.renderAll();
		dispatch.markDirty();
		dispatch.pushHistory( {
			label: 'Background color',
			undo: () => { canvas.set( 'backgroundColor', prev ); canvas.renderAll(); },
			redo: () => { canvas.set( 'backgroundColor', color ); canvas.renderAll(); },
		} );
	}, [ dispatch ] );

	const addShape = useCallback( ( type, overrides = {} ) => {
		const canvas = fabricRef.current;
		if ( ! canvas ) return;
		const shape = createShape( type, overrides );
		canvas.add( shape );
		canvas.setActiveObject( shape );
		canvas.renderAll();
		dispatch.pushHistory( {
			label: `Add ${ type }`,
			undo: () => { canvas.remove( shape ); canvas.discardActiveObject(); canvas.renderAll(); },
			redo: () => { canvas.add( shape ); canvas.setActiveObject( shape ); canvas.renderAll(); },
		} );
	}, [ dispatch ] );

	const addText = useCallback( ( role, overrides = {} ) => {
		const canvas = fabricRef.current;
		if ( ! canvas ) return;
		const text = createText( role, overrides );
		canvas.add( text );
		canvas.setActiveObject( text );
		canvas.renderAll();
		dispatch.pushHistory( {
			label: `Add ${ role } text`,
			undo: () => { canvas.remove( text ); canvas.discardActiveObject(); canvas.renderAll(); },
			redo: () => { canvas.add( text ); canvas.setActiveObject( text ); canvas.renderAll(); },
		} );
	}, [ dispatch ] );

	const addImage = useCallback( ( src, overrides = {} ) => {
		const canvas = fabricRef.current;
		if ( ! canvas ) return;

		fabric.Image.fromURL( src, { crossOrigin: 'anonymous' } ).then( ( img ) => {
			// Scale down to fit the canvas while preserving aspect ratio.
			const maxSize = Math.min( canvas.width, canvas.height ) * 0.6;
			if ( img.width > maxSize || img.height > maxSize ) {
				const scale = maxSize / Math.max( img.width, img.height );
				img.scale( scale );
			}
			img.set( {
				left: canvas.width  / 2 - ( img.getScaledWidth()  / 2 ),
				top:  canvas.height / 2 - ( img.getScaledHeight() / 2 ),
				...overrides,
			} );
			canvas.add( img );
			canvas.setActiveObject( img );
			canvas.renderAll();
			dispatch.pushHistory( {
				label: 'Add image',
				undo: () => { canvas.remove( img ); canvas.discardActiveObject(); canvas.renderAll(); },
				redo: () => { canvas.add( img ); canvas.setActiveObject( img ); canvas.renderAll(); },
			} );
		} );
	}, [ dispatch ] );

	const updateSelected = useCallback( ( props, label = 'Update' ) => {
		const canvas = fabricRef.current;
		const obj    = canvas?.getActiveObject();
		if ( ! obj ) return;

		// Capture previous values for undo.
		const prevProps = {};
		Object.keys( props ).forEach( ( k ) => { prevProps[ k ] = obj.get( k ); } );

		// Apply new values.
		obj.set( props );
		if ( obj.type === 'i-text' ) obj.initDimensions();
		canvas.requestRenderAll();

		// Sync properties mirror in store.
		dispatch.updateSelectionProperties( props );
		dispatch.markDirty();

		dispatch.pushHistory( {
			label,
			undo: () => {
				obj.set( prevProps );
				if ( obj.type === 'i-text' ) obj.initDimensions();
				canvas.requestRenderAll();
				dispatch.updateSelectionProperties( prevProps );
			},
			redo: () => {
				obj.set( props );
				if ( obj.type === 'i-text' ) obj.initDimensions();
				canvas.requestRenderAll();
				dispatch.updateSelectionProperties( props );
			},
		} );
	}, [ dispatch ] );

	const deleteSelected = useCallback( () => {
		const canvas = fabricRef.current;
		const obj    = canvas?.getActiveObject();
		if ( ! obj ) return;

		canvas.remove( obj );
		canvas.discardActiveObject();
		canvas.renderAll();
		dispatch.clearSelection();

		dispatch.pushHistory( {
			label: 'Delete object',
			undo: () => { canvas.add( obj ); canvas.setActiveObject( obj ); canvas.renderAll(); },
			redo: () => { canvas.remove( obj ); canvas.discardActiveObject(); canvas.renderAll(); },
		} );
	}, [ dispatch ] );

	// ── Shape fill with image ─────────────────────────────────────────────────

	const fillShapeWithImage = useCallback( async ( src, fitMode = 'cover' ) => {
		const canvas = fabricRef.current;
		const shape  = canvas?.getActiveObject();
		if ( ! canvas || ! shape ) return;

		const img = await fabric.Image.fromURL( src, { crossOrigin: 'anonymous' } );

		const shapeLeft = shape.left ?? 0;
		const shapeTop  = shape.top  ?? 0;
		const shapeW    = shape.getScaledWidth();
		const shapeH    = shape.getScaledHeight();

		const s = fitMode === 'contain'
			? Math.min( shapeW / img.width, shapeH / img.height )
			: fitMode === 'fill'
				? null // handled below
				: Math.max( shapeW / img.width, shapeH / img.height ); // cover / none

		// Clone shape as absolutePositioned clipPath so the image is masked to the shape bounds.
		const clipPath = await shape.clone();
		clipPath.absolutePositioned = true;

		let scaleX, scaleY, left, top;
		if ( fitMode === 'fill' ) {
			scaleX = shapeW / img.width;
			scaleY = shapeH / img.height;
			left   = shapeLeft;
			top    = shapeTop;
		} else {
			// cover, contain, none all use a uniform scale
			const uniformScale = fitMode === 'none' ? 1 : s;
			scaleX = uniformScale;
			scaleY = uniformScale;
			left   = shapeLeft + ( shapeW - img.width  * uniformScale ) / 2;
			top    = shapeTop  + ( shapeH - img.height * uniformScale ) / 2;
		}

		img.set( { left, top, scaleX, scaleY, clipPath } );

		canvas.remove( shape );
		canvas.add( img );
		canvas.setActiveObject( img );
		canvas.renderAll();
		dispatch.markDirty();

		dispatch.pushHistory( {
			label: 'Fill shape with image',
			undo: () => { canvas.remove( img ); canvas.add( shape ); canvas.setActiveObject( shape ); canvas.renderAll(); dispatch.markDirty(); },
			redo: () => { canvas.remove( shape ); canvas.add( img ); canvas.setActiveObject( img ); canvas.renderAll(); dispatch.markDirty(); },
		} );
	}, [ dispatch ] );

	// ── Canvas background image ────────────────────────────────────────────────

	const setBackgroundImage = useCallback( async ( src, fitMode = 'cover' ) => {
		const canvas = fabricRef.current;
		if ( ! canvas ) return;

		const prev = canvas.backgroundImage ?? null;
		const img  = await fabric.Image.fromURL( src, { crossOrigin: 'anonymous' } );

		applyBgFit( img, canvas.width, canvas.height, fitMode );
		canvas.backgroundImage = img;
		canvas.renderAll();
		dispatch.markDirty();

		dispatch.pushHistory( {
			label: 'Set background image',
			undo: () => { canvas.backgroundImage = prev; canvas.renderAll(); dispatch.markDirty(); },
			redo: () => { canvas.backgroundImage = img;  canvas.renderAll(); dispatch.markDirty(); },
		} );
	}, [ dispatch ] );

	const updateBackgroundImageFit = useCallback( ( fitMode ) => {
		const canvas = fabricRef.current;
		const img    = canvas?.backgroundImage;
		if ( ! canvas || ! img ) return;
		applyBgFit( img, canvas.width, canvas.height, fitMode );
		canvas.renderAll();
		dispatch.markDirty();
	}, [ dispatch ] );

	const clearBackgroundImage = useCallback( () => {
		const canvas = fabricRef.current;
		if ( ! canvas ) return;

		const prev = canvas.backgroundImage;
		canvas.backgroundImage = null;
		canvas.renderAll();
		dispatch.markDirty();

		dispatch.pushHistory( {
			label: 'Remove background image',
			undo: () => { canvas.backgroundImage = prev;  canvas.renderAll(); dispatch.markDirty(); },
			redo: () => { canvas.backgroundImage = null; canvas.renderAll(); dispatch.markDirty(); },
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
		fillShapeWithImage,
		setBackgroundImage,
		updateBackgroundImageFit,
		clearBackgroundImage,
	};
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Apply a CSS-style fit mode to a Fabric.Image for use as a canvas background.
 *
 * @param {fabric.Image} img      The image to position/scale.
 * @param {number}       canvasW  Canvas native width.
 * @param {number}       canvasH  Canvas native height.
 * @param {string}       fitMode  'cover'|'contain'|'fill'|'none'
 */
function applyBgFit( img, canvasW, canvasH, fitMode ) {
	switch ( fitMode ) {
		case 'cover': {
			const s = Math.max( canvasW / img.width, canvasH / img.height );
			img.set( { scaleX: s, scaleY: s, left: ( canvasW - img.width * s ) / 2, top: ( canvasH - img.height * s ) / 2 } );
			break;
		}
		case 'contain': {
			const s = Math.min( canvasW / img.width, canvasH / img.height );
			img.set( { scaleX: s, scaleY: s, left: ( canvasW - img.width * s ) / 2, top: ( canvasH - img.height * s ) / 2 } );
			break;
		}
		case 'fill':
			img.set( { scaleX: canvasW / img.width, scaleY: canvasH / img.height, left: 0, top: 0 } );
			break;
		default: // 'none' — natural size, top-left
			img.set( { scaleX: 1, scaleY: 1, left: 0, top: 0 } );
	}
}

function syncSelection( obj, dispatch ) {
	if ( ! obj ) return;
	const type       = getObjectType( obj );
	const properties = extractProperties( obj, type );
	dispatch.setSelection( {
		type,
		objectId: obj.id ?? null,
		properties,
	} );
}
