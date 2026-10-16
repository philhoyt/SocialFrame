import { __ } from '@wordpress/i18n';

/**
 * Where a template field's value comes from when a design is filled from a
 * post. Names mirror PostSource::values_for() on the server.
 *
 * - `name`     Full field name for a fixed source, e.g. `post.title`.
 * - `prefix`   Prefix for a keyed source; the user supplies the key.
 * - `kinds`    Object kinds the source can fill: 'text', 'image' or both.
 */
export const FIELD_SOURCES = [
	{
		value: 'post.title',
		name: 'post.title',
		label: __( 'Post title', 'socialframe' ),
		kinds: [ 'text' ],
	},
	{
		value: 'post.excerpt',
		name: 'post.excerpt',
		label: __( 'Post excerpt', 'socialframe' ),
		kinds: [ 'text' ],
	},
	{
		value: 'post.content',
		name: 'post.content',
		label: __( 'Post content', 'socialframe' ),
		kinds: [ 'text' ],
	},
	{
		value: 'post.date',
		name: 'post.date',
		label: __( 'Post date', 'socialframe' ),
		kinds: [ 'text' ],
	},
	{
		value: 'post.author',
		name: 'post.author',
		label: __( 'Post author', 'socialframe' ),
		kinds: [ 'text' ],
	},
	{
		value: 'post.featured_image',
		name: 'post.featured_image',
		label: __( 'Featured image', 'socialframe' ),
		kinds: [ 'image' ],
	},
	{
		value: 'meta',
		prefix: 'meta.',
		label: __( 'Custom field (meta)…', 'socialframe' ),
		keyLabel: __( 'Meta key', 'socialframe' ),
		kinds: [ 'text', 'image' ],
	},
	{
		value: 'terms',
		prefix: 'terms.',
		label: __( 'Taxonomy terms…', 'socialframe' ),
		keyLabel: __( 'Taxonomy slug', 'socialframe' ),
		kinds: [ 'text' ],
	},
	{
		value: 'custom',
		prefix: '',
		label: __( 'Custom name…', 'socialframe' ),
		keyLabel: __( 'Field name', 'socialframe' ),
		kinds: [ 'text', 'image' ],
	},
];

/** Same rule as FieldFiller::NAME_PATTERN on the server. */
export const FIELD_NAME_PATTERN = /^[A-Za-z0-9_.\-]{1,100}$/;

/**
 * Sources that can fill an object of the given kind.
 *
 * @param {'text'|'image'} kind Object kind.
 * @return {Object[]} Matching sources.
 */
export function sourcesFor( kind ) {
	return FIELD_SOURCES.filter( ( s ) => s.kinds.includes( kind ) );
}

/**
 * Split a stored field name into its source and key.
 *
 * @param {string} fieldName Stored name, e.g. `meta.price`.
 * @return {{ source: string, key: string }} `source` is '' when there is no field.
 */
export function parseFieldName( fieldName ) {
	const name = ( fieldName ?? '' ).trim();
	if ( ! name ) {
		return { source: '', key: '' };
	}
	const fixed = FIELD_SOURCES.find( ( s ) => s.name === name );
	if ( fixed ) {
		return { source: fixed.value, key: '' };
	}
	const keyed = FIELD_SOURCES.find(
		( s ) => s.prefix && name.startsWith( s.prefix )
	);
	if ( keyed ) {
		return { source: keyed.value, key: name.slice( keyed.prefix.length ) };
	}
	return { source: 'custom', key: name };
}

/**
 * Build the stored field name from a source and key.
 *
 * @param {string} source Source value from FIELD_SOURCES, or '' for none.
 * @param {string} key    Key for keyed sources.
 * @return {string} Field name, or '' when there is no field.
 */
export function buildFieldName( source, key = '' ) {
	const def = FIELD_SOURCES.find( ( s ) => s.value === source );
	if ( ! def ) {
		return '';
	}
	if ( def.name ) {
		return def.name;
	}
	const trimmed = key.trim();
	return trimmed ? def.prefix + trimmed : '';
}
