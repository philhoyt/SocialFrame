/**
 * Unit tests for the frame layout core.
 */
import { describe, it, expect, vi } from 'vitest';
import {
	readFrame,
	readItem,
	readTree,
	resolveWidths,
	measureHeights,
	placeTree,
	ownedFlex,
	fitFrame,
	containInBox,
	canJoin,
	canFlex,
	applyFrameLayout,
	ELLIPSIS,
	LIMITS,
} from '../frameLayout';

const frame = ( props = {} ) => ( {
	direction: 'column',
	padding: { top: 0, right: 0, bottom: 0, left: 0 },
	gap: 0,
	alignX: 'start',
	alignY: 'start',
	width: 'fixed',
	height: 'fixed',
	children: [],
	...props,
} );

/**
 * Lay a tree of plain nodes out with the three passes.
 *
 * @param {Object[]}                              objects Objects for readTree().
 * @param {Object}                                sizes   Node sizes by id.
 * @param {string}                                root    Root id.
 * @param {(id: string, width: number) => number} measure Text measurer.
 * @return {Object} Positions, widths, heights, drawn widths, overflows.
 */
function layout( objects, sizes, root, measure = () => 0 ) {
	const tree = readTree( objects );
	const widths = resolveWidths( tree, sizes, root, sizes[ root ].w );
	const { heights, drawn } = measureHeights(
		tree,
		sizes,
		widths,
		root,
		measure
	);
	const placed = placeTree( tree, widths, heights, drawn, root, {
		left: 0,
		top: 0,
	} );
	return { tree, widths, heights, drawn, ...placed };
}

const pos = ( result, id ) => result.positions.get( id );

describe( 'readers', () => {
	it( 'normalises frames and items', () => {
		expect( readFrame( { children: 'x' } ) ).toBeNull();
		expect(
			readFrame( {
				direction: 'diagonal',
				padding: { top: -5, left: 1e9 },
				gap: 'wide',
				alignX: 'middle',
				width: 'hug',
				children: [ 'a', 'a', 7, '' ],
			} )
		).toEqual( {
			direction: 'column',
			padding: { top: 0, right: 0, bottom: 0, left: 5000 },
			gap: 0,
			alignX: 'start',
			alignY: 'start',
			width: 'hug',
			height: 'fixed',
			children: [ 'a' ],
		} );
		expect(
			readItem( { width: 'fill', fontSize: 40, minFontSize: 90 } )
		).toMatchObject( { width: 'fill', fontSize: 40, minFontSize: 40 } );
	} );

	it( 'drops cycles, second parents, duplicates, the artboard and ineligible children', () => {
		const tree = readTree( [
			{ id: 'artboard', isArtboard: true, type: 'rect' },
			{
				id: 'a',
				type: 'rect',
				sfFrame: frame( { children: [ 'b', 'x', 'artboard', 'dup' ] } ),
			},
			{ id: 'b', type: 'rect', sfFrame: frame( { children: [ 'a' ] } ) },
			{
				id: 'c',
				type: 'rect',
				sfFrame: frame( { children: [ 'x', 'rot', 'grp' ] } ),
			},
			{ id: 'x', type: 'textbox' },
			{ id: 'rot', type: 'textbox', angle: 20 },
			{ id: 'grp', type: 'group' },
			{ id: 'dup', type: 'textbox' },
			{ id: 'dup', type: 'textbox' },
		] );

		expect( tree.children.get( 'a' ) ).toEqual( [ 'b', 'x' ] );
		// b listed a, but a is b's parent: the cycle is broken.
		expect( tree.children.get( 'b' ) ).toEqual( [] );
		// x already belongs to a; rotated and grouped layers can't join.
		expect( tree.children.get( 'c' ) ).toEqual( [] );
		expect( tree.parent.has( 'artboard' ) ).toBe( false );
		expect( tree.parent.has( 'dup' ) ).toBe( false );
		expect( tree.roots ).toEqual( [ 'a', 'c' ] );
	} );

	it( 'stops at the depth limit', () => {
		const objects = [];
		for ( let i = 0; i < LIMITS.depth + 3; i++ ) {
			objects.push( {
				id: `f${ i }`,
				type: 'rect',
				sfFrame: frame( { children: [ `f${ i + 1 }` ] } ),
			} );
		}
		const tree = readTree( objects );
		expect( tree.depth.get( `f${ LIMITS.depth - 1 }` ) ).toBe(
			LIMITS.depth - 1
		);
		expect( tree.parent.has( `f${ LIMITS.depth }` ) ).toBe( false );
	} );
} );

