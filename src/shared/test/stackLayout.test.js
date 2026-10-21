/**
 * Unit tests for the vertical stack layout core.
 */
import { describe, it, expect, vi } from 'vitest';
import {
	readStack,
	readItem,
	readBox,
	containInBox,
	groupRows,
	computeStack,
	fitStack,
	joinStack,
	leaveStack,
	moveRow,
	shiftRowGap,
	canJoin,
	canFlex,
	applyStackLayout,
	ELLIPSIS,
} from '../stackLayout';

const stackOf = ( rows, top = 100, bottom = 60 ) => ( { top, bottom, rows } );

describe( 'validation', () => {
	it( 'rejects missing or empty stacks and drops bad rows', () => {
		expect( readStack( null ) ).toBeNull();
		expect( readStack( { rows: [] } ) ).toBeNull();
		expect(
			readStack( {
				top: 'x',
				bottom: -5,
				rows: [ { id: 'a', gap: 1e9 }, { id: 'a' }, { gap: 3 } ],
			} )
		).toEqual( { top: 0, bottom: 0, rows: [ { id: 'a', gap: 5000 } ] } );
	} );

	it( 'clamps items and boxes', () => {
		expect( readItem( { offset: 1 } ) ).toBeNull();
		expect(
			readItem( {
				row: 'a',
				offset: -4,
				flex: true,
				fontSize: 5000,
				minFontSize: 2,
			} )
		).toEqual( {
			row: 'a',
			offset: 0,
			flex: true,
			fontSize: 1000,
			minFontSize: 6,
		} );
		expect( readBox( { width: 0, height: 10 } ) ).toBeNull();
		expect( readBox( { width: Infinity, height: 10 } ) ).toBeNull();
		expect( readBox( { left: 5, width: 100, height: 50 } ) ).toEqual( {
			left: 5,
			width: 100,
			height: 50,
		} );
	} );
} );

describe( 'containInBox', () => {
	const box = { left: 0, width: 1080, height: 810 };

	it( 'fits a portrait image to the box height, centred', () => {
		const g = containInBox( { width: 2048, height: 2560 }, box );
		expect( g.scaleX ).toBeCloseTo( 810 / 2560 );
		expect( g.width * g.scaleX ).toBeCloseTo( 648 );
		expect( g.left ).toBeCloseTo( 216 );
		expect( [ g.cropX, g.cropY ] ).toEqual( [ 0, 0 ] );
	} );

	it( 'fits a landscape image to the box width', () => {
		const g = containInBox( { width: 2048, height: 1152 }, box );
		expect( g.width * g.scaleX ).toBeCloseTo( 1080 );
		expect( g.height * g.scaleY ).toBeCloseTo( 607.5 );
		expect( g.left ).toBeCloseTo( 0 );
	} );

	it( 'returns null for unusable sizes', () => {
		expect( containInBox( { width: 0, height: 10 }, box ) ).toBeNull();
	} );
} );

describe( 'computeStack', () => {
	it( 'places rows by gap and offset, and reports overflow', () => {
		const stack = stackOf( [
			{ id: 'img', gap: 0 },
			{ id: 'meta', gap: 30 },
		] );
		const rows = groupRows( stack, [
			{ id: 'photo', item: { row: 'img', offset: 0 } },
			{ id: 'badge', item: { row: 'meta', offset: 10 } },
			{ id: 'grade', item: { row: 'meta', offset: 22 } },
		] );
		const placed = computeStack(
			stack,
			rows,
			{ photo: 500, badge: 90, grade: 60 },
			700
		);

		// The meta row is normalised so the badge sits at offset 0.
		expect( placed.tops ).toEqual( { photo: 100, badge: 630, grade: 642 } );
		expect( placed.bottom ).toBe( 720 );
		expect( placed.overflow ).toBe( 20 );
	} );

	it( 'skips rows with no members', () => {
		const stack = stackOf( [
			{ id: 'a', gap: 0 },
			{ id: 'empty', gap: 999 },
			{ id: 'b', gap: 10 },
		] );
		const rows = groupRows( stack, [
			{ id: 'x', item: { row: 'a', offset: 0 } },
			{ id: 'y', item: { row: 'b', offset: 0 } },
		] );
		expect(
			computeStack( stack, rows, { x: 50, y: 50 }, 1000 ).tops.y
		).toBe( 160 );
	} );
} );

