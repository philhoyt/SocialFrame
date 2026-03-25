/**
 * Helper to run a canvas export through the REST endpoint.
 *
 * @param {Function} toDataURL Canvas toDataURL function.
 * @param {number}   designId  Design post ID.
 * @param {Function} apiFetch  @wordpress/api-fetch.
 * @return {Promise<{attachmentId, url, libraryUrl}>}
 */
export async function exportDesign( toDataURL, designId, apiFetch ) {
	const imageData = toDataURL();
	if ( ! imageData ) {
		throw new Error( 'Canvas produced no image data.' );
	}

	return apiFetch( {
		path: `socialframe/v1/designs/${ designId }/export`,
		method: 'POST',
		data: { imageData },
	} );
}

/**
 * Helper to save current canvas as a template.
 *
 * @param {Object}   options
 * @param {string}   options.title      Template title.
 * @param {string}   options.format     Format key.
 * @param {Object}   options.fabricJson Fabric JSON object.
 * @param {Function} options.apiFetch   @wordpress/api-fetch.
 * @return {Promise<Object>} New template post data.
 */
export async function saveAsTemplate( {
	title,
	format,
	fabricJson,
	apiFetch,
} ) {
	return apiFetch( {
		path: 'socialframe/v1/designs',
		method: 'POST',
		data: {
			title: title + ' Template',
			format,
			type: 'template',
			fabricJson: JSON.stringify( fabricJson ),
		},
	} );
}
