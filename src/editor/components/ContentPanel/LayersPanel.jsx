import { useState } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';

export function LayersPanel() {
	const layers          = useSelect( ( select ) => select( STORE_KEY ).getLayers() );
	const selectedId      = useSelect( ( select ) => select( STORE_KEY ).getSelectedObjectId() );
	const fabric          = useFabric();
	const [ editingId, setEditingId ] = useState( null );
	const [ editName, setEditName ]   = useState( '' );

	function startRename( layer ) {
		setEditingId( layer.id );
		setEditName( layer.name );
	}

	function commitRename( id ) {
		const name = editName.trim();
		if ( name ) fabric.renameById( id, name );
		setEditingId( null );
	}

	function handleRenameKey( e, id ) {
		if ( e.key === 'Enter' )  commitRename( id );
		if ( e.key === 'Escape' ) setEditingId( null );
	}

	if ( ! layers || layers.length === 0 ) {
		return (
			<div className="socialframe-panel">
				<p className="socialframe-panel__title">{ __( 'Layers', 'socialframe' ) }</p>
				<p className="socialframe-layers__empty">{ __( 'No layers yet.', 'socialframe' ) }</p>
			</div>
		);
	}

	return (
		<div className="socialframe-panel">
			<p className="socialframe-panel__title">{ __( 'Layers', 'socialframe' ) }</p>
			<ul className="socialframe-layers__list">
				{ layers.map( ( layer ) => (
					<li
						key={ layer.id }
						className={ `socialframe-layers__item${ selectedId === layer.id ? ' is-selected' : '' }` }
						onClick={ () => fabric.selectById( layer.id ) }
					>
						<span className="socialframe-layers__type-icon" aria-hidden="true">
							{ typeIcon( layer.type ) }
						</span>

						{ editingId === layer.id ? (
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

						<span className="socialframe-layers__actions" onClick={ ( e ) => e.stopPropagation() }>
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
							<button
								className="socialframe-layers__action-btn socialframe-layers__action-btn--delete"
								title={ __( 'Delete', 'socialframe' ) }
								onClick={ () => fabric.deleteById( layer.id ) }
							>✕</button>
						</span>
					</li>
				) ) }
			</ul>
		</div>
	);
}

function typeIcon( type ) {
	switch ( type ) {
		case 'text':  return 'T';
		case 'image': return '🖼';
		default:      return '◻';
	}
}
