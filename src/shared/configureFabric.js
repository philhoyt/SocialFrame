/**
 * Fabric settings every SocialFrame canvas relies on.
 *
 * Shared by the editor and the post editor's renderer so both read and write
 * designs the same way.
 *
 * @param {Object} fabric The Fabric module.
 */
export function configureFabric( fabric ) {
	// Custom properties every object carries through toObject() and clone().
	// Registering them here (rather than passing a list to toObject) is what
	// keeps layer ids, names and template fields on duplicated objects too.
	fabric.FabricObject.customProperties = [
		'id',
		'isArtboard',
		'sfShapeType',
		'name',
		'fieldName',
		// Frames: a frame's layout settings, and a child's sizing.
		'sfFrame',
		'sfItem',
		// Locked layers: Fabric leaves these out of toObject() by default.
		'selectable',
		'evented',
		// Image corner radius, in canvas pixels.
		'sfRadius',
	];

	roundImageCorners( fabric.FabricImage );

	// Fabric 7 changed the default origin to center. Every position in the
	// editor, the artboard at 0,0 and the server-side image fill assume the
	// top-left corner, so keep Fabric 6's default for new and loaded objects.
	fabric.FabricObject.ownDefaults.originX = 'left';
	fabric.FabricObject.ownDefaults.originY = 'top';
}

// Bézier handle length for a quarter ellipse, as fabric.Rect uses.
const KAPPA = 1 - 0.5522847498;

/**
 * An image's corner radii in its own (unscaled) units.
 *
 * `sfRadius` is in canvas pixels, so the corners look the same however the
 * image is scaled: by hand, by a frame, or after a template fill swaps the
 * photo. It never exceeds half the shorter side.
 *
 * @param {Object} img Image with sfRadius, width, height, scaleX and scaleY.
 * @return {{rx: number, ry: number}} Radii; zero when there is no rounding.
 */
export function imageRadii( img ) {
	const r = Number( img.sfRadius );
	const sx = Math.abs( img.scaleX || 1 );
	const sy = Math.abs( img.scaleY || 1 );
	const w = ( img.width || 0 ) * sx;
	const h = ( img.height || 0 ) * sy;
	if ( ! Number.isFinite( r ) || r <= 0 || ! w || ! h ) {
		return { rx: 0, ry: 0 };
	}
	const px = Math.min( r, w / 2, h / 2 );
	return { rx: px / sx, ry: px / sy };
}

/**
 * Trace a rounded rectangle centred on the origin.
 *
 * @param {CanvasRenderingContext2D} ctx Context.
 * @param {number}                   w   Width.
 * @param {number}                   h   Height.
 * @param {number}                   rx  Horizontal radius.
 * @param {number}                   ry  Vertical radius.
 */
function roundedRect( ctx, w, h, rx, ry ) {
	const x = -w / 2;
	const y = -h / 2;
	ctx.beginPath();
	ctx.moveTo( x + rx, y );
	ctx.lineTo( x + w - rx, y );
	ctx.bezierCurveTo(
		x + w - KAPPA * rx,
		y,
		x + w,
		y + KAPPA * ry,
		x + w,
		y + ry
	);
	ctx.lineTo( x + w, y + h - ry );
	ctx.bezierCurveTo(
		x + w,
		y + h - KAPPA * ry,
		x + w - KAPPA * rx,
		y + h,
		x + w - rx,
		y + h
	);
	ctx.lineTo( x + rx, y + h );
	ctx.bezierCurveTo(
		x + KAPPA * rx,
		y + h,
		x,
		y + h - KAPPA * ry,
		x,
		y + h - ry
	);
	ctx.lineTo( x, y + ry );
	ctx.bezierCurveTo( x, y + KAPPA * ry, x + KAPPA * rx, y, x + rx, y );
	ctx.closePath();
}

/**
 * Draw images with rounded corners when they have an `sfRadius`.
 *
 * The outline is rounded (so a stroke follows it) and the pixels are clipped
 * to it. Clipping would also cut away a drop shadow, so a shadowed image
 * first fills the outline to cast its shadow, then draws without one.
 *
 * @param {Object} FabricImage The Fabric image class.
 */
function roundImageCorners( FabricImage ) {
	const proto = FabricImage.prototype;
	if ( proto.sfRoundCorners ) {
		return;
	}
	proto.sfRoundCorners = true;
	FabricImage.cacheProperties = [
		...FabricImage.cacheProperties,
		'sfRadius',
	];

	const stroke = proto._stroke;
	proto._stroke = function ( ctx ) {
		const { rx, ry } = imageRadii( this );
		if ( ! rx ) {
			return stroke.call( this, ctx );
		}
		if ( this.stroke && this.strokeWidth !== 0 ) {
			roundedRect( ctx, this.width, this.height, rx, ry );
		}
	};

	const fill = proto._renderFill;
	proto._renderFill = function ( ctx ) {
		const { rx, ry } = imageRadii( this );
		if ( ! rx || ! this._element ) {
			return fill.call( this, ctx );
		}
		ctx.save();
		roundedRect( ctx, this.width, this.height, rx, ry );
		if ( this.shadow ) {
			ctx.fillStyle = '#000';
			ctx.fill();
			ctx.shadowColor = 'transparent';
		}
		ctx.clip();
		fill.call( this, ctx );
		ctx.restore();
		// Leave the rounded outline as the current path for the stroke.
		roundedRect( ctx, this.width, this.height, rx, ry );
	};
}
