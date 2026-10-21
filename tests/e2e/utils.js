/**
 * Shared helpers for the SocialFrame E2E specs.
 */

/**
 * Delete every design and template, so each run starts from an empty list.
 *
 * @param {Object} requestUtils Playwright request utils.
 */
async function deleteAllDesigns( requestUtils ) {
	const designs = await requestUtils.rest( {
		path: '/socialframe/v1/designs',
		params: { type: 'any', per_page: 100 },
	} );

	for ( const { id } of designs ) {
		await requestUtils.rest( {
			path: `/socialframe/v1/designs/${ id }`,
			method: 'DELETE',
		} );
	}
}

/**
 * Run a function against the editor's canvas API in the page.
 *
 * @param {Object}                                 page Playwright page.
 * @param {(api: Object, arg: unknown) => unknown} fn   Receives the editor API; must be serialisable.
 * @param {unknown}                                arg  Argument.
 * @return {Promise<unknown>} Its result.
 */
function withApi( page, fn, arg ) {
	return page.evaluate(
		( [ source, value ] ) => {
			const el = document.querySelector( 'canvas.lower-canvas' );
			let f =
				el[
					Object.keys( el ).find( ( k ) =>
						k.startsWith( '__reactFiber' )
					)
				];
			while ( f ) {
				const v = f.memoizedProps?.value;
				if ( v && typeof v.toDataURL === 'function' ) {
					return new Function(
						'api',
						'arg',
						`return (${ source })( api, arg );`
					)( v, value );
				}
				f = f.return;
			}
			return null;
		},
		[ fn.toString(), arg ]
	);
}

module.exports = { deleteAllDesigns, withApi };
