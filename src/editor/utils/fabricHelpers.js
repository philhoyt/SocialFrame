import * as fabric from 'fabric';

const { themeColors, themeFonts } = window.socialFrameConfig ?? {};

let _idCounter = 0;
const genId = () => `sf-${ ++_idCounter }-${ Date.now() }`;

function defaultFill() {
	return themeColors?.[ 0 ]?.color ?? '#3b5998';
}

function defaultFont() {
	return themeFonts?.[ 0 ]?.fontFamily ?? 'sans-serif';
}

export const TEXT_ROLE_DEFAULTS = {
	heading:    { fontSize: 72, fontWeight: 'bold' },
	subheading: { fontSize: 48, fontWeight: 'normal' },
	body:       { fontSize: 28, fontWeight: 'normal' },
	caption:    { fontSize: 18, fontWeight: 'normal' },
};

/**
 * Create a Fabric shape object with theme-color defaults.
 *
 * @param {'rect'|'rounded-rect'|'circle'|'triangle'|'line'} type Shape type.
 * @param {Object} overrides Additional Fabric options.
 * @returns {fabric.Object}
 */
export function createShape( type, overrides = {} ) {
	const base = {
		id: genId(),
		fill: defaultFill(),
		opacity: 1,
		left: 100,
		top: 100,
		...overrides,
	};

	switch ( type ) {
		case 'rect':
			return new fabric.Rect( { width: 200, height: 200, ...base } );
		case 'rounded-rect':
			return new fabric.Rect( { width: 200, height: 200, rx: 20, ry: 20, ...base } );
		case 'circle':
			return new fabric.Circle( { radius: 100, ...base } );
		case 'triangle':
			return new fabric.Triangle( { width: 200, height: 200, ...base } );
		case 'line':
			return new fabric.Line( [ 0, 0, 200, 0 ], {
				stroke: defaultFill(),
				strokeWidth: 4,
				fill: null,
				id: genId(),
				left: 100,
				top: 100,
				...overrides,
			} );
		default:
			return new fabric.Rect( { width: 200, height: 200, ...base } );
	}
}

/**
 * Create a Fabric IText object for a given text role.
 *
 * @param {'heading'|'subheading'|'body'|'caption'} role Text role.
 * @param {Object} overrides Additional Fabric options.
 * @returns {fabric.IText}
 */
export function createText( role, overrides = {} ) {
	const defaults = TEXT_ROLE_DEFAULTS[ role ] ?? TEXT_ROLE_DEFAULTS.body;
	const label    = role.charAt( 0 ).toUpperCase() + role.slice( 1 );

	return new fabric.IText( label, {
		id: genId(),
		fontFamily: defaultFont(),
		fill: themeColors?.[ 0 ]?.color ?? '#000000',
		left: 100,
		top: 100,
		...defaults,
		...overrides,
	} );
}

/**
 * Determine the selection type from a Fabric object.
 *
 * @param {fabric.Object} obj Fabric object.
 * @returns {'text'|'image'|'shape'}
 */
export function getObjectType( obj ) {
	if ( ! obj ) return 'none';
	if ( obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox' ) return 'text';
	if ( obj.type === 'image' ) return 'image';
	return 'shape';
}

/**
 * Extract display properties from a Fabric object for the properties panel.
 *
 * @param {fabric.Object} obj Fabric object.
 * @param {'text'|'image'|'shape'} type Determined object type.
 * @returns {Object}
 */
export function extractProperties( obj, type ) {
	const base = {
		left:    obj.left ?? 0,
		top:     obj.top ?? 0,
		width:   obj.getScaledWidth ? Math.round( obj.getScaledWidth() ) : ( obj.width ?? 0 ),
		height:  obj.getScaledHeight ? Math.round( obj.getScaledHeight() ) : ( obj.height ?? 0 ),
		opacity: obj.opacity ?? 1,
		angle:   obj.angle ?? 0,
	};

	if ( type === 'text' ) {
		return {
			...base,
			fontFamily:       obj.fontFamily ?? '',
			fontSize:         obj.fontSize ?? 16,
			fontWeight:       obj.fontWeight ?? 'normal',
			fontStyle:        obj.fontStyle ?? 'normal',
			underline:        obj.underline ?? false,
			textAlign:        obj.textAlign ?? 'left',
			fill:             obj.fill ?? '#000000',
			backgroundColor:  obj.backgroundColor ?? '',
			charSpacing:      obj.charSpacing ?? 0,
			lineHeight:       obj.lineHeight ?? 1.16,
		};
	}

	if ( type === 'image' ) {
		return { ...base };
	}

	// Shape.
	return {
		...base,
		// Patterns (image fills) are not a string — return null so the color
		// swatches don't incorrectly show a selected state.
		fill:        typeof obj.fill === 'string' ? obj.fill : null,
		stroke:      obj.stroke ?? '',
		strokeWidth: obj.strokeWidth ?? 0,
		rx:          obj.rx ?? 0,
	};
}
