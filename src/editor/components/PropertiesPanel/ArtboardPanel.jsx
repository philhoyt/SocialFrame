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

	const [ fitMode,    setFitMode    ] = useState( 'cover' );
	const [ hasBgImage, setHasBgImage ] = useState( false );
	const [ bgSrc,      setBgSrc      ] = useState( '' );

	// Initialise from the canvas when the panel first mounts (e.g. loading an existing design).
	useEffect( () => {
		const canvas = fabric?.getFabric?.();
		if ( canvas?.backgroundImage ) {
			setHasBgImage( true );
			const src = canvas.backgroundImage.getSrc?.();
			if ( src ) setBgSrc( src );
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
		</div>
	);
}
