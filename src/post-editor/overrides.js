/**
 * Field values the post editor sends in place of the saved post's.
 *
 * Only title, excerpt and featured image are taken from unsaved edits; the
 * rest comes from the saved post on the server. An empty excerpt is left out
 * so the server still derives one from the content, and a removed featured
 * image is left out so the design keeps its placeholder.
 *
 * @param {Object}   edited            Edited post attributes.
 * @param {string}   edited.title      Edited title.
 * @param {string}   edited.excerpt    Edited excerpt.
 * @param {number}   edited.featuredId Edited featured image ID, 0 for none.
 * @param {string[]} fieldNames        Field names the design uses.
 * @return {Object} Values keyed by field name.
 */
export function buildOverrides( { title, excerpt, featuredId }, fieldNames ) {
	const values = {};

	if ( fieldNames.includes( 'post.title' ) && typeof title === 'string' ) {
		values[ 'post.title' ] = title;
	}
	if ( fieldNames.includes( 'post.excerpt' ) && excerpt?.trim() ) {
		values[ 'post.excerpt' ] = excerpt;
	}
	if ( fieldNames.includes( 'post.featured_image' ) && featuredId > 0 ) {
		values[ 'post.featured_image' ] = featuredId;
	}

	return values;
}
