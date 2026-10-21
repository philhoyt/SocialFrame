/**
 * Unit tests for the post editor's field overrides.
 */
import { describe, it, expect } from 'vitest';
import { buildOverrides } from '../overrides';

const ALL = [ 'post.title', 'post.excerpt', 'post.featured_image' ];

describe( 'buildOverrides', () => {
	it( 'sends edited title, excerpt and featured image', () => {
		expect(
			buildOverrides(
				{ title: 'New', excerpt: 'Short', featuredId: 12 },
				ALL
			)
		).toEqual( {
			'post.title': 'New',
			'post.excerpt': 'Short',
			'post.featured_image': 12,
		} );
	} );

	it( 'leaves out an empty excerpt and a removed featured image', () => {
		expect(
			buildOverrides(
				{ title: 'New', excerpt: '  ', featuredId: 0 },
				ALL
			)
		).toEqual( { 'post.title': 'New' } );
	} );

	it( 'sends an empty title, since the post really has none', () => {
		expect(
			buildOverrides( { title: '', excerpt: '', featuredId: 0 }, ALL )
		).toEqual( { 'post.title': '' } );
	} );

	it( 'only sends names the design uses', () => {
		expect(
			buildOverrides(
				{ title: 'New', excerpt: 'Short', featuredId: 12 },
				[ 'meta.price' ]
			)
		).toEqual( {} );
	} );
} );
