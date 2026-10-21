/**
 * Unit tests for the shared Fabric configuration.
 */
import { describe, it, expect } from 'vitest';
import * as fabric from 'fabric';
import { configureFabric } from '../configureFabric';

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
		} );

		expect( rect.toObject() ).toMatchObject( {
			id: 'artboard',
			isArtboard: true,
			fieldName: 'post.title',
			originX: 'left',
			originY: 'top',
		} );
	} );
} );
