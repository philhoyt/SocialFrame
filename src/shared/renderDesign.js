/**
 * Render a saved design to a PNG data URL without the SocialFrame editor.
 *
 * Fabric is imported on first use, so screens that load this module only pay
 * for it when they actually render.
 */

import { configureFabric } from './configureFabric';
import { applyFrameLayout } from './frameLayout';

const TEXT_TYPES = [ 'text', 'i-text', 'itext', 'textbox' ];
const LOAD_TIMEOUT_MS = 30000;

/**
 * Whether a serialized object is the artboard rect.
 *
 * Mirrors the editor's detection, including the geometry fallback for
 * designs saved before the isArtboard marker existed.
 *
 * @param {Object} obj Serialized Fabric object.
 * @return {boolean} True for the artboard.
 */
function isArtboard( obj ) {
	if ( obj?.isArtboard || obj?.id === 'artboard' ) {
		return true;
	}
	return (
		String( obj?.type ?? '' ).toLowerCase() === 'rect' &&
		Math.abs( obj.left ?? 0 ) < 1 &&
		Math.abs( obj.top ?? 0 ) < 1 &&
		( obj.width ?? 0 ) >= 100 &&
		( obj.height ?? 0 ) >= 100
	);
}

/**
 * Every distinct font a canvas uses, as CSS font shorthand for
 * document.fonts.load(), including text inside groups.
 *
 * @param {Object} json Serialized canvas.
 * @return {string[]} Font shorthands, e.g. `italic 700 16px Inter`.
 */
export function collectFontDescriptors( json ) {
	const fonts = new Set();
	const queue = [ ...( json?.objects ?? [] ) ];

	while ( queue.length ) {
		const obj = queue.shift();
		if (
			TEXT_TYPES.includes( String( obj?.type ?? '' ).toLowerCase() ) &&
			obj.fontFamily
		) {
			const style = obj.fontStyle || 'normal';
			const weight = obj.fontWeight || 'normal';
			fonts.add( `${ style } ${ weight } 16px ${ obj.fontFamily }` );
		}
		queue.push( ...( obj?.objects ?? [] ) );
	}

	return [ ...fonts ];
}

/**
 * Prepare a serialized canvas for a clean export.
 *
 * Drops the artboard's editor shadow and the canvas background (the
 * artboard owns the background), and reads the artboard size, as the
 * editor's own export does.
 *
 * @param {Object} json     Serialized canvas.
 * @param {Object} fallback Size to use when there is no artboard.
 * @return {{ json: Object, width: number, height: number }} Prepared canvas and size.
 */
export function prepareCanvas( json, fallback = {} ) {
	let width = fallback.width ?? 0;
	let height = fallback.height ?? 0;
	let found = false;

	const objects = ( json?.objects ?? [] ).map( ( obj ) => {
		if ( found || ! isArtboard( obj ) ) {
			return obj;
		}
		found = true;
		width = Math.round( ( obj.width ?? 0 ) * ( obj.scaleX ?? 1 ) );
		height = Math.round( ( obj.height ?? 0 ) * ( obj.scaleY ?? 1 ) );
		return { ...obj, shadow: null };
	} );

	const { background, ...rest } = json ?? {};

	return { json: { ...rest, objects }, width, height };
}

/**
 * Reject when a promise takes too long.
 *
 * @param {Promise} promise Work to wait for.
 * @param {number}  ms      Time limit.
 * @return {Promise} The work's result.
 */
function withTimeout( promise, ms ) {
	let timer;
	return Promise.race( [
		promise,
		new Promise( ( _, reject ) => {
			timer = setTimeout(
				() => reject( new Error( 'Rendering timed out.' ) ),
				ms
			);
		} ),
	] ).finally( () => clearTimeout( timer ) );
}

/**
 * Render a design to a PNG data URL at exactly its artboard size.
 *
 * @param {string|Object} fabricJson Saved canvas JSON.
 * @param {Object}        size       Fallback width and height.
 * @return {Promise<string>} PNG data URL.
 */
export async function renderDesign( fabricJson, size = {} ) {
	const parsed =
		typeof fabricJson === 'string' ? JSON.parse( fabricJson ) : fabricJson;
	const { json, width, height } = prepareCanvas( parsed, size );

	if ( ! width || ! height ) {
		throw new Error( 'The design has no size.' );
	}

	// Load fonts before Fabric measures any text, so wrapping matches the
	// editor. A font that fails to load falls back like it does there.
	await withTimeout(
		Promise.allSettled(
			// Deferred so an unparsable family is a rejection, not a throw.
			collectFontDescriptors( json ).map( ( font ) =>
				Promise.resolve().then( () => document.fonts.load( font ) )
			)
		),
		LOAD_TIMEOUT_MS
	);

	const fabric = await import( /* webpackChunkName: "fabric" */ 'fabric' );
	configureFabric( fabric );

	const canvas = new fabric.StaticCanvas(
		document.createElement( 'canvas' ),
		{
			width,
			height,
			enableRetinaScaling: false,
			renderOnAddRemove: false,
		}
	);

	try {
		await withTimeout( canvas.loadFromJSON( json ), LOAD_TIMEOUT_MS );
		canvas.backgroundColor = null;

		// Measurements cached before the fonts arrived would keep fallback
		// metrics; drop them and re-measure.
		fabric.cache.clearFontCache();
		canvas.getObjects().forEach( ( obj ) => obj.initDimensions?.() );

		// Lay frames out around the filled content; overflowing flexible
		// text is shortened, since this render is the output.
		applyFrameLayout( canvas, { truncate: true } );

		canvas.renderAll();
		return canvas.lowerCanvasEl.toDataURL( 'image/png' );
	} finally {
		canvas.dispose();
	}
}
