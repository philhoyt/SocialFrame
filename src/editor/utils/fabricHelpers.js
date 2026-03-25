import * as fabric from 'fabric';

const { themeColors, themeFonts } = window.socialFrameConfig ?? {};

let _idCounter = 0;
export const genId = () => `sf-${ ++_idCounter }-${ Date.now() }`;

const SF_SHAPE_NAMES = {
	arch: 'Arch',
	squircle: 'Squircle',
	star: 'Star',
	diamond: 'Diamond',
	hexagon: 'Hexagon',
	cross: 'Cross',
	pentagon: 'Pentagon',
	arrow: 'Arrow',
};

/**
 * Return a human-readable default name for a Fabric object based on its type.
 *
 * @param {fabric.Object} obj
 * @return {string}
 */
export function getDefaultLayerName( obj ) {
	if ( obj.sfShapeType && SF_SHAPE_NAMES[ obj.sfShapeType ] ) {
		return SF_SHAPE_NAMES[ obj.sfShapeType ];
	}
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
 * Generate points for a regular polygon centered at (cx, cy) with a given radius.
 *
 * @param {number} cx      Center x.
 * @param {number} cy      Center y.
 * @param {number} r       Radius.
 * @param {number} sides   Number of sides.
 * @param {number} [startAngleDeg=0] Starting angle in degrees (0 = top).
 * @return {Array<{x:number,y:number}>}
 */
function regularPolygonPoints( cx, cy, r, sides, startAngleDeg = 0 ) {
	const pts = [];
	for ( let i = 0; i < sides; i++ ) {
		const angleDeg = startAngleDeg + ( 360 / sides ) * i;
		const angleRad = ( ( angleDeg - 90 ) * Math.PI ) / 180;
		pts.push( {
			x: cx + r * Math.cos( angleRad ),
			y: cy + r * Math.sin( angleRad ),
		} );
	}
	return pts;
}

/**
 * Generate points for a 5-pointed star centered at (cx, cy).
 *
 * @param {number} cx      Center x.
 * @param {number} cy      Center y.
 * @param {number} outerR  Outer radius (tip to center).
 * @param {number} innerR  Inner radius (notch to center).
 * @return {Array<{x:number,y:number}>}
 */
function starPoints( cx, cy, outerR, innerR ) {
	const pts = [];
	for ( let i = 0; i < 10; i++ ) {
		const angleDeg = i % 2 === 0 ? ( 360 / 5 ) * ( i / 2 ) : ( 360 / 5 ) * ( ( i - 1 ) / 2 ) + 36;
		const angleRad = ( ( angleDeg - 90 ) * Math.PI ) / 180;
		const r = i % 2 === 0 ? outerR : innerR;
		pts.push( {
			x: cx + r * Math.cos( angleRad ),
			y: cy + r * Math.sin( angleRad ),
		} );
	}
	return pts;
}

/**
 * Create a Fabric shape object with theme-color defaults.
 *
 * @param {'rect'|'rounded-rect'|'circle'|'triangle'|'line'|'arch'|'squircle'|'star'|'diamond'|'hexagon'|'cross'|'pentagon'|'arrow'} type Shape type.
 * @param {Object} overrides Additional Fabric options.
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
		case 'squircle':
			return new fabric.Rect( {
				width: 200,
				height: 200,
				rx: 60,
				ry: 60,
				sfShapeType: 'squircle',
				...base,
			} );
		case 'arch': {
			// Rectangle with a semicircular top: flat bottom, straight sides, arc top.
			const arch = new fabric.Path(
				'M 0 200 L 0 100 A 100 100 0 0 1 200 100 L 200 200 Z',
				{ sfShapeType: 'arch', ...base }
			);
			return arch;
		}
		case 'star': {
			const pts = starPoints( 100, 100, 100, 42 );
			return new fabric.Polygon( pts, { sfShapeType: 'star', ...base } );
		}
		case 'diamond': {
			const pts = [
				{ x: 100, y: 0 },
				{ x: 200, y: 100 },
				{ x: 100, y: 200 },
				{ x: 0, y: 100 },
			];
			return new fabric.Polygon( pts, { sfShapeType: 'diamond', ...base } );
		}
		case 'hexagon': {
			const pts = regularPolygonPoints( 100, 100, 100, 6, 0 );
			return new fabric.Polygon( pts, { sfShapeType: 'hexagon', ...base } );
		}
		case 'pentagon': {
			const pts = regularPolygonPoints( 100, 100, 100, 5, 0 );
			return new fabric.Polygon( pts, { sfShapeType: 'pentagon', ...base } );
		}
		case 'cross': {
			const cross = new fabric.Path(
				'M 70 0 L 130 0 L 130 70 L 200 70 L 200 130 L 130 130 L 130 200 L 70 200 L 70 130 L 0 130 L 0 70 L 70 70 Z',
				{ sfShapeType: 'cross', ...base }
			);
			return cross;
		}
		case 'arrow': {
			// Right-pointing arrow.
			const arrow = new fabric.Path(
				'M 0 70 L 120 70 L 120 30 L 200 100 L 120 170 L 120 130 L 0 130 Z',
				{ sfShapeType: 'arrow', ...base }
			);
			return arrow;
		}
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
