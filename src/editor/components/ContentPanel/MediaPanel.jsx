import { useState, useEffect } from '@wordpress/element';
import { Button, Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

import { useFabric } from '../../EditorApp';

export function MediaPanel() {
	const fabric = useFabric();
	const [ images, setImages ] = useState( [] );
	const [ loading, setLoading ] = useState( true );

	useEffect( () => {
		apiFetch( {
			path: '/wp/v2/media?media_type=image&per_page=12&orderby=date&order=desc',
		} )
			.then( ( items ) => setImages( items ) )
			.catch( () => {} )
			.finally( () => setLoading( false ) );
	}, [] );

	const openMediaModal = () => {
		if ( ! window.wp?.media ) {
			return;
		}

		const frame = window.wp.media( {
			title: __( 'Select Image', 'socialframe' ),
			button: { text: __( 'Insert Image', 'socialframe' ) },
			multiple: false,
			library: { type: 'image' },
		} );

		frame.on( 'select', () => {
			const attachment = frame
				.state()
				.get( 'selection' )
				.first()
				.toJSON();
			fabric?.addImage( attachment.url );
		} );

		frame.open();
	};

	const insertImage = ( url ) => {
		fabric?.addImage( url );
	};

	return (
		<div className="socialframe-panel">
			<p className="socialframe-panel__title">
				{ __( 'Media', 'socialframe' ) }
			</p>

			<div style={ { padding: '0 0 12px' } }>
				<Button
					variant="secondary"
					onClick={ openMediaModal }
					style={ { width: '100%', justifyContent: 'center' } }
				>
					{ __( 'Browse Media Library', 'socialframe' ) }
				</Button>
			</div>

			<p className="socialframe-panel__title">
				{ __( 'Recent', 'socialframe' ) }
			</p>

			{ loading ? (
				<div style={ { textAlign: 'center', padding: 16 } }>
					<Spinner />
				</div>
			) : (
				<div className="socialframe-panel__media-grid">
					{ images.map( ( img ) => (
						<button
							key={ img.id }
							className="socialframe-panel__media-item"
							onClick={ () => insertImage( img.source_url ) }
							aria-label={ img.alt_text || img.title?.rendered }
						>
							<img
								src={
									img.media_details?.sizes?.thumbnail
										?.source_url ?? img.source_url
								}
								alt={ img.alt_text || '' }
								loading="lazy"
							/>
						</button>
					) ) }
				</div>
			) }
		</div>
	);
}