describe( 'three-pass layout', () => {
	it( 'stacks a column with padding and gap, and fills width', () => {
		const objects = [
			{
				id: 'f',
				type: 'rect',
				sfFrame: frame( {
					padding: { top: 10, right: 20, bottom: 10, left: 20 },
					gap: 5,
					children: [ 'a', 'b' ],
				} ),
			},
			{ id: 'a', type: 'rect' },
			{ id: 'b', type: 'rect' },
		];
		const result = layout(
			objects,
			{
				f: { w: 300, h: 400 },
				a: { w: 100, h: 50 },
				b: { w: 100, h: 30, fill: true },
			},
			'f'
		);

		expect( pos( result, 'a' ) ).toEqual( { left: 20, top: 10 } );
		expect( pos( result, 'b' ) ).toEqual( { left: 20, top: 65 } );
		expect( result.widths.get( 'b' ) ).toBe( 260 );
		expect( result.overflows ).toEqual( [] );
	} );

	it( 'shares fill width in a row and centres on both axes', () => {
		const objects = [
			{
				id: 'row',
				type: 'rect',
				sfFrame: frame( {
					direction: 'row',
					gap: 10,
					alignX: 'center',
					alignY: 'center',
					children: [ 'a', 'b', 'c' ],
				} ),
			},
			{ id: 'a', type: 'rect' },
			{ id: 'b', type: 'rect' },
			{ id: 'c', type: 'rect' },
		];
		const result = layout(
			objects,
			{
				row: { w: 500, h: 100 },
				a: { w: 100, h: 40 },
				b: { w: 0, h: 20, fill: true },
				c: { w: 0, h: 60, fill: true },
			},
			'row'
		);

		// (500 - 100 - 20) / 2 = 190 each.
		expect( result.widths.get( 'b' ) ).toBe( 190 );
		expect( pos( result, 'a' ) ).toEqual( { left: 0, top: 30 } );
		expect( pos( result, 'b' ) ).toEqual( { left: 110, top: 40 } );
		expect( pos( result, 'c' ) ).toEqual( { left: 310, top: 20 } );
	} );

	it( 'hugs content, and nests a hug badge inside a row', () => {
		const objects = [
			{
				id: 'row',
				type: 'rect',
				sfFrame: frame( {
					direction: 'row',
					gap: 16,
					alignY: 'center',
					width: 'hug',
					height: 'hug',
					children: [ 'badge', 'area' ],
				} ),
			},
			{
				id: 'badge',
				type: 'rect',
				sfFrame: frame( {
					padding: { top: 12, right: 24, bottom: 12, left: 24 },
					width: 'hug',
					height: 'hug',
					alignX: 'center',
					children: [ 'grade' ],
				} ),
			},
			{ id: 'grade', type: 'textbox' },
			{ id: 'area', type: 'textbox' },
		];
		const result = layout(
			objects,
			{
				row: {},
				badge: {},
				grade: { w: 60, text: true },
				area: { w: 300, text: true },
			},
			'row',
			( id ) => ( id === 'grade' ? 56 : 40 )
		);

		expect( result.widths.get( 'badge' ) ).toBe( 108 );
		expect( result.heights.get( 'badge' ) ).toBe( 80 );
		expect( result.widths.get( 'row' ) ).toBe( 108 + 16 + 300 );
		expect( result.heights.get( 'row' ) ).toBe( 80 );
		expect( pos( result, 'grade' ) ).toEqual( { left: 24, top: 12 } );
		expect( pos( result, 'area' ) ).toEqual( { left: 124, top: 20 } );
	} );

	it( 'sizes images by aspect ratio, capped by maxHeight and centred', () => {
		const objects = [
			{
				id: 'f',
				type: 'rect',
				sfFrame: frame( { alignX: 'center', children: [ 'p', 'l' ] } ),
			},
			{ id: 'p', type: 'image' },
			{ id: 'l', type: 'image' },
		];
		const result = layout(
			objects,
			{
				f: { w: 1080, h: 2000 },
				p: {
					fill: true,
					image: { width: 2048, height: 2560 },
					maxHeight: 810,
				},
				l: { fill: true, image: { width: 2048, height: 1152 } },
			},
			'f'
		);

		expect( result.drawn.get( 'p' ) ).toBeCloseTo( 648 );
		expect( result.heights.get( 'p' ) ).toBeCloseTo( 810 );
		expect( pos( result, 'p' ).left ).toBeCloseTo( 216 );
		expect( result.heights.get( 'l' ) ).toBeCloseTo( 607.5 );
		expect( pos( result, 'l' ) ).toEqual( { left: 0, top: 810 } );
	} );

	it( 'centres a short column vertically and reports overflow per axis', () => {
		const objects = [
			{
				id: 'f',
				type: 'rect',
				sfFrame: frame( { alignY: 'center', children: [ 'a' ] } ),
			},
			{ id: 'a', type: 'rect' },
			{
				id: 'row',
				type: 'rect',
				sfFrame: frame( { direction: 'row', children: [ 'w' ] } ),
			},
			{ id: 'w', type: 'rect' },
		];
		const centred = layout(
			objects,
			{ f: { w: 100, h: 300 }, a: { w: 50, h: 100 } },
			'f'
		);
		expect( pos( centred, 'a' ).top ).toBe( 100 );

		const wide = layout(
			objects,
			{ row: { w: 100, h: 50 }, w: { w: 180, h: 80 } },
			'row'
		);
		expect( wide.overflows ).toEqual( [
			{ frameId: 'row', axis: 'x', amount: 80 },
			{ frameId: 'row', axis: 'y', amount: 30 },
		] );
	} );

	it( 'gives the same result when run twice', () => {
		const objects = [
			{
				id: 'f',
				type: 'rect',
				sfFrame: frame( { gap: 8, children: [ 'a', 'b' ] } ),
			},
			{ id: 'a', type: 'textbox' },
			{ id: 'b', type: 'textbox' },
		];
		const sizes = {
			f: { w: 400, h: 600 },
			a: { w: 200, text: true, fill: true },
			b: { w: 120, text: true },
		};
		const measure = ( id, width ) => Math.ceil( 1000 / width ) * 20;
		const first = layout( objects, sizes, 'f', measure );
		const second = layout( objects, sizes, 'f', measure );
		expect( [ ...second.positions ] ).toEqual( [ ...first.positions ] );
		expect( [ ...second.widths ] ).toEqual( [ ...first.widths ] );
	} );
} );

