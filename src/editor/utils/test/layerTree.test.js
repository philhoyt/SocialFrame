/**
 * Unit tests for the Layers panel tree.
 */
import { describe, it, expect } from 'vitest';
import {
	buildRows,
	visibleRows,
	rootsOf,
	rangeOf,
	resolveDrop,
} from '../layerTree';

const frame = ( children, props = {} ) => ( {
	direction: 'column',
	children,
	...props,
} );

// Bottom first, as on the canvas.
const OBJECTS = [
	{
		id: 'artboard',
		isArtboard: true,
		type: 'rect',
		sfFrame: frame( [ 'photo', 'row' ] ),
	},
	{ id: 'photo', type: 'image', name: 'Photo' },
	{
		id: 'row',
		type: 'rect',
		name: 'Row',
		sfFrame: frame( [ 'badge', 'area' ] ),
	},
	{ id: 'badge', type: 'rect', name: 'Badge', sfFrame: frame( [ 'grade' ] ) },
	{ id: 'grade', type: 'textbox', name: 'Grade' },
	{ id: 'area', type: 'textbox', name: 'Area' },
	{ id: 'logo', type: 'image', name: 'Logo', selectable: false },
];

const rows = buildRows( OBJECTS );
const ids = ( list ) => list.map( ( r ) => r.id );

describe( 'buildRows', () => {
	it( 'lists top layers first, frames with their layers, and the artboard last', () => {
		expect( ids( rows ) ).toEqual( [
			'logo',
			'row',
			'badge',
			'grade',
			'area',
			'photo',
			'artboard',
		] );
		const by = Object.fromEntries( rows.map( ( r ) => [ r.id, r ] ) );
		expect( by.grade ).toMatchObject( {
			depth: 2,
			parentId: 'badge',
			index: 0,
		} );
		expect( by.area ).toMatchObject( {
			depth: 1,
			parentId: 'row',
			index: 1,
		} );
		expect( by.row ).toMatchObject( {
			depth: 0,
			isFrame: true,
			childCount: 2,
			inLayout: true,
		} );
		expect( by.photo.inLayout ).toBe( true );
		expect( by.logo ).toMatchObject( { inLayout: false, locked: true } );
		expect( by.artboard ).toMatchObject( {
			kind: 'artboard',
			hasLayout: true,
		} );
	} );

	it( 'hides the layers of collapsed frames, however deep', () => {
		expect( ids( visibleRows( rows, new Set( [ 'row' ] ) ) ) ).toEqual( [
			'logo',
			'row',
			'photo',
			'artboard',
		] );
	} );
} );

describe( 'selection helpers', () => {
	it( 'keeps only top-most selected layers and never the artboard', () => {
		expect(
			rootsOf( rows, [ 'grade', 'row', 'logo', 'artboard' ] )
		).toEqual( [ 'logo', 'row' ] );
	} );

	it( 'selects a range in visible order', () => {
		expect( rangeOf( rows, 'area', 'row' ) ).toEqual( [
			'row',
			'badge',
			'grade',
			'area',
		] );
		expect( rangeOf( rows, 'photo', 'artboard' ) ).toEqual( [ 'photo' ] );
	} );
} );

describe( 'resolveDrop', () => {
	it( 'adds to the end of a frame when dropped inside its row', () => {
		expect( resolveDrop( rows, [ 'logo' ], 'row', 'inside' ) ).toEqual( {
			parentId: 'row',
			index: 2,
		} );
	} );

	it( 'places between a frame’s layers, counting without the dragged ones', () => {
		expect( resolveDrop( rows, [ 'area' ], 'badge', 'before' ) ).toEqual( {
			parentId: 'row',
			index: 0,
		} );
		expect(
			resolveDrop(
				rows,
				[ 'logo' ],
				'badge',
				'after',
				new Set( [ 'badge' ] )
			)
		).toEqual( {
			parentId: 'row',
			index: 1,
		} );
	} );

	it( 'drops after an open frame into its start', () => {
		expect( resolveDrop( rows, [ 'logo' ], 'row', 'after' ) ).toEqual( {
			parentId: 'row',
			index: 0,
		} );
		expect(
			resolveDrop(
				rows,
				[ 'logo' ],
				'row',
				'after',
				new Set( [ 'row' ] )
			)
		).toEqual( { after: 'row' } );
	} );

	it( 'places top-level layers in z-order and adds to the content layout', () => {
		expect( resolveDrop( rows, [ 'grade' ], 'logo', 'before' ) ).toEqual( {
			before: 'logo',
		} );
		expect( resolveDrop( rows, [ 'logo' ], 'photo', 'after' ) ).toEqual( {
			after: 'photo',
		} );
		expect( resolveDrop( rows, [ 'logo' ], 'artboard', 'inside' ) ).toEqual(
			{
				parentId: 'artboard',
				index: 2,
			}
		);
		expect( resolveDrop( rows, [ 'logo' ], 'artboard', 'before' ) ).toEqual(
			{
				edge: 'bottom',
			}
		);
	} );

	it( 'refuses drops into a dragged frame or its layers, and dragging the artboard', () => {
		expect( resolveDrop( rows, [ 'row' ], 'badge', 'inside' ) ).toBeNull();
		expect( resolveDrop( rows, [ 'row' ], 'grade', 'before' ) ).toBeNull();
		expect( resolveDrop( rows, [ 'row' ], 'row', 'inside' ) ).toBeNull();
		expect(
			resolveDrop( rows, [ 'artboard' ], 'logo', 'before' )
		).toBeNull();
		expect( resolveDrop( rows, [ 'logo' ], 'grade', 'inside' ) ).toBeNull();
	} );

	it( 'refuses the content layout when the artboard has none', () => {
		const plain = buildRows( [
			{ id: 'artboard', isArtboard: true, type: 'rect' },
			{ id: 'a', type: 'rect' },
		] );
		expect(
			resolveDrop( plain, [ 'a' ], 'artboard', 'inside' )
		).toBeNull();
	} );
} );
