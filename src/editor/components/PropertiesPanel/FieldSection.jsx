import { useState, useEffect } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { SelectControl, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';
import { Accordion } from './Accordion';
import {
	FIELD_SOURCES,
	FIELD_NAME_PATTERN,
	buildFieldName,
	parseFieldName,
	sourcesFor,
} from '../../utils/fieldSources';

/**
 * Template field picker for the selected text or image object.
 *
 * Fixed sources (post title, featured image…) apply as soon as they are
 * picked. Keyed sources (meta, taxonomy, custom name) wait for a key and
 * apply when the key field loses focus, so typing is one undo step.
 *
 * @param {Object}         props
 * @param {'text'|'image'} props.kind Kind of the selected object.
 */
export function FieldSection( { kind } ) {
	const { fieldName, objectId } = useSelect( ( select ) => ( {
		fieldName: select( STORE_KEY ).getSelectionProps()?.fieldName ?? '',
		objectId: select( STORE_KEY ).getSelectedObjectId(),
	} ) );
	const fabric = useFabric();

	const [ source, setSource ] = useState( '' );
	const [ key, setKey ] = useState( '' );

	// Re-read when the selection or its field changes, dropping any
	// half-picked source from the previous object.
	useEffect( () => {
		const parsed = parseFieldName( fieldName );
		setSource( parsed.source );
		setKey( parsed.key );
	}, [ fieldName, objectId ] );

	const def = FIELD_SOURCES.find( ( s ) => s.value === source );
	const candidate = buildFieldName( source, key );
	const isInvalid =
		'' !== key.trim() &&
		'' !== candidate &&
		! FIELD_NAME_PATTERN.test( candidate );

	const commit = ( nextSource, nextKey ) => {
		const name = buildFieldName( nextSource, nextKey );
		if ( name === fieldName ) {
			return;
		}
		if ( name && ! FIELD_NAME_PATTERN.test( name ) ) {
			return;
		}
		fabric?.updateSelected(
			{ fieldName: name },
			__( 'Template field', 'socialframe' )
		);
	};

	const onSourceChange = ( next ) => {
		setSource( next );
		const nextDef = FIELD_SOURCES.find( ( s ) => s.value === next );
		// A keyed source has nothing to apply until a key is typed; picking
		// None or a fixed source applies straight away.
		if ( ! nextDef || nextDef.name ) {
			setKey( '' );
			commit( next, '' );
		}
	};

	const options = [
		{ value: '', label: __( 'None', 'socialframe' ) },
		...sourcesFor( kind ).map( ( s ) => ( {
			value: s.value,
			label: s.label,
		} ) ),
	];

	return (
		<Accordion
			title={ __( 'Template field', 'socialframe' ) }
			defaultOpen={ !! fieldName }
		>
			<SelectControl
				label={ __( 'Fill from', 'socialframe' ) }
				value={ source }
				options={ options }
				onChange={ onSourceChange }
				help={
					kind === 'image'
						? __(
								'When this design is filled, this image is replaced and cropped to the same box.',
								'socialframe'
							)
						: __(
								'When this design is filled, this text is replaced.',
								'socialframe'
							)
				}
				__next40pxDefaultSize
				__nextHasNoMarginBottom
			/>
			{ def?.prefix !== undefined && (
				<TextControl
					label={ def.keyLabel }
					value={ key }
					onChange={ setKey }
					onBlur={ () => commit( source, key ) }
					onKeyDown={ ( e ) => {
						if ( e.key === 'Enter' ) {
							commit( source, key );
						}
					} }
					help={
						isInvalid
							? __(
									'Use letters, numbers, dots, dashes or underscores (up to 100).',
									'socialframe'
								)
							: undefined
					}
					__next40pxDefaultSize
					__nextHasNoMarginBottom
				/>
			) }
		</Accordion>
	);
}
