import { useState, useEffect } from '@wordpress/element';
import { Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

import { useFabric } from '../../EditorApp';

export function TemplatesPanel() {
	const fabric = useFabric();
	const [ bundled, setBundled ]   = useState( [] );
	const [ userMade, setUserMade ] = useState( [] );
	const [ loading, setLoading ]   = useState( true );

	useEffect( () => {
		apiFetch( { path: 'socialframe/v1/templates' } )
			.then( ( data ) => {
				setBundled( data.bundled ?? [] );
				setUserMade( data.userMade ?? [] );
			} )
			.catch( () => {} )
			.finally( () => setLoading( false ) );
	}, [] );

	const loadTemplate = ( template ) => {
		if ( ! fabric?.loadFromJSON ) return;
		try {
			const json = typeof template.fabricJson === 'string'
				? JSON.parse( template.fabricJson )
				: template.fabricJson;
			fabric.loadFromJSON( json );
		} catch ( e ) {
			// Invalid JSON — skip.
		}
	};

	if ( loading ) {
		return (
			<div style={ { textAlign: 'center', padding: 24 } }><Spinner /></div>
		);
	}

	const allTemplates = [ ...bundled, ...userMade ];

	if ( allTemplates.length === 0 ) {
		return (
			<div className="socialframe-panel">
				<p style={ { color: '#888', fontSize: 12 } }>
					{ __( 'No templates yet. Save a design as a template to see it here.', 'socialframe' ) }
				</p>
			</div>
		);
	}

	return (
		<>
			{ bundled.length > 0 && (
				<>
					<div className="socialframe-panel" style={ { paddingBottom: 0 } }>
						<p className="socialframe-panel__title">{ __( 'Starter Templates', 'socialframe' ) }</p>
					</div>
					<div className="socialframe-panel__template-grid">
						{ bundled.map( ( tpl ) => (
							<TemplateItem key={ tpl.id } template={ tpl } onSelect={ loadTemplate } />
						) ) }
					</div>
				</>
			) }

			{ userMade.length > 0 && (
				<>
					<div className="socialframe-panel" style={ { paddingBottom: 0 } }>
						<p className="socialframe-panel__title">{ __( 'My Templates', 'socialframe' ) }</p>
					</div>
					<div className="socialframe-panel__template-grid">
						{ userMade.map( ( tpl ) => (
							<TemplateItem key={ tpl.id } template={ tpl } onSelect={ loadTemplate } />
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
