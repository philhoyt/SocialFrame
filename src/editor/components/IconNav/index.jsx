import { useSelect, useDispatch } from '@wordpress/data';
import { Button, Tooltip } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import './IconNav.css';

const PANELS = [
	{ id: 'templates', icon: '⊞', label: __( 'Templates', 'socialframe' ) },
	{ id: 'elements',  icon: '◻', label: __( 'Elements',  'socialframe' ) },
	{ id: 'text',      icon: 'T', label: __( 'Text',      'socialframe' ) },
	{ id: 'media',     icon: '🖼', label: __( 'Media',     'socialframe' ) },
	{ id: 'layers',    icon: '≡', label: __( 'Layers',    'socialframe' ) },
];

export function IconNav() {
	const activePanel = useSelect( ( select ) => select( STORE_KEY ).getActivePanel() );
	const dispatch    = useDispatch( STORE_KEY );

	return (
		<nav className="socialframe-editor__icon-nav" aria-label={ __( 'Editor panels', 'socialframe' ) }>
			{ PANELS.map( ( { id, icon, label } ) => (
				<Tooltip key={ id } text={ label } placement="right">
					<Button
						className={ `socialframe-icon-nav__btn${ activePanel === id ? ' is-active' : '' }` }
						onClick={ () => dispatch.setActivePanel( id ) }
						aria-pressed={ activePanel === id }
						aria-label={ label }
					>
						<span aria-hidden="true">{ icon }</span>
					</Button>
				</Tooltip>
			) ) }
		</nav>
	);
}
