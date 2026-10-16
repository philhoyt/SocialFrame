import { describe, it, expect } from 'vitest';

import {
	FIELD_SOURCES,
	FIELD_NAME_PATTERN,
	buildFieldName,
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
} );
