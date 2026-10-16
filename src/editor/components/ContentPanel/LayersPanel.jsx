import { useState, useEffect, useRef } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';

export function LayersPanel() {
	const layers = useSelect( ( select ) => select( STORE_KEY ).getLayers() );
	const selectedId = useSelect( ( select ) =>
		select( STORE_KEY ).getSelectedObjectId()
	);
	const fabric = useFabric();
	const [ editingId, setEditingId ] = useState( null );
	const [ editName, setEditName ] = useState( '' );
	const committingRef = useRef( false );
	const renameInputRef = useRef( null );
	const nameButtonRefs = useRef( {} );
	const lastEditedRef = useRef( null );

	useEffect( () => {
		if ( editingId !== null ) {
			renameInputRef.current?.focus();
			renameInputRef.current?.select();
		} else if ( lastEditedRef.current !== null ) {
			// Return focus to the layer that was being renamed.
			nameButtonRefs.current[ lastEditedRef.current ]?.focus();
			lastEditedRef.current = null;
		}
	}, [ editingId ] );

	function startRename( layer ) {
		lastEditedRef.current = layer.id;
		setEditingId( layer.id );
		setEditName( layer.name );
		committingRef.current = false;
	}

	function commitRename( id ) {
		if ( committingRef.current ) {
			return;
		}
		committingRef.current = true;
		const name = editName.trim();
		if ( name ) {
			fabric.renameById( id, name );
		}
		setEditingId( null );
	}

	function handleRenameKey( e, id ) {
		if ( e.key === 'Enter' || e.key === 'Escape' ) {
			e.preventDefault();
			e.stopPropagation();
			committingRef.current = true;
			if ( e.key === 'Enter' ) {
				const name = editName.trim();
				if ( name ) {
					fabric.renameById( id, name );
				}
			}
			setEditingId( null );
			e.target.blur();
		}
	}

	if ( ! layers || layers.length === 0 ) {
		return (
			<div className="socialframe-panel">
				<p className="socialframe-panel__title">
					{ __( 'Layers', 'socialframe' ) }
				</p>
				<p className="socialframe-layers__empty">
					{ __( 'No layers yet.', 'socialframe' ) }
				</p>
			</div>
		);
	}

	return (
		<div className="socialframe-panel">
			<p className="socialframe-panel__title">
				{ __( 'Layers', 'socialframe' ) }
			</p>
			<ul className="socialframe-layers__list">
				{ layers.map( ( layer, index ) => (
					<li
						key={ layer.id ?? index }
						className={ `socialframe-layers__item${
							selectedId === layer.id ? ' is-selected' : ''
						}${ layer.locked ? ' is-locked' : '' }${
							! layer.visible ? ' is-hidden' : ''
						}` }
					>
						{ editingId !== null && editingId === layer.id ? (
							<input
								className="socialframe-layers__rename-input"
								ref={ renameInputRef }
								aria-label={ __( 'Layer name', 'socialframe' ) }
								value={ editName }
								onChange={ ( e ) =>
									setEditName( e.target.value )
								}
								onBlur={ () => commitRename( layer.id ) }
								onKeyDown={ ( e ) =>
									handleRenameKey( e, layer.id )
								}
							/>
						) : (
							<button
								ref={ ( el ) => {
									nameButtonRefs.current[ layer.id ] = el;
								} }
								className="socialframe-layers__select-btn"
								aria-current={
									selectedId === layer.id ? 'true' : undefined
								}
								onClick={ () => fabric.selectById( layer.id ) }
								onDoubleClick={ () => startRename( layer ) }
								onKeyDown={ ( e ) => {
									if ( e.key === 'F2' ) {
										e.preventDefault();
										startRename( layer );
									}
								} }
								title={ __(
									'Double-click or press F2 to rename',
									'socialframe'
								) }
							>
								<span
									className="socialframe-layers__type-icon"
									aria-hidden="true"
								>
									{ typeIcon( layer.type ) }
								</span>
								<span className="socialframe-layers__name">
									{ layer.name }
								</span>
							</button>
						) }

						<span className="socialframe-layers__state-btns">
							<button
								className={ `socialframe-layers__state-btn${
									layer.locked ? ' is-active' : ''
								}` }
								aria-label={ __( 'Lock', 'socialframe' ) }
								aria-pressed={ !! layer.locked }
								title={
									layer.locked
										? __( 'Unlock', 'socialframe' )
										: __( 'Lock', 'socialframe' )
								}
								onClick={ () =>
									fabric.setLayerLocked(
										layer.id,
										! layer.locked
									)
								}
							>
								<span aria-hidden="true">
									{ layer.locked ? '🔒' : '🔓' }
								</span>
							</button>
							<button
								className={ `socialframe-layers__state-btn${
									! layer.visible ? ' is-active' : ''
								}` }
								aria-label={ __( 'Hide', 'socialframe' ) }
								aria-pressed={ ! layer.visible }
								title={
									layer.visible
										? __( 'Hide', 'socialframe' )
										: __( 'Show', 'socialframe' )
								}
								onClick={ () =>
									fabric.setLayerVisible(
										layer.id,
										! layer.visible
									)
								}
							>
								<span aria-hidden="true">
									{ layer.visible ? '👁' : '🚫' }
								</span>
							</button>
						</span>

						<span className="socialframe-layers__actions">
							{ [
								{
									label: __( 'Move up', 'socialframe' ),
									glyph: '↑',
									run: () => fabric.moveLayerUp( layer.id ),
								},
								{
									label: __( 'Move down', 'socialframe' ),
									glyph: '↓',
									run: () => fabric.moveLayerDown( layer.id ),
								},
								{
									label: __( 'Duplicate', 'socialframe' ),
									glyph: '⧉',
									run: () => fabric.duplicateById( layer.id ),
								},
								{
									label: __( 'Delete', 'socialframe' ),
									glyph: '✕',
									run: () => fabric.deleteById( layer.id ),
									modifier:
										' socialframe-layers__action-btn--delete',
								},
							].map( ( { label, glyph, run, modifier = '' } ) => (
								<button
									key={ label }
									className={ `socialframe-layers__action-btn${ modifier }` }
									aria-label={ `${ label }: ${ layer.name }` }
									title={ label }
									onClick={ run }
								>
									<span aria-hidden="true">{ glyph }</span>
								</button>
							) ) }
						</span>
					</li>
				) ) }
			</ul>
		</div>
	);
}

function typeIcon( type ) {
	switch ( type ) {
		case 'text':
			return 'T';
		case 'image':
			return '🖼';
		default:
			return '◻';
	}
}