describe( 'membership', () => {
	/**
	 * Lay members out and return them with live tops, like the editor would.
	 *
	 * @param {Object} stack Stack.
	 * @param {Object} items Items by id.
	 * @param {Object} sizes Heights by id.
	 * @return {Array} Members with top and height.
	 */
	function live( stack, items, sizes ) {
		const members = Object.entries( items ).map( ( [ id, item ] ) => ( {
			id,
			item,
		} ) );
		const placed = computeStack(
			stack,
			groupRows( stack, members ),
			sizes,
			1e6
		);
		return members.map( ( m ) => ( {
			...m,
			top: placed.tops[ m.id ],
			height: sizes[ m.id ],
		} ) );
	}

	it( 'creates a stack and keeps every layer where it was', () => {
		const sizes = { photo: 400, badge: 90, area: 40, title: 80 };
		let s = joinStack( null, [], { id: 'photo', top: 50, height: 400 } );
		s = joinStack( s.stack, live( s.stack, s.items, sizes ), {
			id: 'title',
			top: 600,
			height: 80,
		} );
		s = joinStack( s.stack, live( s.stack, s.items, sizes ), {
			id: 'badge',
			top: 480,
			height: 90,
		} );
		s = joinStack( s.stack, live( s.stack, s.items, sizes ), {
			id: 'area',
			top: 500,
			height: 40,
		} );

		const tops = Object.fromEntries(
			live( s.stack, s.items, sizes ).map( ( m ) => [ m.id, m.top ] )
		);
		expect( tops ).toEqual( {
			photo: 50,
			title: 600,
			badge: 480,
			area: 500,
		} );
		expect( s.items.area.row ).toBe( s.items.badge.row );
		expect( s.stack.rows ).toHaveLength( 3 );
	} );

	it( 'gives the same layout whatever order layers join in', () => {
		const sizes = { a: 100, b: 50, c: 30 };
		const at = { a: 0, b: 150, c: 160 };
		const build = ( order ) => {
			let s = { stack: null, items: {} };
			for ( const id of order ) {
				s = joinStack(
					s.stack,
					s.stack ? live( s.stack, s.items, sizes ) : [],
					{ id, top: at[ id ], height: sizes[ id ] }
				);
			}
			return Object.fromEntries(
				live( s.stack, s.items, sizes ).map( ( m ) => [ m.id, m.top ] )
			);
		};
		expect( build( [ 'a', 'b', 'c' ] ) ).toEqual( at );
		expect( build( [ 'c', 'b', 'a' ] ) ).toEqual( at );
		expect( build( [ 'b', 'a', 'c' ] ) ).toEqual( at );
	} );

	it( 'joins the row it overlaps most when it overlaps two', () => {
		const sizes = { a: 100, b: 100, c: 80 };
		let s = joinStack( null, [], { id: 'a', top: 0, height: 100 } );
		s = joinStack( s.stack, live( s.stack, s.items, sizes ), {
			id: 'b',
			top: 120,
			height: 100,
		} );
		s = joinStack( s.stack, live( s.stack, s.items, sizes ), {
			id: 'c',
			top: 80,
			height: 80,
		} );
		expect( s.items.c.row ).toBe( s.items.b.row );
	} );

	it( 'rebases a row when a layer joins above its top', () => {
		const sizes = { a: 100, b: 50 };
		let s = joinStack( null, [], { id: 'a', top: 100, height: 100 } );
		s = joinStack( s.stack, live( s.stack, s.items, sizes ), {
			id: 'b',
			top: 80,
			height: 50,
		} );
		expect( s.stack.top ).toBe( 80 );
		expect( s.items.a.offset ).toBe( 20 );
		expect( s.items.b.offset ).toBe( 0 );
	} );

	it( 'folds an emptied row into the gap below, and removes the stack with its last member', () => {
		const sizes = { a: 100, b: 40, c: 60 };
		let s = joinStack( null, [], { id: 'a', top: 0, height: 100 } );
		s = joinStack( s.stack, live( s.stack, s.items, sizes ), {
			id: 'b',
			top: 120,
			height: 40,
		} );
		s = joinStack( s.stack, live( s.stack, s.items, sizes ), {
			id: 'c',
			top: 200,
			height: 60,
		} );

		const left = leaveStack(
			s.stack,
			live( s.stack, s.items, sizes ),
			'b'
		);
		const tops = Object.fromEntries(
			live( left.stack, left.items, sizes ).map( ( m ) => [
				m.id,
				m.top,
			] )
		);
		expect( tops ).toEqual( { a: 0, c: 200 } );
		expect( left.stack.rows ).toHaveLength( 2 );

		let rest = left;
		rest = leaveStack(
			rest.stack,
			live( rest.stack, rest.items, sizes ),
			'a'
		);
		expect( Object.keys( rest.items ) ).toEqual( [ 'c' ] );
		rest = leaveStack(
			rest.stack,
			live( rest.stack, rest.items, sizes ),
			'c'
		);
		expect( rest.stack ).toBeNull();
	} );

	it( 'moves rows but keeps gaps in place, and clamps dragged gaps', () => {
		const stack = stackOf( [
			{ id: 'a', gap: 0 },
			{ id: 'b', gap: 20 },
			{ id: 'c', gap: 40 },
		] );
		expect( moveRow( stack, 'c', -1 ).rows ).toEqual( [
			{ id: 'a', gap: 0 },
			{ id: 'c', gap: 20 },
			{ id: 'b', gap: 40 },
		] );
		expect( moveRow( stack, 'a', -1 ) ).toBe( stack );
		expect( shiftRowGap( stack, 'b', -50 ).rows[ 1 ].gap ).toBe( 0 );
		expect( shiftRowGap( stack, 'b', 15 ).rows[ 1 ].gap ).toBe( 35 );
	} );
} );

