import { useState, useEffect } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import { useFabric } from '../../EditorApp';
import { Accordion } from './Accordion';
import { ColorRow } from './ColorRow';

const FIT_MODES = [
	{ value: 'cover', label: __( 'Cover', 'socialframe' ) },
	{ value: 'contain', label: __( 'Contain', 'socialframe' ) },
	{ value: 'fill', label: __( 'Fill', 'socialframe' ) },
	{ value: 'none', label: __( 'None', 'socialframe' ) },
];

export function ArtboardPanel() {
	const fabric = useFabric();

	const [ bgColor, setBgColor ] = useState( null );
	const [ fitMode, setFitMode ] = useState( 'cover' );
	const [ hasBgImage, setHasBgImage ] = useState( false );
	const [ snapEnabled, setSnapEnabled ] = useState( false );
	const [ gridSize, setGridSize ] = useState( 20 );

	// Read current canvas state on mount so UI reflects reality after remounts.
	useEffect( () => {
		const artboard = fabric
			?.getFabric?.()
			?.getObjects()
			.find( ( o ) => o.isArtboard );
		if ( artboard && typeof artboard.fill === 'string' ) {
			setBgColor( artboard.fill );
		}
		const src = fabric?.getBackgroundImageSrc?.();
		if ( src ) {
			setHasBgImage( true );
		}

		const snap = fabric?.getSnapToGrid?.();
		if ( snap ) {
			setSnapEnabled( snap.enabled );
			setGridSize( snap.size );
		}
	}, [] ); // eslint-disable-line react-hooks/exhaustive-deps

	const handleSetBackground = ( color ) => {
		fabric?.setBackground( color );
		setBgColor( color );
	};

	const openImagePicker = () => {
		if ( ! window.wp?.media ) {
			return;
		}
		const frame = window.wp.media( {
			title: __( 'Choose Background Image', 'socialframe' ),
			button: { text: __( 'Set Background', 'socialframe' ) },
			multiple: false,
			library: { type: 'image' },
		} );
		frame.on( 'select', () => {
			const attachment = frame
				.state()
				.get( 'selection' )
				.first()
				.toJSON();
			fabric?.setBackgroundImage( attachment.url, fitMode );
			setHasBgImage( true );
		} );
		frame.open();
	};

	const handleFitModeChange = ( newMode ) => {
		setFitMode( newMode );
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
	};

	return (
		<div className="socialframe-props">
			<Accordion title={ __( 'Fill', 'socialframe' ) }>
				<ColorRow value={ bgColor } onChange={ handleSetBackground } />
			</Accordion>

			<Accordion
				title={ __( 'Background Image', 'socialframe' ) }
				defaultOpen={ false }
			>
				<div className="socialframe-props__subsection-label">
					{ __( 'Fit', 'socialframe' ) }
				</div>
				<div
					className="socialframe-props__button-group"
					style={ { flexWrap: 'wrap', marginBottom: 10 } }
				>
					{ FIT_MODES.map( ( { value, label } ) => (
						<button
							key={ value }
							className={ `socialframe-props__toggle-btn${
								fitMode === value
									? ' socialframe-props__toggle-btn--active'
									: ''
							}` }
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
						style={ {
							width: '100%',
							justifyContent: 'center',
							marginTop: 6,
						} }
					>
						{ __( 'Remove Image', 'socialframe' ) }
					</Button>
				) }
			</Accordion>

			<Accordion
				title={ __( 'Grid', 'socialframe' ) }
				defaultOpen={ false }
			>
				<button
					className={ `socialframe-props__toggle-btn${
						snapEnabled
							? ' socialframe-props__toggle-btn--active'
							: ''
					}` }
					style={ { width: '100%' } }
					onClick={ handleSnapToggle }
				>
					{ snapEnabled
						? __( 'Snap to Grid: On', 'socialframe' )
						: __( 'Snap to Grid: Off', 'socialframe' ) }
				</button>
				{ snapEnabled && (
					<div
						className="socialframe-props__button-group"
						style={ { marginTop: 8 } }
					>
						{ [ 10, 20, 40 ].map( ( size ) => (
							<button
								key={ size }
								className={ `socialframe-props__toggle-btn${
									gridSize === size
										? ' socialframe-props__toggle-btn--active'
										: ''
								}` }
								style={ { flex: 1 } }
								onClick={ () => handleGridSizeChange( size ) }
							>
								{ size }px
							</button>
						) ) }
					</div>
				) }
			</Accordion>
		</div>
	);
}
