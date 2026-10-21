import { __ } from '@wordpress/i18n';
import { useFabric } from '../../EditorApp';
import { FIELD_ITEMS } from '../../utils/fieldSources';

const IconRect = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 20 20"
		fill="currentColor"
		aria-hidden="true"
	>
		<rect x="1" y="4" width="18" height="12" />
	</svg>
);
const IconRoundedRect = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 20 20"
		fill="currentColor"
		aria-hidden="true"
	>
		<rect x="1" y="4" width="18" height="12" rx="3" />
	</svg>
);
const IconSquircle = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 20 20"
		fill="currentColor"
		aria-hidden="true"
	>
		<rect x="1" y="1" width="18" height="18" rx="6" />
	</svg>
);
const IconCircle = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 20 20"
		fill="currentColor"
		aria-hidden="true"
	>
		<circle cx="10" cy="10" r="9" />
	</svg>
);
const IconTriangle = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 20 20"
		fill="currentColor"
		aria-hidden="true"
	>
		<polygon points="10,2 19,18 1,18" />
	</svg>
);
const IconDiamond = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 20 20"
		fill="currentColor"
		aria-hidden="true"
	>
		<polygon points="10,1 19,10 10,19 1,10" />
	</svg>
);
const IconStar = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 20 20"
		fill="currentColor"
		aria-hidden="true"
	>
		<polygon points="10,1 12.2,6.9 18.6,7.2 13.6,11.2 15.3,17.3 10,13.8 4.7,17.3 6.4,11.2 1.4,7.2 7.8,6.9" />
	</svg>
);
const IconHexagon = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 20 20"
		fill="currentColor"
		aria-hidden="true"
	>
		<polygon points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5" />
	</svg>
);
const IconPentagon = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 20 20"
		fill="currentColor"
		aria-hidden="true"
	>
		<polygon points="10,1 18.5,7.2 15.4,17.4 4.6,17.4 1.5,7.2" />
	</svg>
);
const IconArch = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 20 20"
		fill="currentColor"
		aria-hidden="true"
	>
		<path d="M 1 19 L 1 10 A 9 9 0 0 1 19 10 L 19 19 Z" />
	</svg>
);
const IconCross = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 20 20"
		fill="currentColor"
		aria-hidden="true"
	>
		<path d="M 7 1 L 13 1 L 13 7 L 19 7 L 19 13 L 13 13 L 13 19 L 7 19 L 7 13 L 1 13 L 1 7 L 7 7 Z" />
	</svg>
);
const IconArrow = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 20 20"
		fill="currentColor"
		aria-hidden="true"
	>
		<path d="M 1 8 L 12 8 L 12 4 L 19 10 L 12 16 L 12 12 L 1 12 Z" />
	</svg>
);
const IconLine = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 20 20"
		fill="currentColor"
		aria-hidden="true"
	>
		<rect x="1" y="9" width="18" height="2" />
	</svg>
);

const IconTextField = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 20 20"
		fill="currentColor"
		aria-hidden="true"
	>
		<path d="M 3 3 L 17 3 L 17 7 L 15 7 L 15 5 L 11 5 L 11 15 L 13 15 L 13 17 L 7 17 L 7 15 L 9 15 L 9 5 L 5 5 L 5 7 L 3 7 Z" />
	</svg>
);
const IconImageField = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 20 20"
		fill="currentColor"
		aria-hidden="true"
	>
		<path d="M 1 3 L 19 3 L 19 17 L 1 17 Z M 3 5 L 3 15 L 17 15 L 17 5 Z M 4 14 L 8 9 L 11 12 L 13 10 L 16 14 Z" />
		<circle cx="13" cy="7.5" r="1.5" />
	</svg>
);

const SHAPES = [
	{
		type: 'rect',
		icon: <IconRect />,
		label: __( 'Rectangle', 'socialframe' ),
	},
	{
		type: 'rounded-rect',
		icon: <IconRoundedRect />,
		label: __( 'Rounded Rect', 'socialframe' ),
	},
	{
		type: 'squircle',
		icon: <IconSquircle />,
		label: __( 'Squircle', 'socialframe' ),
	},
	{
		type: 'circle',
		icon: <IconCircle />,
		label: __( 'Circle', 'socialframe' ),
	},
	{
		type: 'triangle',
		icon: <IconTriangle />,
		label: __( 'Triangle', 'socialframe' ),
	},
	{
		type: 'diamond',
		icon: <IconDiamond />,
		label: __( 'Diamond', 'socialframe' ),
	},
	{ type: 'star', icon: <IconStar />, label: __( 'Star', 'socialframe' ) },
	{
		type: 'hexagon',
		icon: <IconHexagon />,
		label: __( 'Hexagon', 'socialframe' ),
	},
	{
		type: 'pentagon',
		icon: <IconPentagon />,
		label: __( 'Pentagon', 'socialframe' ),
	},
	{ type: 'arch', icon: <IconArch />, label: __( 'Arch', 'socialframe' ) },
	{ type: 'cross', icon: <IconCross />, label: __( 'Cross', 'socialframe' ) },
	{ type: 'arrow', icon: <IconArrow />, label: __( 'Arrow', 'socialframe' ) },
	{ type: 'line', icon: <IconLine />, label: __( 'Line', 'socialframe' ) },
];

export function ElementsPanel() {
	const fabric = useFabric();

	return (
		<div className="socialframe-panel">
			<p className="socialframe-panel__title">
				{ __( 'Shapes', 'socialframe' ) }
			</p>
			<div className="socialframe-panel__grid">
				{ SHAPES.map( ( { type, icon, label } ) => (
					<button
						key={ type }
						className="socialframe-panel__btn"
						onClick={ () => fabric?.addShape( type ) }
					>
						<span
							className="socialframe-panel__btn-icon"
							aria-hidden="true"
						>
							{ icon }
						</span>
						{ label }
					</button>
				) ) }
			</div>
			<p className="socialframe-panel__title socialframe-panel__title--section">
				{ __( 'Template fields', 'socialframe' ) }
			</p>
			<div className="socialframe-panel__grid">
				{ FIELD_ITEMS.map( ( item ) => (
					<button
						key={ item.name }
						className="socialframe-panel__btn"
						onClick={ () => fabric?.addField( item ) }
					>
						<span
							className="socialframe-panel__btn-icon"
							aria-hidden="true"
						>
							{ item.kind === 'image' ? (
								<IconImageField />
							) : (
								<IconTextField />
							) }
						</span>
						{ item.label }
					</button>
				) ) }
			</div>
		</div>
	);
}
