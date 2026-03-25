import { __ } from '@wordpress/i18n';
import { useFabric } from '../../EditorApp';

const TEXT_ROLES = [
	{ role: 'huge',        label: __( 'Huge',        'socialframe' ), style: { fontSize: 28, fontWeight: 'bold' } },
	{ role: 'extra-large', label: __( 'Extra Large', 'socialframe' ), style: { fontSize: 22 } },
	{ role: 'large',       label: __( 'Large',       'socialframe' ), style: { fontSize: 17 } },
	{ role: 'medium',      label: __( 'Medium',      'socialframe' ), style: { fontSize: 13 } },
	{ role: 'small',       label: __( 'Small',       'socialframe' ), style: { fontSize: 11 } },
];

export function TextPanel() {
	const fabric = useFabric();

	return (
		<div className="socialframe-panel">
			<p className="socialframe-panel__title">{ __( 'Add Text', 'socialframe' ) }</p>
			<div style={ { display: 'flex', flexDirection: 'column', gap: 8 } }>
				{ TEXT_ROLES.map( ( { role, label, style } ) => (
					<button
						key={ role }
						className="socialframe-panel__btn"
						style={ { justifyContent: 'flex-start', padding: '10px 12px' } }
						onClick={ () => fabric?.addText( role ) }
					>
						<span style={ style }>{ label }</span>
					</button>
				) ) }
			</div>
		</div>
	);
}
