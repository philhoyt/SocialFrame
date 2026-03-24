import { useSelect } from '@wordpress/data';

import { STORE_KEY } from '../../store';
import { TemplatesPanel } from './TemplatesPanel';
import { ElementsPanel } from './ElementsPanel';
import { TextPanel } from './TextPanel';
import { MediaPanel } from './MediaPanel';

import './ContentPanel.css';

const PANEL_MAP = {
	templates: TemplatesPanel,
	elements:  ElementsPanel,
	text:      TextPanel,
	media:     MediaPanel,
};

export function ContentPanel() {
	const activePanel = useSelect( ( select ) => select( STORE_KEY ).getActivePanel() );

	if ( ! activePanel ) return null;

	const Panel = PANEL_MAP[ activePanel ];
	if ( ! Panel ) return null;

	return (
		<div className="socialframe-editor__content-panel">
			<Panel />
		</div>
	);
}
