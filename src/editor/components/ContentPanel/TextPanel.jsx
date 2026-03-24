import { __ } from '@wordpress/i18n';
import { useFabric } from '../../EditorApp';

const TEXT_ROLES = [
	{ role: 'heading',    label: __( 'Heading',    'socialframe' ), style: { fontSize: 24, fontWeight: 'bold' } },
	{ role: 'subheading', label: __( 'Subheading', 'socialframe' ), style: { fontSize: 18 } },
	{ role: 'body',       label: __( 'Body',       'socialframe' ), style: { fontSize: 14 } },
	{ role: 'caption',    label: __( 'Caption',    'socialframe' ), style: { fontSize: 11 } },
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
