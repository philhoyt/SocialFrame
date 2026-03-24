import { useState, useEffect } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import { useFabric } from '../../EditorApp';

const { themeColors } = window.socialFrameConfig ?? {};

const FIT_MODES = [
	{ value: 'cover',   label: __( 'Cover',   'socialframe' ) },
	{ value: 'contain', label: __( 'Contain', 'socialframe' ) },
	{ value: 'fill',    label: __( 'Fill',    'socialframe' ) },
	{ value: 'none',    label: __( 'None',    'socialframe' ) },
];

export function ArtboardPanel() {
	const fabric = useFabric();

	const [ fitMode,     setFitMode     ] = useState( 'cover' );
	const [ hasBgImage,  setHasBgImage  ] = useState( false );
	const [ bgSrc,       setBgSrc       ] = useState( '' );
	const [ snapEnabled, setSnapEnabled ] = useState( false );
	const [ gridSize,    setGridSize    ] = useState( 20 );

	// Initialise from the canvas when the panel first mounts (e.g. loading an existing design).
	useEffect( () => {
		const src = fabric?.getBackgroundImageSrc?.();
		if ( src ) {
			setHasBgImage( true );
			setBgSrc( src );
		}
	}, [] ); // eslint-disable-line react-hooks/exhaustive-deps

	const openImagePicker = () => {
		if ( ! window.wp?.media ) return;

		const frame = window.wp.media( {
			title:    __( 'Choose Background Image', 'socialframe' ),
			button:   { text: __( 'Set Background', 'socialframe' ) },
			multiple: false,
			library:  { type: 'image' },
		} );

		frame.on( 'select', () => {
			const attachment = frame.state().get( 'selection' ).first().toJSON();
			fabric?.setBackgroundImage( attachment.url, fitMode );
			setBgSrc( attachment.url );
			setHasBgImage( true );
		} );

		frame.open();
	};

	const handleFitModeChange = ( newMode ) => {
		setFitMode( newMode );
		// Re-apply immediately if a background image is already set.
		if ( hasBgImage ) {
			fabric?.updateBackgroundImageFit( newMode );
		}
	};

	const handleSnapToggle = () => {
		const next = ! snapEnabled;
		setSnapEnabled( next );
		fabric?.setSnapToGrid( next, gridSize );
	};

	const handleGridSizeChange = ( size ) => {
		setGridSize( size );
		if ( snapEnabled ) {
			fabric?.setSnapToGrid( true, size );
		}
	};

	const handleRemoveBgImage = () => {
		fabric?.clearBackgroundImage();
		setHasBgImage( false );
		setBgSrc( '' );
	};

	return (
		<div className="socialframe-props">
			<div className="socialframe-props__section">
				<p className="socialframe-props__section-title">{ __( 'Artboard', 'socialframe' ) }</p>

				<label className="socialframe-props__section-title">
					{ __( 'Background Color', 'socialframe' ) }
				</label>
				<div className="socialframe-color-row">
					{ ( themeColors ?? [] ).map( ( { color, name, slug } ) => (
						<button
							key={ slug }
							className="socialframe-color-swatch"
							style={ { background: color } }
							onClick={ () => fabric?.setBackground( color ) }
							title={ name }
							aria-label={ name }
						/>
					) ) }
				</div>
			</div>

			<div className="socialframe-props__section">
				<p className="socialframe-props__section-title">{ __( 'Background Image', 'socialframe' ) }</p>

				<p className="socialframe-props__section-title" style={ { marginBottom: 6 } }>
					{ __( 'Fit', 'socialframe' ) }
				</p>
				<div className="socialframe-props__button-group" style={ { flexWrap: 'wrap', gap: 4, marginBottom: 10 } }>
					{ FIT_MODES.map( ( { value, label } ) => (
						<button
							key={ value }
							className={ `socialframe-props__toggle-btn${ fitMode === value ? ' socialframe-props__toggle-btn--active' : '' }` }
							onClick={ () => handleFitModeChange( value ) }
						>
							{ label }
						</button>
					) ) }
				</div>

				<Button
					variant="secondary"
					onClick={ openImagePicker }
					style={ { width: '100%', justifyContent: 'center' } }
				>
					{ hasBgImage
						? __( 'Change Image', 'socialframe' )
						: __( 'Set Image', 'socialframe' ) }
				</Button>

				{ hasBgImage && (
					<Button
						variant="tertiary"
						isDestructive
						onClick={ handleRemoveBgImage }
						style={ { width: '100%', justifyContent: 'center', marginTop: 6 } }
					>
						{ __( 'Remove Image', 'socialframe' ) }
					</Button>
				) }
			</div>

			<div className="socialframe-props__section">
				<p className="socialframe-props__section-title">{ __( 'Grid', 'socialframe' ) }</p>
				<button
					className={ `socialframe-props__toggle-btn${ snapEnabled ? ' socialframe-props__toggle-btn--active' : '' }` }
					style={ { width: '100%' } }
					onClick={ handleSnapToggle }
				>
					{ snapEnabled
						? __( 'Snap to Grid: On', 'socialframe' )
						: __( 'Snap to Grid: Off', 'socialframe' ) }
				</button>

				{ snapEnabled && (
					<div className="socialframe-props__button-group" style={ { marginTop: 8 } }>
						{ [ 10, 20, 40 ].map( ( size ) => (
							<button
								key={ size }
								className={ `socialframe-props__toggle-btn${ gridSize === size ? ' socialframe-props__toggle-btn--active' : '' }` }
								style={ { flex: 1 } }
								onClick={ () => handleGridSizeChange( size ) }
							>
								{ size }px
							</button>
						) ) }
					</div>
				) }
			</div>
		</div>
	);
}
