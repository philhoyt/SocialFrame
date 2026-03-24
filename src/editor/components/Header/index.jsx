import { useSelect, useDispatch } from '@wordpress/data';
import { Button, TextControl } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import { createSuccessNotice, createErrorNotice } from '@wordpress/notices';
import { __ } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';
import { useAutoSave } from '../../hooks/useAutoSave';
import { exportDesign, saveAsTemplate } from '../../utils/exportHelpers';

import './Header.css';

export function Header() {
	const dispatch = useDispatch( STORE_KEY );

	const {
		title,
		format,
		isDirty,
		isSaving,
		canUndo,
		canRedo,
		undoLabel,
		redoLabel,
		designId,
	} = useSelect( ( select ) => {
		const s = select( STORE_KEY );
		return {
			title:     s.getDesignTitle(),
			format:    s.getFormat(),
			isDirty:   s.isDirty(),
			isSaving:  s.isSaving(),
			canUndo:   s.canUndo(),
			canRedo:   s.canRedo(),
			undoLabel: s.getUndoLabel(),
			redoLabel: s.getRedoLabel(),
			designId:  s.getDesignId(),
		};
	} );

	const fabric = useFabric();

	// Debounced auto-save.
	useAutoSave( fabric?.getJSON, designId );

	const handleSave = async () => {
		if ( ! fabric || ! designId ) return;
		dispatch.setSaving( true );
		try {
			await apiFetch( {
				path:   `socialframe/v1/designs/${ designId }`,
				method: 'PUT',
				data:   { title, fabricJson: JSON.stringify( fabric.getJSON() ) },
			} );
			dispatch.markClean();
		} catch ( e ) {
			// Errors surface via notices if needed.
		} finally {
			dispatch.setSaving( false );
		}
	};

	const handleExport = async () => {
		if ( ! fabric || ! designId ) return;
		dispatch.setSaving( true );
		try {
			const result = await exportDesign( fabric.toDataURL, designId, apiFetch );
			dispatch( createSuccessNotice(
				__( 'Design exported successfully.', 'socialframe' ),
				{
					actions: [
						{ label: __( 'Download', 'socialframe' ), url: result.url },
						{ label: __( 'View in Library', 'socialframe' ), url: result.libraryUrl },
					],
				}
			) );
		} catch ( e ) {
			dispatch( createErrorNotice( __( 'Export failed. Please try again.', 'socialframe' ) ) );
		} finally {
			dispatch.setSaving( false );
		}
	};

	const handleSaveAsTemplate = async () => {
		if ( ! fabric ) return;
		dispatch.setSaving( true );
		try {
			await saveAsTemplate( {
				title,
				format,
				fabricJson: fabric.getJSON(),
				apiFetch,
			} );
			dispatch( createSuccessNotice( __( 'Saved as template.', 'socialframe' ) ) );
		} catch ( e ) {
			dispatch( createErrorNotice( __( 'Could not save template.', 'socialframe' ) ) );
		} finally {
			dispatch.setSaving( false );
		}
	};

	return (
		<div className="socialframe-header">
			<div className="socialframe-header__left">
				<TextControl
					value={ title }
					onChange={ ( v ) => dispatch.setTitle( v ) }
					className="socialframe-header__title"
					label=""
					hideLabelFromVision
					placeholder={ __( 'Untitled', 'socialframe' ) }
				/>
				<span className="socialframe-header__format">{ format }</span>
			</div>

			<div className="socialframe-header__center">
				<Button
					variant="tertiary"
					disabled={ ! canUndo }
					onClick={ () => dispatch.undoAction() }
					label={ undoLabel
						? `${ __( 'Undo', 'socialframe' ) } ${ undoLabel }`
						: __( 'Undo', 'socialframe' ) }
					showTooltip
				>
					{ __( 'Undo', 'socialframe' ) }
				</Button>
				<Button
					variant="tertiary"
					disabled={ ! canRedo }
					onClick={ () => dispatch.redoAction() }
					label={ redoLabel
						? `${ __( 'Redo', 'socialframe' ) } ${ redoLabel }`
						: __( 'Redo', 'socialframe' ) }
					showTooltip
				>
					{ __( 'Redo', 'socialframe' ) }
				</Button>
			</div>

			<div className="socialframe-header__right">
				<Button
					variant="tertiary"
					onClick={ handleSaveAsTemplate }
					disabled={ isSaving }
				>
					{ __( 'Save as Template', 'socialframe' ) }
				</Button>
				<Button
					variant="secondary"
					onClick={ handleSave }
					disabled={ ! isDirty || isSaving }
					isBusy={ isSaving }
				>
					{ isSaving
						? __( 'Saving…', 'socialframe' )
						: __( 'Save', 'socialframe' ) }
				</Button>
				<Button
					variant="primary"
					onClick={ handleExport }
					disabled={ isSaving }
				>
					{ __( 'Export PNG', 'socialframe' ) }
				</Button>
			</div>
		</div>
	);
}