describe( 'fitStack', () => {
	// A fake text box: 10 characters per line, line height = font size.
	const wrapHeight = ( text, size ) =>
		Math.max( 1, Math.ceil( [ ...text ].length / 10 ) ) * size;

	const setup = ( contentText, opts = {} ) => {
		const stack = stackOf(
			[
				{ id: 'img', gap: 0 },
				{ id: 'body', gap: 20 },
			],
			0,
			0
		);
		const rows = groupRows( stack, [
			{ id: 'photo', item: { row: 'img', offset: 0 } },
			{
				id: 'content',
				item: {
					row: 'body',
					offset: 0,
					flex: opts.flex ?? true,
					fontSize: 40,
					minFontSize: 20,
				},
			},
		] );
		const measure = vi.fn( ( id, { fontSize, text } ) =>
			id === 'photo'
				? ( opts.photo ?? 400 )
				: wrapHeight( text ?? contentText, fontSize ?? 40 )
		);
		return { stack, rows, measure };
	};

	it( 'leaves everything at base size when it fits', () => {
		const { stack, rows, measure } = setup( 'short' );
		const fit = fitStack(
			stack,
			rows,
			{ content: 'short' },
			1000,
			measure
		);
		expect( fit ).toMatchObject( {
			fontSizes: { content: 40 },
			texts: {},
			overflow: 0,
			truncated: [],
		} );
	} );

	it( 'shrinks flexible text before truncating', () => {
		const text = 'x'.repeat( 50 ); // 5 lines.
		const { stack, rows, measure } = setup( text );
		// 400 + 20 + 5 lines: fits at 32px (160) within 580.
		const fit = fitStack( stack, rows, { content: text }, 580, measure );
		expect( fit.texts ).toEqual( {} );
		expect( fit.fontSizes.content ).toBeLessThan( 40 );
		expect( fit.fontSizes.content ).toBeGreaterThanOrEqual( 20 );
		expect( 420 + 5 * fit.fontSizes.content ).toBeLessThanOrEqual( 580 );
	} );

	it( 'truncates at a word boundary with an ellipsis, keeping line breaks', () => {
		const text = 'aaaa bbbb\ncccc dddd eeee ffff gggg hhhh iiii jjjj';
		const { stack, rows, measure } = setup( text );
		// Room for 2 lines at the 20px minimum.
		const fit = fitStack( stack, rows, { content: text }, 460, measure );
		expect( fit.fontSizes.content ).toBe( 20 );
		expect( fit.truncated ).toEqual( [ 'content' ] );
		expect( fit.texts.content.endsWith( ELLIPSIS ) ).toBe( true );
		expect( fit.texts.content.startsWith( 'aaaa bbbb\n' ) ).toBe( true );
		expect( wrapHeight( fit.texts.content, 20 ) ).toBeLessThanOrEqual( 40 );
		expect( fit.overflow ).toBe( 0 );
	} );

	it( 'cuts a long URL by graphemes', () => {
		const url = 'https://example.com/' + 'a'.repeat( 200 );
		const { stack, rows, measure } = setup( url );
		const fit = fitStack( stack, rows, { content: url }, 460, measure );
		expect( fit.texts.content.length ).toBeGreaterThan( 2 );
		expect( fit.texts.content.startsWith( 'https://' ) ).toBe( true );
		expect( fit.overflow ).toBe( 0 );
	} );

	it( 'reports overflow when fixed layers alone do not fit', () => {
		const { stack, rows, measure } = setup( 'short', { photo: 900 } );
		const fit = fitStack( stack, rows, { content: 'short' }, 500, measure );
		expect( fit.overflow ).toBeGreaterThan( 0 );
		expect( fit.texts.content ).toBe( '' );
	} );

	it( 'reports overflow without changing text when nothing is flexible', () => {
		const text = 'x'.repeat( 500 );
		const { stack, rows, measure } = setup( text, { flex: false } );
		const fit = fitStack( stack, rows, { content: text }, 500, measure );
		expect( fit.overflow ).toBeGreaterThan( 0 );
		expect( fit.texts ).toEqual( {} );
		expect( fit.truncated ).toEqual( [] );
	} );

	it( 'stays within its measurement budget on huge input', () => {
		const text = 'word '.repeat( 10000 );
		const { stack, rows, measure } = setup( text );
		const fit = fitStack( stack, rows, { content: text }, 460, measure );
		expect( fit.overflow ).toBe( 0 );
		// Base + smallest + shrink is skipped; truncation is two binary searches.
		expect( measure.mock.calls.length ).toBeLessThan( 2 * 40 );
	} );
} );

