/**
 * Unit tests for the pure parts of the design renderer.
 */
import { describe, it, expect } from 'vitest';
import { collectFontDescriptors, prepareCanvas } from '../renderDesign';

describe( 'collectFontDescriptors', () => {
	it( 'collects each distinct font once, including text in groups', () => {
		const json = {
			objects: [
				{ type: 'Textbox', fontFamily: 'Inter', fontWeight: 700 },
				{ type: 'Rect', fontFamily: 'Ignored' },
				{
					type: 'Group',
					objects: [
						{
							type: 'IText',
							fontFamily: 'Lora',
							fontStyle: 'italic',
						},
						{
							type: 'Textbox',
							fontFamily: 'Inter',
							fontWeight: 700,
						},
					],
				},
			],
		};

		expect( collectFontDescriptors( json ) ).toEqual( [
			'normal 700 16px Inter',
			'italic normal 16px Lora',
		] );
	} );

	it( 'returns nothing for a canvas without text', () => {
		expect( collectFontDescriptors( { objects: [] } ) ).toEqual( [] );
		expect( collectFontDescriptors( null ) ).toEqual( [] );
	} );
} );

describe( 'prepareCanvas', () => {
	it( 'reads the artboard size and drops its shadow and the background', () => {
		const { json, width, height } = prepareCanvas( {
			background: '#000',
			objects: [
				{
					type: 'Rect',
					isArtboard: true,
					width: 540,
					height: 675,
					scaleX: 2,
					scaleY: 2,
					shadow: { blur: 24 },
				},
				{ type: 'Textbox', text: 'Hi', shadow: { blur: 2 } },
			],
		} );

		expect( [ width, height ] ).toEqual( [ 1080, 1350 ] );
		expect( json.background ).toBeUndefined();
		expect( json.objects[ 0 ].shadow ).toBeNull();
		expect( json.objects[ 1 ].shadow ).toEqual( { blur: 2 } );
	} );

	it( 'falls back to the given size when there is no artboard', () => {
		const { width, height } = prepareCanvas(
			{ objects: [ { type: 'Textbox', left: 50, top: 50 } ] },
			{ width: 1200, height: 630 }
		);

		expect( [ width, height ] ).toEqual( [ 1200, 630 ] );
	} );

	it( 'detects an unmarked artboard by its geometry', () => {
		const { width } = prepareCanvas( {
			objects: [
				{ type: 'rect', left: 0, top: 0, width: 1080, height: 1080 },
			],
		} );

		expect( width ).toBe( 1080 );
	} );
} );
