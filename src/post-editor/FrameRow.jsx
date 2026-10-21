import { lazy, Suspense, useState } from '@wordpress/element';
import {
	Button,
	ExternalLink,
	__experimentalConfirmDialog as ConfirmDialog, // eslint-disable-line @wordpress/no-unsafe-wp-apis
} from '@wordpress/components';
import { useSelect, useDispatch } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';
import { store as noticesStore } from '@wordpress/notices';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';

import { buildOverrides } from './overrides';

// The QR code library loads only when someone shares an image.
const ShareModal = lazy( () =>
	import( /* webpackChunkName: "share-modal" */ '../shared/ShareModal' ).then(
		( m ) => ( { default: m.ShareModal } )
	)
);

/**
 * One assigned design: its current image and a Generate button.
 *
 * Generating asks the server for the filled canvas, renders it here, then
 * sends the PNG back; the server only writes once it has a valid image.
 *
 * @param {Object}     props           Component props.
 * @param {Object}     props.frame     Frame from GET /posts/:id/frames.
 * @param {number}     props.postId    Current post ID.
 * @param {() => void} props.onChanged Called after a successful generate.
 */
export function FrameRow( { frame, postId, onChanged } ) {
	const { design, fieldNames, output } = frame;
	const [ status, setStatus ] = useState( '' );
	const [ confirming, setConfirming ] = useState( false );
	const [ shareUrl, setShareUrl ] = useState( null );
	const busy = '' !== status;

	const edited = useSelect( ( select ) => {
		const { getEditedPostAttribute } = select( editorStore );
		return {
			title: getEditedPostAttribute( 'title' ),
			excerpt: getEditedPostAttribute( 'excerpt' ),
			featuredId: getEditedPostAttribute( 'featured_media' ),
		};
	}, [] );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );

	const generate = async () => {
		setConfirming( false );
		const values = buildOverrides( edited, fieldNames );
		const path = `socialframe/v1/designs/${ design.id }/generate`;

		try {
			setStatus( __( 'Filling the design…', 'socialframe' ) );
			const filled = await apiFetch( {
				path,
				method: 'POST',
				data: { post_id: postId, values },
			} );

			setStatus( __( 'Rendering the image…', 'socialframe' ) );
			const { renderDesign } = await import(
				/* webpackChunkName: "render-design" */ '../shared/renderDesign'
			);
			const imageData = await renderDesign( filled.fabricJson, {
				width: filled.width,
				height: filled.height,
			} );

			setStatus( __( 'Saving the image…', 'socialframe' ) );
			const saved = await apiFetch( {
				path,
				method: 'POST',
				data: { post_id: postId, values, imageData },
			} );

			createSuccessNotice(
				sprintf(
					/* translators: %s: design title. */
					__( '%s image generated.', 'socialframe' ),
					design.title
				),
				{ type: 'snackbar' }
			);
			onChanged();
			if ( saved?.imageUrl ) {
				setShareUrl( saved.imageUrl );
			}
		} catch ( error ) {
			createErrorNotice(
				'generating' === error?.code
					? __(
							'This image is already being generated. Try again in a moment.',
							'socialframe'
						)
					: error?.message ||
							__(
								'Could not generate the image.',
								'socialframe'
							),
				{ type: 'snackbar' }
			);
		} finally {
			setStatus( '' );
		}
	};

	const thumbnail = output?.imageUrl || design.thumbnailUrl;

	return (
		<div className="socialframe-frame">
			<div className="socialframe-frame__header">
				<strong className="socialframe-frame__title">
					{ design.title }
				</strong>
			</div>

			{ thumbnail && (
				<img
					className="socialframe-frame__image"
					src={ thumbnail }
					alt={
						output
							? sprintf(
									/* translators: %s: design title. */
									__( 'Generated %s image', 'socialframe' ),
									design.title
								)
							: sprintf(
									/* translators: %s: design title. */
									__( '%s preview', 'socialframe' ),
									design.title
								)
					}
				/>
			) }

			<div className="socialframe-frame__actions">
				<Button
					variant={ output ? 'secondary' : 'primary' }
					isBusy={ busy }
					disabled={ busy }
					accessibleWhenDisabled
					onClick={ () =>
						output ? setConfirming( true ) : generate()
					}
				>
					{ output
						? __( 'Regenerate', 'socialframe' )
						: __( 'Generate', 'socialframe' ) }
				</Button>
				{ output?.imageUrl && (
					<Button
						variant="secondary"
						disabled={ busy }
						accessibleWhenDisabled
						onClick={ () => setShareUrl( output.imageUrl ) }
					>
						{ __( 'Share to Phone', 'socialframe' ) }
					</Button>
				) }
				{ output && (
					<ExternalLink href={ output.design.editUrl }>
						{ __( 'Edit in SocialFrame', 'socialframe' ) }
					</ExternalLink>
				) }
			</div>

			<p className="socialframe-frame__status" aria-live="polite">
				{ status }
			</p>

			{ output?.imageId > 0 && (
				<ExternalLink
					href={ `upload.php?item=${ output.imageId }` }
					className="socialframe-frame__library"
				>
					{ __( 'View in Media Library', 'socialframe' ) }
				</ExternalLink>
			) }

			{ shareUrl && (
				<Suspense fallback={ null }>
					<ShareModal
						url={ shareUrl }
						onClose={ () => setShareUrl( null ) }
					/>
				</Suspense>
			) }

			<ConfirmDialog
				isOpen={ confirming }
				confirmButtonText={ __( 'Regenerate', 'socialframe' ) }
				onConfirm={ generate }
				onCancel={ () => setConfirming( false ) }
			>
				{ __(
					'This replaces the generated design and its image. Any changes made to it in SocialFrame will be lost.',
					'socialframe'
				) }
			</ConfirmDialog>
		</div>
	);
}
