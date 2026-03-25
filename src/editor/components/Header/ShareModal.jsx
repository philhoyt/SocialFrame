import { useEffect, useRef, useState } from '@wordpress/element';
import { Modal, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import QRCode from 'qrcode';

export function ShareModal( { url, onClose } ) {
	const canvasRef              = useRef( null );
	const [ copied, setCopied ] = useState( false );

	useEffect( () => {
		if ( ! canvasRef.current || ! url ) return;
		QRCode.toCanvas( canvasRef.current, url, {
			width:           240,
			margin:          2,
			color: {
				dark:  '#000000',
				light: '#ffffff',
			},
		} );
	}, [ url ] );

	function handleCopy() {
		navigator.clipboard?.writeText( url ).then( () => {
			setCopied( true );
			setTimeout( () => setCopied( false ), 2000 );
		} );
	}

	return (
		<Modal
			title={ __( 'Share to Phone', 'socialframe' ) }
			onRequestClose={ onClose }
			className="socialframe-share-modal"
			size="small"
		>
			<p className="socialframe-share-modal__desc">
				{ __( 'Scan this QR code with your phone camera to download the image.', 'socialframe' ) }
			</p>

			<div className="socialframe-share-modal__qr">
				<canvas ref={ canvasRef } />
			</div>

			<div className="socialframe-share-modal__actions">
				<Button
					variant="secondary"
					onClick={ handleCopy }
					style={ { minWidth: 100 } }
				>
					{ copied ? __( 'Copied!', 'socialframe' ) : __( 'Copy Link', 'socialframe' ) }
				</Button>
				<Button
					variant="primary"
					href={ url }
					target="_blank"
					rel="noopener noreferrer"
				>
					{ __( 'Open Image', 'socialframe' ) }
				</Button>
			</div>
		</Modal>
	);
}