describe( 'ownedFlex', () => {
	it( 'stops at fixed-height child frames', () => {
		const tree = readTree( [
			{
				id: 'root',
				type: 'rect',
				sfFrame: frame( { children: [ 'hug', 'fixed', 'loose' ] } ),
			},
			{
				id: 'hug',
				type: 'rect',
				sfFrame: frame( { height: 'hug', children: [ 'inner' ] } ),
			},
			{
				id: 'fixed',
				type: 'rect',
				sfFrame: frame( { children: [ 'boxed' ] } ),
			},
			{ id: 'inner', type: 'textbox' },
			{ id: 'boxed', type: 'textbox' },
			{ id: 'loose', type: 'textbox' },
		] );
		const sizes = {
			inner: { flex: true },
			boxed: { flex: true },
			loose: { flex: true },
		};
		expect( ownedFlex( tree, 'root', sizes ) ).toEqual( [
			'inner',
			'loose',
		] );
		expect( ownedFlex( tree, 'fixed', sizes ) ).toEqual( [ 'boxed' ] );
	} );
} );

describe( 'fitFrame', () => {
	// 10 characters per line, line height = font size; 400px above it.
	const lines = ( text, size ) =>
		Math.max( 1, Math.ceil( [ ...text ].length / 10 ) ) * size;
	const setup = ( text, limit, extra = 400 ) => {
		const overflowFor = vi.fn(
			( sizes, texts ) =>
				extra + lines( texts.c ?? text, sizes.c ?? 40 ) - limit
		);
		return {
			flex: [ { id: 'c', fontSize: 40, minFontSize: 20 } ],
			overflowFor,
		};
	};

	it( 'leaves base sizes when it fits', () => {
		const { flex, overflowFor } = setup( 'short', 1000 );
		expect( fitFrame( flex, { c: 'short' }, overflowFor ) ).toMatchObject( {
			fontSizes: { c: 40 },
			texts: {},
			overflow: 0,
		} );
	} );

	it( 'shrinks before truncating', () => {
		const text = 'x'.repeat( 50 );
		const { flex, overflowFor } = setup( text, 560 );
		const fit = fitFrame( flex, { c: text }, overflowFor );
		expect( fit.texts ).toEqual( {} );
		expect( fit.fontSizes.c ).toBeLessThan( 40 );
		expect( 400 + 5 * fit.fontSizes.c ).toBeLessThanOrEqual( 560 );
	} );

	it( 'truncates at a word with an ellipsis, keeping line breaks', () => {
		const text = 'aaaa bbbb\ncccc dddd eeee ffff gggg hhhh iiii jjjj';
		const { flex, overflowFor } = setup( text, 440 );
		const fit = fitFrame( flex, { c: text }, overflowFor );
		expect( fit.truncated ).toEqual( [ 'c' ] );
		expect( fit.texts.c.startsWith( 'aaaa bbbb\n' ) ).toBe( true );
		expect( fit.texts.c.endsWith( ELLIPSIS ) ).toBe( true );
		expect( fit.overflow ).toBe( 0 );
	} );

	it( 'cuts a long URL by graphemes', () => {
		const url = 'https://example.com/' + 'a'.repeat( 200 );
		const { flex, overflowFor } = setup( url, 440 );
		const fit = fitFrame( flex, { c: url }, overflowFor );
		expect( fit.texts.c.startsWith( 'https://' ) ).toBe( true );
		expect( fit.overflow ).toBe( 0 );
	} );

	it( 'reports overflow when fixed content alone does not fit', () => {
		const { flex, overflowFor } = setup( 'short', 300 );
		const fit = fitFrame( flex, { c: 'short' }, overflowFor );
		expect( fit.overflow ).toBeGreaterThan( 0 );
		expect( fit.texts.c ).toBe( '' );
	} );

	it( 'stays within its measurement budget on huge input', () => {
		const text = 'word '.repeat( 10000 );
		const { flex, overflowFor } = setup( text, 440 );
		fitFrame( flex, { c: text }, overflowFor );
		expect( overflowFor.mock.calls.length ).toBeLessThan( 40 );
	} );
} );

