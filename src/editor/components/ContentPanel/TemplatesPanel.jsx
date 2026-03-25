import { useState, useEffect } from '@wordpress/element';
import { Spinner, Modal, Button } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

import { useFabric } from '../../EditorApp';

export function TemplatesPanel() {
	const fabric = useFabric();
	const [ bundled, setBundled ] = useState( [] );
	const [ userMade, setUserMade ] = useState( [] );
	const [ loading, setLoading ] = useState( true );
	const [ pendingTemplate, setPendingTemplate ] = useState( null );

	useEffect( () => {
		apiFetch( { path: 'socialframe/v1/templates' } )
			.then( ( data ) => {
				setBundled( data.bundled ?? [] );
				setUserMade( data.userMade ?? [] );
			} )
			.catch( () => {} )
			.finally( () => setLoading( false ) );
	}, [] );

	const applyTemplate = ( template ) => {
		if ( ! fabric?.loadFromJSON ) {
			return;
		}
		try {
			const json =
				typeof template.fabricJson === 'string'
					? JSON.parse( template.fabricJson )
					: template.fabricJson;
			fabric.loadFromJSON( json );
		} catch ( e ) {
			// Invalid JSON — skip.
		}
	};

	const loadTemplate = ( template ) => {
		setPendingTemplate( template );
	};

	const confirmLoad = () => {
		applyTemplate( pendingTemplate );
		setPendingTemplate( null );
	};

	if ( loading ) {
		return (
			<div style={ { textAlign: 'center', padding: 24 } }>
				<Spinner />
			</div>
		);
	}

	const allTemplates = [ ...bundled, ...userMade ];

	if ( allTemplates.length === 0 ) {
		return (
			<div className="socialframe-panel">
				<p style={ { color: '#888', fontSize: 12 } }>
					{ __(
						'No templates yet. Save a design as a template to see it here.',
						'socialframe'
					) }
				</p>
			</div>
		);
	}

	return (
		<>
			{ pendingTemplate && (
				<Modal
					title={ __( 'Replace current design?', 'socialframe' ) }
					onRequestClose={ () => setPendingTemplate( null ) }
					size="small"
				>
					<p>
						{ __(
							'Loading this template will replace your current design. Any unsaved changes will be lost.',
							'socialframe'
						) }
					</p>
					<div style={ { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 } }>
						<Button
							variant="tertiary"
							onClick={ () => setPendingTemplate( null ) }
						>
							{ __( 'Cancel', 'socialframe' ) }
						</Button>
						<Button variant="primary" onClick={ confirmLoad }>
							{ __( 'Load Template', 'socialframe' ) }
						</Button>
					</div>
				</Modal>
			) }

			{ bundled.length > 0 && (
				<>
					<div
						className="socialframe-panel"
						style={ { paddingBottom: 0 } }
					>
						<p className="socialframe-panel__title">
							{ __( 'Starter Templates', 'socialframe' ) }
						</p>
					</div>
					<div className="socialframe-panel__template-grid">
						{ bundled.map( ( tpl ) => (
							<TemplateItem
								key={ tpl.id }
								template={ tpl }
								onSelect={ loadTemplate }
							/>
						) ) }
					</div>
				</>
			) }

			{ userMade.length > 0 && (
				<>
					<div
						className="socialframe-panel"
						style={ { paddingBottom: 0 } }
					>
						<p className="socialframe-panel__title">
							{ __( 'My Templates', 'socialframe' ) }
						</p>
					</div>
					<div className="socialframe-panel__template-grid">
						{ userMade.map( ( tpl ) => (
							<TemplateItem
								key={ tpl.id }
								template={ tpl }
								onSelect={ loadTemplate }
							/>
						) ) }
					</div>
				</>
			) }
		</>
	);
}

function TemplateItem( { template, onSelect } ) {
	return (
		<button
			className="socialframe-panel__template-item"
			onClick={ () => onSelect( template ) }
			title={ template.label }
			aria-label={ template.label }
		>
			{ template.thumbnailUrl ? (
				<img
					src={ template.thumbnailUrl }
					alt={ template.label }
					className="socialframe-panel__template-thumb"
					loading="lazy"
				/>
			) : (
				<div className="socialframe-panel__template-placeholder">
					{ template.label }
				</div>
			) }
		</button>
	);
}
