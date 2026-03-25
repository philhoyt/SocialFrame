import * as fabric from 'fabric';

const { themeColors, themeFonts } = window.socialFrameConfig ?? {};

let _idCounter = 0;
export const genId = () => `sf-${ ++_idCounter }-${ Date.now() }`;

/**
 * Return a human-readable default name for a Fabric object based on its type.
 *
 * @param {fabric.Object} obj
 * @return {string}
 */
export function getDefaultLayerName( obj ) {
	switch ( obj.type ) {
		case 'i-text':
		case 'text':
		case 'textbox':
			return 'Text';
		case 'image':
			return 'Image';
		case 'rect':
			return 'Rectangle';
		case 'circle':
			return 'Circle';
		case 'triangle':
			return 'Triangle';
		case 'line':
			return 'Line';
		default:
			return 'Object';
	}
}

function defaultFill() {
	return themeColors?.[ 0 ]?.color ?? '#3b5998';
}

function defaultFont() {
	return themeFonts?.[ 0 ]?.fontFamily ?? 'sans-serif';
}

export const TEXT_ROLE_DEFAULTS = {
	huge: { fontSize: 96, fontWeight: 'bold' },
	'extra-large': { fontSize: 64, fontWeight: 'normal' },
	large: { fontSize: 40, fontWeight: 'normal' },
	medium: { fontSize: 24, fontWeight: 'normal' },
	small: { fontSize: 16, fontWeight: 'normal' },
};

/**
 * Create a Fabric shape object with theme-color defaults.
 *
 * @param {'rect'|'rounded-rect'|'circle'|'triangle'|'line'} type      Shape type.
 * @param {Object}                                           overrides Additional Fabric options.
 * @return {fabric.Object}
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
			return new fabric.Rect( {
				width: 200,
				height: 200,
				rx: 20,
				ry: 20,
				...base,
			} );
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
 * Default widths (in canvas pixels) for each text role.
 * Textbox needs an explicit width so text wraps instead of running off-canvas.
 */
const TEXT_ROLE_WIDTHS = {
	huge: 900,
	'extra-large': 800,
	large: 700,
	medium: 600,
	small: 500,
};

/**
 * Create a Fabric Textbox for a given text role.
 * Textbox (vs IText) enforces a width boundary and wraps text automatically.
 *
 * @param {'huge'|'extra-large'|'large'|'medium'|'small'} role      Text role.
 * @param {Object}                                        overrides Additional Fabric options.
 * @return {fabric.Textbox}
 */
const TEXT_ROLE_LABELS = {
	huge: 'Huge',
	'extra-large': 'Extra Large',
	large: 'Large',
	medium: 'Medium',
	small: 'Small',
};

export function createText( role, overrides = {} ) {
	const defaults = TEXT_ROLE_DEFAULTS[ role ] ?? TEXT_ROLE_DEFAULTS.medium;
	const { text: content, ...rest } = overrides;
	const label = content ?? TEXT_ROLE_LABELS[ role ] ?? 'Text';

	return new fabric.Textbox( label, {
		id: genId(),
		fontFamily: defaultFont(),
		fill: '#000000',
		left: 100,
		top: 100,
		width: TEXT_ROLE_WIDTHS[ role ] ?? 700,
		...defaults,
		...rest,
	} );
}

/**
 * Determine the selection type from a Fabric object.
 *
 * @param {fabric.Object} obj Fabric object.
 * @return {'text'|'image'|'shape'}
 */
export function getObjectType( obj ) {
	if ( ! obj ) {
		return 'none';
	}
	if (
		obj.type === 'i-text' ||
		obj.type === 'text' ||
		obj.type === 'textbox'
	) {
		return 'text';
	}
	if ( obj.type === 'image' ) {
		return 'image';
	}
	return 'shape';
}

/**
 * Extract display properties from a Fabric object for the properties panel.
 *
 * @param {fabric.Object}          obj  Fabric object.
 * @param {'text'|'image'|'shape'} type Determined object type.
 * @return {Object}
 */
export function extractProperties( obj, type ) {
	const base = {
		left: obj.left ?? 0,
		top: obj.top ?? 0,
		width: obj.getScaledWidth
			? Math.round( obj.getScaledWidth() )
			: obj.width ?? 0,
		height: obj.getScaledHeight
			? Math.round( obj.getScaledHeight() )
			: obj.height ?? 0,
		opacity: obj.opacity ?? 1,
		angle: obj.angle ?? 0,
		flipX: obj.flipX ?? false,
		flipY: obj.flipY ?? false,
		shadow: obj.shadow
			? {
					blur: obj.shadow.blur ?? 0,
					offsetX: obj.shadow.offsetX ?? 0,
					offsetY: obj.shadow.offsetY ?? 0,
					color: obj.shadow.color ?? 'rgba(0,0,0,0.3)',
			  }
			: null,
	};

	if ( type === 'text' ) {
		return {
			...base,
			fontFamily: obj.fontFamily ?? '',
			fontSize: obj.fontSize ?? 16,
			fontWeight: obj.fontWeight ?? 'normal',
			fontStyle: obj.fontStyle ?? 'normal',
			underline: obj.underline ?? false,
			textAlign: obj.textAlign ?? 'left',
			fill: obj.fill ?? '#000000',
			backgroundColor: obj.backgroundColor ?? '',
			charSpacing: obj.charSpacing ?? 0,
			lineHeight: obj.lineHeight ?? 1.16,
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
		fill: typeof obj.fill === 'string' ? obj.fill : null,
		stroke: obj.stroke ?? '',
		strokeWidth: obj.strokeWidth ?? 0,
		rx: obj.rx ?? 0,
	};
}