describe( 'eligibility', () => {
	it( 'only lets unrotated, unskewed, top-left layers join', () => {
		expect( canJoin( { type: 'textbox' } ) ).toBe( true );
		expect( canJoin( { type: 'image', angle: 15 } ) ).toBe( false );
		expect( canJoin( { type: 'rect', skewX: 4 } ) ).toBe( false );
		expect( canJoin( { type: 'group' } ) ).toBe( false );
		expect( canJoin( { type: 'rect', isArtboard: true } ) ).toBe( false );
		expect( canJoin( { type: 'rect', originY: 'center' } ) ).toBe( false );
	} );

	it( 'only lets wrapping text without per-character sizes shrink', () => {
		expect( canFlex( { type: 'textbox', styles: {} } ) ).toBe( true );
		expect( canFlex( { type: 'i-text' } ) ).toBe( false );
		expect(
			canFlex( {
				type: 'textbox',
				styles: { 0: { 2: { fontSize: 30 } } },
			} )
		).toBe( false );
	} );
} );

describe( 'applyStackLayout', () => {
	/**
	 * A minimal stand-in for a Fabric object.
	 *
	 * @param {Object} props Initial props.
	 * @return {Object} Fake object.
	 */
	function fake( props ) {
		const obj = {
			...props,
			set( values ) {
				Object.assign( this, values );
			},
			initDimensions() {
				if ( this.text !== undefined ) {
					this.height =
						Math.max( 1, Math.ceil( this.text.length / 10 ) ) *
						this.fontSize;
				}
			},
			getScaledHeight() {
				return this.height * ( this.scaleY ?? 1 );
			},
			setCoords: vi.fn(),
		};
		obj.initDimensions();
		return obj;
	}

	it( 'positions members, truncates on request, and restores', () => {
		const artboard = fake( {
			isArtboard: true,
			top: 0,
			height: 600,
			sfStack: {
				top: 0,
				bottom: 0,
				rows: [
					{ id: 'img', gap: 0 },
					{ id: 'body', gap: 20 },
				],
			},
		} );
		const photo = fake( {
			id: 'photo',
			type: 'image',
			top: 0,
			height: 400,
			sfStackItem: { row: 'img', offset: 0 },
		} );
		const longText = 'y'.repeat( 300 );
		const content = fake( {
			id: 'content',
			type: 'textbox',
			top: 999,
			text: longText,
			fontSize: 40,
			styles: {},
			sfStackItem: {
				row: 'body',
				offset: 0,
				flex: true,
				fontSize: 40,
				minFontSize: 20,
			},
		} );
		const canvas = { getObjects: () => [ artboard, photo, content ] };

		const live = applyStackLayout( canvas );
		expect( content.top ).toBe( 420 );
		expect( content.fontSize ).toBe( 20 );
		expect( content.text ).toBe( longText );
		expect( live.overflow ).toBeGreaterThan( 0 );
		expect( content.setCoords ).toHaveBeenCalled();

		const exported = applyStackLayout( canvas, { truncate: true } );
		expect( content.text.endsWith( ELLIPSIS ) ).toBe( true );
		expect( exported.overflow ).toBe( 0 );

		exported.restore();
		expect( content.text ).toBe( longText );
		expect( content.fontSize ).toBe( 20 );
		expect( content.top ).toBe( 420 );
	} );

	it( 'does nothing without a stack', () => {
		const result = applyStackLayout( {
			getObjects: () => [ fake( { isArtboard: true, height: 100 } ) ],
		} );
		expect( result.overflow ).toBe( 0 );
		expect( result.limit ).toBeNull();
	} );
} );
