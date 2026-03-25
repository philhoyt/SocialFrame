import { useState, useRef } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';

export function LayersPanel() {
	const layers          = useSelect( ( select ) => select( STORE_KEY ).getLayers() );
	const selectedId      = useSelect( ( select ) => select( STORE_KEY ).getSelectedObjectId() );
	const selectionType   = useSelect( ( select ) => select( STORE_KEY ).getSelectionType() );
	const fabric          = useFabric();
	const [ editingId, setEditingId ] = useState( null );
	const [ editName, setEditName ]   = useState( '' );
	const [ expandedGroups, setExpandedGroups ] = useState( {} );
	const committingRef = useRef( false );

	function startRename( layer ) {
		setEditingId( layer.id );
		setEditName( layer.name );
		committingRef.current = false;
	}

	function commitRename( id ) {
		if ( committingRef.current ) return;
		committingRef.current = true;
		const name = editName.trim();
		if ( name ) fabric.renameById( id, name );
		setEditingId( null );
	}

	function handleRenameKey( e, id ) {
		if ( e.key === 'Enter' || e.key === 'Escape' ) {
			e.preventDefault();
			e.stopPropagation();
			committingRef.current = true;
			if ( e.key === 'Enter' ) {
				const name = editName.trim();
				if ( name ) fabric.renameById( id, name );
			}
			setEditingId( null );
			e.target.blur();
		}
	}

	function toggleGroup( id ) {
		setExpandedGroups( ( prev ) => ( { ...prev, [ id ]: ! prev[ id ] } ) );
	}

	function renderLayerRow( layer, isChild = false ) {
		const isGroup    = layer.type === 'group';
		const isExpanded = expandedGroups[ layer.id ] ?? true;

		return (
			<li
				key={ layer.id }
				className={ [
					'socialframe-layers__item',
					selectedId === layer.id ? 'is-selected' : '',
					layer.locked  ? 'is-locked' : '',
					! layer.visible ? 'is-hidden' : '',
					isChild ? 'is-child' : '',
				].filter( Boolean ).join( ' ' ) }
				onClick={ () => fabric.selectById( layer.id ) }
			>
				{ isGroup && (
					<button
						className={ `socialframe-layers__group-toggle${ isExpanded ? ' is-open' : '' }` }
						onClick={ ( e ) => { e.stopPropagation(); toggleGroup( layer.id ); } }
						aria-label={ isExpanded ? __( 'Collapse group', 'socialframe' ) : __( 'Expand group', 'socialframe' ) }
					>
						<svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true">
							<path d="M1 2l3 4 3-4z"/>
						</svg>
					</button>
				) }
				{ ! isGroup && ! isChild && <span className="socialframe-layers__group-toggle-spacer" /> }

				<span className="socialframe-layers__type-icon" aria-hidden="true">
					{ typeIcon( layer.type ) }
				</span>

				{ editingId !== null && editingId === layer.id ? (
					<input
						className="socialframe-layers__rename-input"
						value={ editName }
						autoFocus
						onChange={ ( e ) => setEditName( e.target.value ) }
						onBlur={ () => commitRename( layer.id ) }
						onKeyDown={ ( e ) => handleRenameKey( e, layer.id ) }
						onClick={ ( e ) => e.stopPropagation() }
					/>
				) : (
					<span
						className="socialframe-layers__name"
						onDoubleClick={ ( e ) => { e.stopPropagation(); startRename( layer ); } }
						title={ __( 'Double-click to rename', 'socialframe' ) }
					>
						{ layer.name }
					</span>
				) }

				<span className="socialframe-layers__state-btns" onClick={ ( e ) => e.stopPropagation() }>
					<button
						className={ `socialframe-layers__state-btn${ layer.locked ? ' is-active' : '' }` }
						title={ layer.locked ? __( 'Unlock', 'socialframe' ) : __( 'Lock', 'socialframe' ) }
						onClick={ () => fabric.setLayerLocked( layer.id, ! layer.locked ) }
					>{ layer.locked ? '🔒' : '🔓' }</button>
					<button
						className={ `socialframe-layers__state-btn${ ! layer.visible ? ' is-active' : '' }` }
						title={ layer.visible ? __( 'Hide', 'socialframe' ) : __( 'Show', 'socialframe' ) }
						onClick={ () => fabric.setLayerVisible( layer.id, ! layer.visible ) }
					>{ layer.visible ? '👁' : '🚫' }</button>
				</span>

				<span className="socialframe-layers__actions" onClick={ ( e ) => e.stopPropagation() }>
					{ isGroup ? (
						<button
							className="socialframe-layers__action-btn"
							title={ __( 'Ungroup', 'socialframe' ) }
							onClick={ () => { fabric.selectById( layer.id ); fabric.ungroupSelected(); } }
						>⊠</button>
					) : (
						<>
							<button
								className="socialframe-layers__action-btn"
								title={ __( 'Move up', 'socialframe' ) }
								onClick={ () => fabric.moveLayerUp( layer.id ) }
							>↑</button>
							<button
								className="socialframe-layers__action-btn"
								title={ __( 'Move down', 'socialframe' ) }
								onClick={ () => fabric.moveLayerDown( layer.id ) }
							>↓</button>
							<button
								className="socialframe-layers__action-btn"
								title={ __( 'Duplicate', 'socialframe' ) }
								onClick={ () => fabric.duplicateById( layer.id ) }
							>⧉</button>
						</>
					) }
					{ ! isChild && (
						<button
							className="socialframe-layers__action-btn socialframe-layers__action-btn--delete"
							title={ __( 'Delete', 'socialframe' ) }
							onClick={ () => fabric.deleteById( layer.id ) }
						>✕</button>
					) }
				</span>
			</li>
		);
	}

	if ( ! layers || layers.length === 0 ) {
		return (
			<div className="socialframe-panel">
				<p className="socialframe-panel__title">{ __( 'Layers', 'socialframe' ) }</p>
				{ selectionType === 'multi' && (
					<button
						className="socialframe-panel__btn"
						style={ { marginBottom: 8 } }
						onClick={ () => fabric.groupSelected() }
					>
						{ __( 'Group selected', 'socialframe' ) }
					</button>
				) }
				<p className="socialframe-layers__empty">{ __( 'No layers yet.', 'socialframe' ) }</p>
			</div>
		);
	}

	return (
		<div className="socialframe-panel">
			<div className="socialframe-layers__header">
				<p className="socialframe-panel__title" style={ { margin: 0 } }>{ __( 'Layers', 'socialframe' ) }</p>
				{ selectionType === 'multi' && (
					<button
						className="socialframe-layers__group-btn"
						onClick={ () => fabric.groupSelected() }
						title={ __( 'Group selected (Ctrl+G)', 'socialframe' ) }
					>
						{ __( 'Group', 'socialframe' ) }
					</button>
				) }
			</div>
			<ul className="socialframe-layers__list">
				{ layers.map( ( layer ) => (
					<>
						{ renderLayerRow( layer ) }
						{ layer.type === 'group' && ( expandedGroups[ layer.id ] ?? true ) && layer.children?.length > 0 && (
							<ul className="socialframe-layers__children" key={ `${ layer.id }-children` }>
								{ layer.children.map( ( child ) => renderLayerRow( child, true ) ) }
							</ul>
						) }
					</>
				) ) }
			</ul>
		</div>
	);
}

function typeIcon( type ) {
	switch ( type ) {
		case 'text':  return 'T';
		case 'image': return '🖼';
		case 'group': return '⊞';
		default:      return '◻';
	}
}
