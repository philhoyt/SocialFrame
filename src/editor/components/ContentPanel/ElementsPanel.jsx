import { __ } from '@wordpress/i18n';
import { useFabric } from '../../EditorApp';

const SHAPES = [
	{ type: 'rect',         icon: '▭', label: __( 'Rectangle',         'socialframe' ) },
	{ type: 'rounded-rect', icon: '▢', label: __( 'Rounded Rect',      'socialframe' ) },
	{ type: 'circle',       icon: '●', label: __( 'Circle',            'socialframe' ) },
	{ type: 'triangle',     icon: '▲', label: __( 'Triangle',          'socialframe' ) },
	{ type: 'line',         icon: '—', label: __( 'Line',              'socialframe' ) },
];

export function ElementsPanel() {
	const fabric = useFabric();

	return (
		<div className="socialframe-panel">
			<p className="socialframe-panel__title">{ __( 'Shapes', 'socialframe' ) }</p>
			<div className="socialframe-panel__grid">
				{ SHAPES.map( ( { type, icon, label } ) => (
					<button
						key={ type }
						className="socialframe-panel__btn"
						onClick={ () => fabric?.addShape( type ) }
					>
						<span className="socialframe-panel__btn-icon" aria-hidden="true">{ icon }</span>
						{ label }
					</button>
				) ) }
			</div>
		</div>
	);
}
