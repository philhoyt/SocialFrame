/**
 * Fetch every page of a paginated SocialFrame REST collection.
 *
 * Collections return at most 100 items per page and report the page count in
 * the X-WP-TotalPages header (like core's REST collections), so this follows
 * pages until it has them all.
 *
 * @param {(options: Object) => Promise<Response>} apiFetch `@wordpress/api-fetch`.
 * @param {string}                                 path     Collection path, with or without a query string.
 * @return {Promise<Array>} Items from every page, in order.
 */
export async function fetchAllPages( apiFetch, path ) {
	const separator = path.includes( '?' ) ? '&' : '?';
	const items = [];
	let page = 1;
	let totalPages = 1;

	do {
		const response = await apiFetch( {
			path: `${ path }${ separator }per_page=100&page=${ page }`,
			parse: false,
		} );
		items.push( ...( await response.json() ) );
		totalPages =
			parseInt( response.headers.get( 'X-WP-TotalPages' ), 10 ) || 1;
		page++;
	} while ( page <= totalPages );

	return items;
}
