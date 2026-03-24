import { useState } from '@wordpress/element';
import { Button, TextControl, Notice, Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

const { formats, editorBase } = window.socialFrameNewConfig ?? {};

const ASPECT_LABELS = {
	'instagram-post':  '1:1',
	'instagram-story': '9:16',
	'facebook-post':   '1.91:1',
	'twitter-post':    '16:9',
	'linkedin-post':   '1.91:1',
	'pinterest-pin':   '2:3',
};

export function NewDesignApp() {
	const [ selectedFormat, setSelectedFormat ] = useState( null );
	const [ title, setTitle ]                   = useState( '' );
	const [ isCreating, setCreating ]           = useState( false );
	const [ error, setError ]                   = useState( null );

	const handleCreate = async () => {
		if ( ! selectedFormat ) return;

		setCreating( true );
		setError( null );

		try {
			const design = await apiFetch( {
				path:   'socialframe/v1/designs',
				method: 'POST',
				data:   {
					title:  title.trim() || formats?.[ selectedFormat ]?.label || __( 'Untitled', 'socialframe' ),
					format: selectedFormat,
					type:   'design',
				},
			} );

			// Redirect to the editor.
			window.location.href = design.editUrl;
		} catch ( err ) {
			setError( err.message || __( 'Failed to create design. Please try again.', 'socialframe' ) );
			setCreating( false );
		}
	};

	return (
		<div className="socialframe-new">
			<div className="socialframe-new__inner">
				<h1 className="socialframe-new__title">
					{ __( 'New Design', 'socialframe' ) }
				</h1>
				<p className="socialframe-new__subtitle">
					{ __( 'Choose a format to get started.', 'socialframe' ) }
				</p>

				{ error && (
					<Notice status="error" isDismissible onRemove={ () => setError( null ) }>
						{ error }
					</Notice>
				) }

				<div className="socialframe-new__grid">
					{ Object.entries( formats ?? {} ).map( ( [ key, fmt ] ) => (
						<button
							key={ key }
							className={ `socialframe-new__format-card${ selectedFormat === key ? ' is-selected' : '' }` }
							onClick={ () => setSelectedFormat( key ) }
						>
							<FormatPreview formatKey={ key } width={ fmt.width } height={ fmt.height } />
							<span className="socialframe-new__format-label">{ fmt.label }</span>
							<span className="socialframe-new__format-dims">
								{ fmt.width } × { fmt.height }
							</span>
							<span className="socialframe-new__format-ratio">
								{ ASPECT_LABELS[ key ] ?? '' }
							</span>
						</button>
					) ) }
				</div>

				{ selectedFormat && (
					<div className="socialframe-new__form">
						<TextControl
							label={ __( 'Design Title (optional)', 'socialframe' ) }
							value={ title }
							onChange={ setTitle }
							placeholder={ formats?.[ selectedFormat ]?.label || __( 'Untitled', 'socialframe' ) }
							onKeyDown={ ( e ) => { if ( e.key === 'Enter' ) handleCreate(); } }
						/>
						<Button
							variant="primary"
							onClick={ handleCreate }
							disabled={ isCreating }
							isBusy={ isCreating }
							style={ { width: '100%', justifyContent: 'center' } }
						>
							{ isCreating
								? __( 'Creating…', 'socialframe' )
								: __( 'Create Design', 'socialframe' ) }
						</Button>
					</div>
				) }
			</div>
		</div>
	);
}

/**
 * Renders a proportional SVG preview of the format dimensions.
 */
function FormatPreview( { formatKey, width, height } ) {
	const maxW   = 80;
	const maxH   = 80;
	const scale  = Math.min( maxW / width, maxH / height );
	const svgW   = Math.round( width * scale );
	const svgH   = Math.round( height * scale );

	const fills = {
		'instagram-post':  '#833ab4',
		'instagram-story': '#fd1d1d',
		'facebook-post':   '#1877f2',
		'twitter-post':    '#1d9bf0',
		'linkedin-post':   '#0a66c2',
		'pinterest-pin':   '#e60023',
	};

	return (
		<svg
			width={ svgW }
			height={ svgH }
			viewBox={ `0 0 ${ svgW } ${ svgH }` }
			className="socialframe-new__format-preview"
			aria-hidden="true"
		>
			<rect
				width={ svgW }
				height={ svgH }
				rx="4"
				fill={ fills[ formatKey ] ?? '#888' }
				opacity="0.15"
			/>
			<rect
				width={ svgW }
				height={ svgH }
				rx="4"
				fill="none"
				stroke={ fills[ formatKey ] ?? '#888' }
				strokeWidth="2"
			/>
		</svg>
	);
}
