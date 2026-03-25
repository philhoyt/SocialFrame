import { useSelect, useDispatch } from '@wordpress/data';
import { Button, Tooltip } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import './IconNav.css';

const IconTemplates = () => (
	<svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
		<rect x="1" y="1" width="7" height="7" rx="1.5"/>
		<rect x="10" y="1" width="7" height="3" rx="1.5"/>
		<rect x="10" y="6" width="7" height="2" rx="1"/>
		<rect x="1" y="10" width="7" height="2" rx="1"/>
		<rect x="1" y="14" width="7" height="3" rx="1.5"/>
		<rect x="10" y="10" width="7" height="7" rx="1.5"/>
	</svg>
);

const IconText = () => (
	<svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
		<path d="M2 3h14v2.5H11v9.5H7V5.5H2V3z"/>
	</svg>
);

const IconElements = () => (
	<svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
		<rect x="1" y="1" width="7" height="7" rx="1.5"/>
		<circle cx="13.5" cy="4.5" r="3.5"/>
		<rect x="1" y="10" width="7" height="7" rx="3.5"/>
		<path d="M10 13.5 13.5 10 17 13.5 13.5 17z"/>
	</svg>
);

const IconMedia = () => (
	<svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
		<path d="M2 2h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm0 1.5v9.5l4-4.5 2.5 2.8 3-4 4.5 5.7V3.5H2z"/>
		<circle cx="12.5" cy="6" r="1.5"/>
	</svg>
);

const IconPosts = () => (
	<svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
		<rect x="2" y="1" width="14" height="16" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5"/>
		<rect x="5" y="5" width="8" height="1.5" rx="0.75"/>
		<rect x="5" y="8" width="8" height="1.5" rx="0.75"/>
		<rect x="5" y="11" width="5" height="1.5" rx="0.75"/>
	</svg>
);

const IconLayers = () => (
	<svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
		<path d="M9 1.5 17 6l-8 4.5L1 6z"/>
		<path d="M1 9.5 9 14l8-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
		<path d="M1 12.5 9 17l8-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
	</svg>
);

const PANELS = [
	{ id: 'templates', icon: <IconTemplates />, label: __( 'Templates', 'socialframe' ) },
	{ id: 'text',      icon: <IconText />,      label: __( 'Text',      'socialframe' ) },
	{ id: 'elements',  icon: <IconElements />,  label: __( 'Elements',  'socialframe' ) },
	{ id: 'media',     icon: <IconMedia />,     label: __( 'Media',     'socialframe' ) },
	{ id: 'posts',     icon: <IconPosts />,     label: __( 'Import Post', 'socialframe' ) },
	{ id: 'layers',    icon: <IconLayers />,    label: __( 'Layers',    'socialframe' ) },
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
						{ icon }
					</Button>
				</Tooltip>
			) ) }
		</nav>
	);
}
