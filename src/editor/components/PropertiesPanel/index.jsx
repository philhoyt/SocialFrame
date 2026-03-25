import { useSelect } from '@wordpress/data';
import { STORE_KEY } from '../../store';
import { ArtboardPanel } from './ArtboardPanel';
import { TextProperties } from './TextProperties';
import { ImageProperties } from './ImageProperties';
import { ShapeProperties } from './ShapeProperties';
import './PropertiesPanel.css';

export function PropertiesPanel() {
	const selectionType = useSelect( ( select ) =>
		select( STORE_KEY ).getSelectionType()
	);

	const Panel =
		{
			none: ArtboardPanel,
			text: TextProperties,
			image: ImageProperties,
			shape: ShapeProperties,
		}[ selectionType ] ?? ArtboardPanel;

	return (
		<div className="socialframe-editor__properties-panel">
			<Panel />
		</div>
	);
}
