/**
 * Unit tests for the shared Fabric configuration.
 */
import { describe, it, expect } from 'vitest';
import * as fabric from 'fabric';
import { configureFabric, imageRadii } from '../configureFabric';

describe( 'configureFabric', () => {
	configureFabric( fabric );

	it( 'gives new objects a top-left origin, as Fabric 6 did', () => {
		const rect = new fabric.Rect( {
			left: 0,
			top: 0,
			width: 100,
			height: 50,
		} );
		const text = new fabric.Textbox( 'Hi', { left: 10, top: 20 } );

		expect( [ rect.originX, rect.originY ] ).toEqual( [ 'left', 'top' ] );
		expect( [ text.originX, text.originY ] ).toEqual( [ 'left', 'top' ] );
		expect( rect.getBoundingRect().left ).toBe( 0 );
	} );

	it( 'keeps custom properties through toObject()', () => {
		const rect = new fabric.Rect( {
			width: 10,
			height: 10,
			id: 'artboard',
			isArtboard: true,
			fieldName: 'post.title',
			sfFrame: { direction: 'column', children: [ 'a' ] },
			sfItem: { width: 'fill', w: 10 },
		} );

		expect( rect.toObject() ).toMatchObject( {
			id: 'artboard',
			isArtboard: true,
			fieldName: 'post.title',
			sfFrame: { direction: 'column', children: [ 'a' ] },
			sfItem: { width: 'fill', w: 10 },
			originX: 'left',
			originY: 'top',
		} );
	} );

	it( 'keeps locks and image corner radius through toObject()', () => {
		const rect = new fabric.Rect( {
			selectable: false,
			evented: false,
			sfRadius: 12,
		} );
		expect( rect.toObject() ).toMatchObject( {
			selectable: false,
			evented: false,
			sfRadius: 12,
		} );
	} );
} );

describe( 'imageRadii', () => {
	it( 'converts canvas pixels to the image’s own units', () => {
		expect(
			imageRadii( {
				sfRadius: 12,
				width: 1200,
				height: 800,
				scaleX: 0.5,
				scaleY: 0.25,
			} )
		).toEqual( { rx: 24, ry: 48 } );
	} );

	it( 'stays at most half the shorter side, and is zero when unset', () => {
		expect(
			imageRadii( { sfRadius: 500, width: 100, height: 40 } )
		).toEqual( { rx: 20, ry: 20 } );
		expect( imageRadii( { width: 100, height: 40 } ) ).toEqual( {
			rx: 0,
			ry: 0,
		} );
		expect(
			imageRadii( { sfRadius: 'x', width: 100, height: 40 } )
		).toEqual( { rx: 0, ry: 0 } );
	} );
} );

describe( 'rounded image drawing', () => {
	configureFabric( fabric );

	/**
	 * A 2D context that records the calls made on it.
	 *
	 * @return {Object} Context with a `calls` list.
	 */
	const recorder = () => {
		const calls = [];
		return new Proxy(
			{ calls },
			{
				get: ( target, key ) =>
					key in target
						? target[ key ]
						: ( ...args ) => calls.push( [ key, ...args ] ),
				set: ( target, key, value ) => {
					calls.push( [ `=${ String( key ) }`, value ] );
					return true;
				},
			}
		);
	};
	const image = ( props ) => {
		const el = document.createElement( 'img' );
		Object.defineProperty( el, 'naturalWidth', { value: 200 } );
		Object.defineProperty( el, 'naturalHeight', { value: 100 } );
		return new fabric.FabricImage( el, {
			width: 200,
			height: 100,
			...props,
		} );
	};
	const names = ( ctx ) => ctx.calls.map( ( c ) => c[ 0 ] );

	it( 'clips the pixels to rounded corners', () => {
		const ctx = recorder();
		image( { sfRadius: 10 } )._render( ctx );
		const seq = names( ctx );
		expect( seq ).toContain( 'bezierCurveTo' );
		expect( seq.indexOf( 'clip' ) ).toBeLessThan(
			seq.indexOf( 'drawImage' )
		);
		expect( seq ).not.toContain( 'fill' );
	} );

	it( 'draws square images as before', () => {
		const ctx = recorder();
		image( {} )._render( ctx );
		expect( names( ctx ) ).not.toContain( 'clip' );
		expect( names( ctx ) ).toContain( 'drawImage' );
	} );

	it( 'casts a shadow from the rounded outline, not the clipped pixels', () => {
		const ctx = recorder();
		image( {
			sfRadius: 10,
			shadow: new fabric.Shadow( { blur: 8, color: '#000' } ),
		} )._render( ctx );
		const seq = names( ctx );
		expect( seq.indexOf( 'fill' ) ).toBeLessThan( seq.indexOf( 'clip' ) );
		expect( ctx.calls ).toContainEqual( [ '=shadowColor', 'transparent' ] );
	} );
} );
