import { __ } from '@wordpress/i18n';
import { useFabric } from '../../EditorApp';

const IconAlignLeft = () => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 16 16"
		fill="currentColor"
		aria-hidden="true"
	>
		<rect x="1" y="1" width="1.5" height="14" rx="0.75" />
		<rect x="3.5" y="2.5" width="11" height="2.5" rx="1" />
		<rect x="3.5" y="6.75" width="7" height="2.5" rx="1" />
		<rect x="3.5" y="11" width="9" height="2.5" rx="1" />
	</svg>
);

const IconAlignCenterH = () => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 16 16"
		fill="currentColor"
		aria-hidden="true"
	>
		<rect x="7.25" y="1" width="1.5" height="14" rx="0.75" />
		<rect x="2" y="2.5" width="12" height="2.5" rx="1" />
		<rect x="4" y="6.75" width="8" height="2.5" rx="1" />
		<rect x="3" y="11" width="10" height="2.5" rx="1" />
	</svg>
);

const IconAlignRight = () => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 16 16"
		fill="currentColor"
		aria-hidden="true"
	>
		<rect x="13.5" y="1" width="1.5" height="14" rx="0.75" />
		<rect x="1.5" y="2.5" width="11" height="2.5" rx="1" />
		<rect x="5.5" y="6.75" width="7" height="2.5" rx="1" />
		<rect x="3.5" y="11" width="9" height="2.5" rx="1" />
	</svg>
);

const IconAlignTop = () => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 16 16"
		fill="currentColor"
		aria-hidden="true"
	>
		<rect x="1" y="1" width="14" height="1.5" rx="0.75" />
		<rect x="2.5" y="3.5" width="2.5" height="11" rx="1" />
		<rect x="6.75" y="3.5" width="2.5" height="7" rx="1" />
		<rect x="11" y="3.5" width="2.5" height="9" rx="1" />
	</svg>
);

const IconAlignCenterV = () => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 16 16"
		fill="currentColor"
		aria-hidden="true"
	>
		<rect x="1" y="7.25" width="14" height="1.5" rx="0.75" />
		<rect x="2.5" y="2" width="2.5" height="12" rx="1" />
		<rect x="6.75" y="4" width="2.5" height="8" rx="1" />
		<rect x="11" y="3" width="2.5" height="10" rx="1" />
	</svg>
);

const IconAlignBottom = () => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 16 16"
		fill="currentColor"
		aria-hidden="true"
	>
		<rect x="1" y="13.5" width="14" height="1.5" rx="0.75" />
		<rect x="2.5" y="1.5" width="2.5" height="11" rx="1" />
		<rect x="6.75" y="5.5" width="2.5" height="7" rx="1" />
		<rect x="11" y="3.5" width="2.5" height="9" rx="1" />
	</svg>
);

const ALIGNMENTS = [
	{
		id: 'left',
		icon: <IconAlignLeft />,
		label: __( 'Align left', 'socialframe' ),
	},
	{
		id: 'centerH',
		icon: <IconAlignCenterH />,
		label: __( 'Center horizontal', 'socialframe' ),
	},
	{
		id: 'right',
		icon: <IconAlignRight />,
		label: __( 'Align right', 'socialframe' ),
	},
	{
		id: 'top',
		icon: <IconAlignTop />,
		label: __( 'Align top', 'socialframe' ),
	},
	{
		id: 'centerV',
		icon: <IconAlignCenterV />,
		label: __( 'Center vertical', 'socialframe' ),
	},
	{
		id: 'bottom',
		icon: <IconAlignBottom />,
		label: __( 'Align bottom', 'socialframe' ),
	},
];

export function AlignmentSection() {
	const fabric = useFabric();

	return (
		<div className="socialframe-props__align-grid">
			{ ALIGNMENTS.map( ( { id, icon, label } ) => (
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
	);
}
