import { __ } from '@wordpress/i18n';
import { useFabric } from '../../EditorApp';

const H_ALIGNMENTS = [
	{ id: 'left',    icon: '⇤', label: __( 'Align left',          'socialframe' ) },
	{ id: 'centerH', icon: '↔', label: __( 'Center horizontal',   'socialframe' ) },
	{ id: 'right',   icon: '⇥', label: __( 'Align right',         'socialframe' ) },
];

const V_ALIGNMENTS = [
	{ id: 'top',     icon: '⇡', label: __( 'Align top',           'socialframe' ) },
	{ id: 'centerV', icon: '↕', label: __( 'Center vertical',     'socialframe' ) },
	{ id: 'bottom',  icon: '⇣', label: __( 'Align bottom',        'socialframe' ) },
];

export function AlignmentSection() {
	const fabric = useFabric();

	return (
		<div className="socialframe-props__section">
			<p className="socialframe-props__section-title">{ __( 'Align to Canvas', 'socialframe' ) }</p>
			<div className="socialframe-props__align-grid">
				{ [ ...H_ALIGNMENTS, ...V_ALIGNMENTS ].map( ( { id, icon, label } ) => (
					<button
						key={ id }
						className="socialframe-props__toggle-btn socialframe-props__align-btn"
						title={ label }
						aria-label={ label }
						onClick={ () => fabric?.alignObject( id ) }
					>
						{ icon }
					</button>
				) ) }
			</div>
		</div>
	);
}