describe( 'helpers', () => {
	it( 'contains images in a box', () => {
		const g = containInBox(
			{ width: 2048, height: 2560 },
			{ left: 0, width: 1080, height: 810 }
		);
		expect( g.width * g.scaleX ).toBeCloseTo( 648 );
		expect( g.left ).toBeCloseTo( 216 );
		expect(
			containInBox(
				{ width: 2048, height: 1152 },
				{ left: 0, width: 1000, height: 0 }
			).scaleX
		).toBeCloseTo( 1000 / 2048 );
	} );

	it( 'gates joining and shrinking', () => {
		expect( canJoin( { type: 'image', angle: 3 } ) ).toBe( false );
		expect( canJoin( { type: 'textbox' } ) ).toBe( true );
		expect( canFlex( { type: 'i-text' } ) ).toBe( false );
		expect(
			canFlex( {
				type: 'textbox',
				styles: { 0: { 1: { fontSize: 9 } } },
			} )
		).toBe( false );
	} );
} );

describe( 'applyFrameLayout', () => {
	/**
	 * A minimal stand-in for a Fabric object.
	 *
	 * @param {Object} props Initial props.
	 * @return {Object} Fake object.
	 */
	function fake( props ) {
		const obj = {
			scaleX: 1,
			scaleY: 1,
			...props,
			set( values ) {
				Object.assign( this, values );
			},
			initDimensions() {
				if ( this.text !== undefined ) {
					const perLine = Math.max(
						1,
						Math.floor( this.width / 20 )
					);
					this.height =
						Math.max( 1, Math.ceil( this.text.length / perLine ) ) *
						this.fontSize;
				}
			},
			getScaledWidth() {
				return this.width * this.scaleX;
			},
			getScaledHeight() {
				return this.height * this.scaleY;
			},
			setCoords: vi.fn(),
		};
		obj.initDimensions();
		return obj;
	}

	const LONG = 'y'.repeat( 400 );
	const canvasOf = () => {
		const artboard = fake( {
			id: 'artboard',
			isArtboard: true,
			type: 'rect',
			left: 0,
			top: 0,
			width: 400,
			height: 500,
			sfFrame: frame( {
				padding: { top: 20, right: 20, bottom: 20, left: 20 },
				gap: 10,
				children: [ 'photo', 'body' ],
			} ),
		} );
		const photo = fake( {
			id: 'photo',
			type: 'image',
			width: 800,
			height: 400,
			sfItem: { width: 'fill' },
		} );
		const body = fake( {
			id: 'body',
			type: 'textbox',
			width: 100,
			text: LONG,
			fontSize: 40,
			styles: {},
			sfItem: {
				width: 'fill',
				flex: true,
				fontSize: 40,
				minFontSize: 20,
			},
		} );
		return {
			objs: { artboard, photo, body },
			canvas: { getObjects: () => [ artboard, photo, body ] },
		};
	};

	it( 'lays out, truncates only on request, and restores', () => {
		const { objs, canvas } = canvasOf();

		const live = applyFrameLayout( canvas );
		expect( objs.photo.getScaledWidth() ).toBeCloseTo( 360 );
		expect( objs.photo.getScaledHeight() ).toBeCloseTo( 180 );
		expect( objs.body.top ).toBeCloseTo( 20 + 180 + 10 );
		expect( objs.body.width ).toBe( 360 );
		expect( objs.body.fontSize ).toBe( 20 );
		expect( objs.body.text ).toBe( LONG );
		expect( live.overflows.length ).toBe( 1 );
		expect( live.truncated ).toEqual( [ 'body' ] );

		const exported = applyFrameLayout( canvas, { truncate: true } );
		expect( objs.body.text.endsWith( ELLIPSIS ) ).toBe( true );
		expect( exported.overflows ).toEqual( [] );

		exported.restore();
		expect( objs.body.text ).toBe( LONG );
	} );

	it( 'restores everything when layout throws', () => {
		const { objs, canvas } = canvasOf();
		const top = objs.body.top;
		objs.body.getScaledHeight = () => {
			throw new Error( 'boom' );
		};
		expect( () => applyFrameLayout( canvas ) ).toThrow( 'boom' );
		expect( objs.body.top ).toBe( top );
		expect( objs.body.width ).toBe( 100 );
	} );

	it( 'does nothing without frames', () => {
		const result = applyFrameLayout( {
			getObjects: () => [
				fake( { id: 'a', type: 'rect', width: 1, height: 1 } ),
			],
		} );
		expect( result.overflows ).toEqual( [] );
	} );
} );
