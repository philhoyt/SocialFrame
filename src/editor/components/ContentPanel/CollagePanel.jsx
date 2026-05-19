import { __ } from '@wordpress/i18n';
import { useFabric } from '../../EditorApp';
import './CollagePanel.css';

const LayoutSplitH = () => (
	<svg
		width="48"
		height="48"
		viewBox="0 0 48 48"
		fill="none"
		aria-hidden="true"
	>
		<rect
			x="1"
			y="1"
			width="21"
			height="46"
			rx="2"
			fill="currentColor"
			opacity="0.3"
		/>
		<rect
			x="26"
			y="1"
			width="21"
			height="46"
			rx="2"
			fill="currentColor"
			opacity="0.6"
		/>
	</svg>
);

const LayoutSplitV = () => (
	<svg
		width="48"
		height="48"
		viewBox="0 0 48 48"
		fill="none"
		aria-hidden="true"
	>
		<rect
			x="1"
			y="1"
			width="46"
			height="21"
			rx="2"
			fill="currentColor"
			opacity="0.3"
		/>
		<rect
			x="1"
			y="26"
			width="46"
			height="21"
			rx="2"
			fill="currentColor"
			opacity="0.6"
		/>
	</svg>
);

const LayoutBigLeft = () => (
	<svg
		width="48"
		height="48"
		viewBox="0 0 48 48"
		fill="none"
		aria-hidden="true"
	>
		<rect
			x="1"
			y="1"
			width="21"
			height="46"
			rx="2"
			fill="currentColor"
			opacity="0.6"
		/>
		<rect
			x="26"
			y="1"
			width="21"
			height="21"
			rx="2"
			fill="currentColor"
			opacity="0.3"
		/>
		<rect
			x="26"
			y="26"
			width="21"
			height="21"
			rx="2"
			fill="currentColor"
			opacity="0.45"
		/>
	</svg>
);

const LayoutBigRight = () => (
	<svg
		width="48"
		height="48"
		viewBox="0 0 48 48"
		fill="none"
		aria-hidden="true"
	>
		<rect
			x="1"
			y="1"
			width="21"
			height="21"
			rx="2"
			fill="currentColor"
			opacity="0.3"
		/>
		<rect
			x="1"
			y="26"
			width="21"
			height="21"
			rx="2"
			fill="currentColor"
			opacity="0.45"
		/>
		<rect
			x="26"
			y="1"
			width="21"
			height="46"
			rx="2"
			fill="currentColor"
			opacity="0.6"
		/>
	</svg>
);

const LayoutThirds = () => (
	<svg
		width="48"
		height="48"
		viewBox="0 0 48 48"
		fill="none"
		aria-hidden="true"
	>
		<rect
			x="1"
			y="1"
			width="13"
			height="46"
			rx="2"
			fill="currentColor"
			opacity="0.3"
		/>
		<rect
			x="18"
			y="1"
			width="12"
			height="46"
			rx="2"
			fill="currentColor"
			opacity="0.45"
		/>
		<rect
			x="34"
			y="1"
			width="13"
			height="46"
			rx="2"
			fill="currentColor"
			opacity="0.6"
		/>
	</svg>
);

const LAYOUTS = [
	{
		key: 'split-h',
		icon: <LayoutSplitH />,
		label: __( '50 / 50 Horizontal', 'socialframe' ),
	},
	{
		key: 'split-v',
		icon: <LayoutSplitV />,
		label: __( '50 / 50 Vertical', 'socialframe' ),
	},
	{
		key: 'big-left',
		icon: <LayoutBigLeft />,
		label: __( 'Big Left', 'socialframe' ),
	},
	{
		key: 'big-right',
		icon: <LayoutBigRight />,
		label: __( 'Big Right', 'socialframe' ),
	},
	{
		key: 'thirds',
		icon: <LayoutThirds />,
		label: __( '3 Columns', 'socialframe' ),
	},
];

export function CollagePanel() {
	const fabric = useFabric();

	return (
		<div className="socialframe-panel">
			<p className="socialframe-panel__title">
				{ __( 'Collage Layouts', 'socialframe' ) }
			</p>
			<p className="socialframe-collage-panel__hint">
				{ __(
					'Click a layout to insert zones. Then click each zone to fill it with a photo.',
					'socialframe'
				) }
			</p>
			<div className="socialframe-panel__grid socialframe-collage-panel__grid">
				{ LAYOUTS.map( ( { key, icon, label } ) => (
					<button
						key={ key }
						className="socialframe-panel__btn socialframe-collage-panel__btn"
						onClick={ () => fabric?.addCollageLayout( key ) }
						aria-label={ label }
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
		</div>
	);
}
