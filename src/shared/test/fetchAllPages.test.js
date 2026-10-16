/**
 * Unit tests for fetchAllPages.
 */
import { describe, it, expect, vi } from 'vitest';
import { fetchAllPages } from '../fetchAllPages';

const pageResponse = ( items, totalPages ) => ( {
	json: () => Promise.resolve( items ),
	headers: {
		get: ( name ) =>
			name === 'X-WP-TotalPages' ? String( totalPages ) : null,
	},
} );

describe( 'fetchAllPages', () => {
	it( 'follows X-WP-TotalPages and concatenates every page', async () => {
		const apiFetch = vi
			.fn()
			.mockResolvedValueOnce( pageResponse( [ 1, 2 ], 3 ) )
			.mockResolvedValueOnce( pageResponse( [ 3 ], 3 ) )
			.mockResolvedValueOnce( pageResponse( [ 4 ], 3 ) );

		const items = await fetchAllPages( apiFetch, 'sf/v1/designs?type=x' );

		expect( items ).toEqual( [ 1, 2, 3, 4 ] );
		expect( apiFetch ).toHaveBeenCalledTimes( 3 );
		expect( apiFetch.mock.calls[ 2 ][ 0 ] ).toEqual( {
			path: 'sf/v1/designs?type=x&per_page=100&page=3',
			parse: false,
		} );
	} );

	it( 'stops after one page when the header is missing', async () => {
		const apiFetch = vi.fn().mockResolvedValue( {
			json: () => Promise.resolve( [ 'a' ] ),
			headers: { get: () => null },
		} );

		expect( await fetchAllPages( apiFetch, 'sf/v1/designs' ) ).toEqual( [
			'a',
		] );
		expect( apiFetch.mock.calls[ 0 ][ 0 ].path ).toBe(
			'sf/v1/designs?per_page=100&page=1'
		);
	} );
} );
