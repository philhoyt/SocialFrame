import { __, sprintf } from '@wordpress/i18n';

/**
 * Helper to run a canvas export through the REST endpoint.
 *
 * @param {() => string}                         toDataURL Canvas toDataURL function.
 * @param {number}                               designId  Design post ID.
 * @param {(options: Object) => Promise<Object>} apiFetch  `@wordpress/api-fetch`.
 * @return {Promise<{attachmentId: number, url: string, libraryUrl: string}>} The uploaded attachment data.
 */
export async function exportDesign( toDataURL, designId, apiFetch ) {
	// Text is measured with its web font, not a fallback.
	await document.fonts?.ready;
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
 * Fire-and-forget helper to send a preview thumbnail to the server after save.
 *
 * Errors are intentionally swallowed — preview generation must not interrupt
 * the save flow or surface anything to the user.
 *
 * @param {() => string}                         toDataURL Canvas toDataURL function.
 * @param {number}                               designId  Design post ID.
 * @param {(options: Object) => Promise<Object>} apiFetch  `@wordpress/api-fetch`.
 * @return {Promise<void>} Resolves when the preview is sent (or silently on error).
 */
export async function sendPreview( toDataURL, designId, apiFetch ) {
	try {
		await document.fonts?.ready;
		const imageData = toDataURL();
		if ( ! imageData ) {
			return;
		}
		await apiFetch( {
			path: `socialframe/v1/designs/${ designId }/preview`,
			method: 'POST',
			data: { imageData },
		} );
	} catch {
		// Silent — preview failure must not affect the user experience.
	}
}

/**
 * Helper to save current canvas as a template.
 *
 * @param {Object}                               options
 * @param {string}                               options.title      Template title.
 * @param {string}                               options.format     Format key.
 * @param {Object}                               options.fabricJson Fabric JSON object.
 * @param {Object}                               [options.size]     Artboard { width, height }; stored for custom formats.
 * @param {(options: Object) => Promise<Object>} options.apiFetch   `@wordpress/api-fetch`.
 * @return {Promise<Object>} New template post data.
 */
export async function saveAsTemplate( {
	title,
	format,
	fabricJson,
	size,
	apiFetch,
} ) {
	return apiFetch( {
		path: 'socialframe/v1/designs',
		method: 'POST',
		data: {
			title: sprintf(
				/* translators: %s: design title */
				__( '%s Template', 'socialframe' ),
				title
			),
			format,
			type: 'template',
			fabricJson: JSON.stringify( fabricJson ),
			...( format === 'custom' && size
				? { width: size.width, height: size.height }
				: {} ),
		},
	} );
}
