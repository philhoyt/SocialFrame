import { describe, it, expect } from 'vitest';

import {
	FIELD_ITEMS,
	FIELD_SOURCES,
	FIELD_NAME_PATTERN,
	buildFieldName,
	canvasHasFields,
	imageFieldPlaceholder,
	parseFieldName,
	sourcesFor,
} from '../fieldSources';

describe( 'fieldSources', () => {
	it( 'round-trips every fixed source', () => {
		FIELD_SOURCES.filter( ( s ) => s.name ).forEach( ( s ) => {
			const parsed = parseFieldName( s.name );
			expect( parsed ).toEqual( { source: s.value, key: '' } );
			expect( buildFieldName( parsed.source, parsed.key ) ).toBe(
				s.name
			);
		} );
	} );

	it.each( [
		[ 'meta.price', 'meta', 'price' ],
		[ 'terms.category', 'terms', 'category' ],
		[ 'headline', 'custom', 'headline' ],
		[ 'post.unknown', 'custom', 'post.unknown' ],
	] )( 'round-trips %s', ( name, source, key ) => {
		expect( parseFieldName( name ) ).toEqual( { source, key } );
		expect( buildFieldName( source, key ) ).toBe( name );
	} );

	it( 'treats empty names and keys as no field', () => {
		expect( parseFieldName( '' ) ).toEqual( { source: '', key: '' } );
		expect( parseFieldName( undefined ) ).toEqual( {
			source: '',
			key: '',
		} );
		expect( buildFieldName( '' ) ).toBe( '' );
		expect( buildFieldName( 'meta', '  ' ) ).toBe( '' );
		expect( buildFieldName( 'custom', ' x ' ) ).toBe( 'x' );
	} );

	it( 'offers only sources that fit the object', () => {
		const image = sourcesFor( 'image' ).map( ( s ) => s.value );
		expect( image ).toEqual( [ 'post.featured_image', 'meta', 'custom' ] );
		expect( sourcesFor( 'text' ).map( ( s ) => s.value ) ).not.toContain(
			'post.featured_image'
		);
	} );

	it( 'matches the server name rule', () => {
		expect( FIELD_NAME_PATTERN.test( 'meta.my-key_1' ) ).toBe( true );
		expect( FIELD_NAME_PATTERN.test( 'has space' ) ).toBe( false );
		expect( FIELD_NAME_PATTERN.test( 'x'.repeat( 101 ) ) ).toBe( false );
	} );

	it( 'detects fields, including inside groups, and ignores shapes', () => {
		expect( canvasHasFields( null ) ).toBe( false );
		expect(
			canvasHasFields( {
				objects: [ { type: 'Rect', fieldName: 'post.title' } ],
			} )
		).toBe( false );
		expect(
			canvasHasFields( {
				objects: [
					{
						type: 'Group',
						objects: [ { type: 'Image', fieldName: 'logo' } ],
					},
				],
			} )
		).toBe( true );
	} );

	it( 'offers the core post fields as one-click items', () => {
		expect( FIELD_ITEMS.map( ( i ) => i.name ) ).toEqual( [
			'post.title',
			'post.excerpt',
			'post.content',
			'post.date',
			'post.author',
			'post.featured_image',
		] );
	} );

	it.each( FIELD_ITEMS.map( ( i ) => [ i.name, i ] ) )(
		'binds the %s item to a fixed source of its kind',
		( name, item ) => {
			const { source, key } = parseFieldName( name );
			expect( key ).toBe( '' );
			expect( sourcesFor( item.kind ).map( ( s ) => s.value ) ).toContain(
				source
			);
			expect( item.label ).toBeTruthy();
		}
	);

	it( 'gives every text item placeholder text and a size', () => {
		FIELD_ITEMS.filter( ( i ) => i.kind === 'text' ).forEach( ( i ) => {
			expect( i.text ).toBeTruthy();
			expect( i.role ).toBeTruthy();
		} );
	} );

	it( 'builds a 4:3 SVG placeholder for image fields', () => {
		const url = imageFieldPlaceholder();
		expect( url.startsWith( 'data:image/svg+xml' ) ).toBe( true );
		const svg = decodeURIComponent( url.slice( url.indexOf( ',' ) + 1 ) );
		expect( svg ).toContain( 'width="800"' );
		expect( svg ).toContain( 'height="600"' );
	} );
} );
