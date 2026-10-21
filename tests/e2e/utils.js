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

module.exports = { deleteAllDesigns };
