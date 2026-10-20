import { describe, it, expect, vi } from 'vitest';

vi.mock( '../../EditorApp', () => ( { useFabric: () => null } ) );

const { serializeSave } = await import( '../useAutoSave' );

describe( 'serializeSave', () => {
	it( 'runs saves one at a time, in request order', async () => {
		const events = [];
		const slow = () =>
			new Promise( ( resolve ) =>
				setTimeout( () => {
					events.push( 'slow done' );
					resolve( 'slow' );
				}, 20 )
			);
		const fast = async () => {
			events.push( 'fast start' );
			return 'fast';
		};

		const results = await Promise.all( [
			serializeSave( slow ),
			serializeSave( fast ),
		] );

		expect( events ).toEqual( [ 'slow done', 'fast start' ] );
		expect( results ).toEqual( [ 'slow', 'fast' ] );
	} );

	it( 'keeps going after a failed save', async () => {
		const failed = serializeSave( async () => {
			throw new Error( 'boom' );
		} );
		const next = serializeSave( async () => 'ok' );

		await expect( failed ).rejects.toThrow( 'boom' );
		await expect( next ).resolves.toBe( 'ok' );
	} );
} );
