import { useState } from '@wordpress/element';
import { useSelect, useDispatch } from '@wordpress/data';
import { Button, TextControl } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';
import { useAutoSave } from '../../hooks/useAutoSave';
import { exportDesign, saveAsTemplate } from '../../utils/exportHelpers';
import { ShareModal } from './ShareModal';

import './Header.css';

export function Header() {
	const dispatch = useDispatch( STORE_KEY );
	const { createSuccessNotice, createErrorNotice } =
		useDispatch( 'core/notices' );

	const [ shareUrl, setShareUrl ] = useState( null );

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
		zoom,
	} = useSelect( ( select ) => {
		const s = select( STORE_KEY );
		return {
			title: s.getDesignTitle(),
			format: s.getFormat(),
			isDirty: s.isDirty(),
			isSaving: s.isSaving(),
			canUndo: s.canUndo(),
			canRedo: s.canRedo(),
			undoLabel: s.getUndoLabel(),
			redoLabel: s.getRedoLabel(),
			designId: s.getDesignId(),
			zoom: s.getZoom(),
		};
	} );

	const fabric = useFabric();

	// Debounced auto-save.
	useAutoSave( fabric?.getJSON, designId );

	const handleSave = async () => {
		if ( ! fabric || ! designId ) {
			return;
		}
		dispatch.setSaving( true );
		try {
			await apiFetch( {
				path: `socialframe/v1/designs/${ designId }`,
				method: 'PUT',
				data: { title, fabricJson: JSON.stringify( fabric.getJSON() ) },
			} );
			dispatch.markClean();
		} catch ( e ) {
			// Errors surface via notices if needed.
		} finally {
			dispatch.setSaving( false );
		}
	};

	const handleExport = async () => {
		if ( ! fabric || ! designId ) {
			return;
		}
		dispatch.setSaving( true );
		try {
			const result = await exportDesign(
				fabric.toDataURL,
				designId,
				apiFetch
			);
			setShareUrl( result.url );
		} catch ( e ) {
			createErrorNotice(
				__( 'Export failed. Please try again.', 'socialframe' )
			);
		} finally {
			dispatch.setSaving( false );
		}
	};

	const handleSaveAsTemplate = async () => {
		if ( ! fabric ) {
			return;
		}
		dispatch.setSaving( true );
		try {
			await saveAsTemplate( {
				title,
				format,
				fabricJson: fabric.getJSON(),
				apiFetch,
			} );
			createSuccessNotice( __( 'Saved as template.', 'socialframe' ) );
		} catch ( e ) {
			createErrorNotice(
				__( 'Could not save template.', 'socialframe' )
			);
		} finally {
			dispatch.setSaving( false );
		}
	};

	const { adminUrl } = window.socialFrameConfig ?? {};

	return (
		<div className="socialframe-header">
			<a
				href={ adminUrl }
				className="socialframe-header__back"
				title={ __( 'All Designs', 'socialframe' ) }
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					width="20"
					height="20"
					aria-hidden="true"
					focusable="false"
				>
					<path
						d="M15.6 7l-1.4-1.4L8 12l6.2 6.4 1.4-1.4L10.8 12z"
						fill="currentColor"
					/>
				</svg>
			</a>
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
					label={
						undoLabel
							? `${ __( 'Undo', 'socialframe' ) } ${ undoLabel }`
							: __( 'Undo', 'socialframe' )
					}
					showTooltip
				>
					{ __( 'Undo', 'socialframe' ) }
				</Button>
				<Button
					variant="tertiary"
					disabled={ ! canRedo }
					onClick={ () => dispatch.redoAction() }
					label={
						redoLabel
							? `${ __( 'Redo', 'socialframe' ) } ${ redoLabel }`
							: __( 'Redo', 'socialframe' )
					}
					showTooltip
				>
					{ __( 'Redo', 'socialframe' ) }
				</Button>

				<div className="socialframe-header__zoom">
					<Button
						variant="tertiary"
						onClick={ () => fabric?.fitView?.() }
						label={ __( 'Fit to screen (Ctrl+0)', 'socialframe' ) }
						showTooltip
					>
						{ __( 'Fit', 'socialframe' ) }
					</Button>
					<Button
						variant="tertiary"
						onClick={ () => fabric?.zoomOut?.() }
						label={ __( 'Zoom out (Ctrl+−)', 'socialframe' ) }
						showTooltip
					>
						{ '−' }
					</Button>
					<span className="socialframe-header__zoom-pct">
						{ zoom }%
					</span>
					<Button
						variant="tertiary"
						onClick={ () => fabric?.zoomIn?.() }
						label={ __( 'Zoom in (Ctrl++)', 'socialframe' ) }
						showTooltip
					>
						{ '+' }
					</Button>
				</div>
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
					isBusy={ isSaving }
				>
					{ __( 'Export PNG', 'socialframe' ) }
				</Button>
			</div>

			{ shareUrl && (
				<ShareModal
					url={ shareUrl }
					onClose={ () => setShareUrl( null ) }
				/>
			) }
		</div>
	);
}
