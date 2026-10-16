import { useState, useEffect, useCallback } from '@wordpress/element';
import { Button, Notice, Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';

const PER_PAGE = 24;

/**
 * Pick a design or template with fields, and fill a new copy from a post.
 *
 * Reached from the "Create graphic" row action on a post list table.
 *
 * @param {Object}                        props
 * @param {{ id: number, title: string }} props.post     Source post.
 * @param {string}                        props.blankUrl URL of the plain New Design screen.
 */
export function FromPostPicker( { post, blankUrl } ) {
	const [ designs, setDesigns ] = useState( [] );
	const [ page, setPage ] = useState( 0 );
	const [ totalPages, setTotalPages ] = useState( 1 );
	const [ loading, setLoading ] = useState( true );
	const [ fillingId, setFillingId ] = useState( null );
	const [ error, setError ] = useState( null );

	const loadPage = useCallback( async ( next ) => {
		setLoading( true );
		try {
			const response = await apiFetch( {
				path: `socialframe/v1/designs?type=any&has_fields=1&per_page=${ PER_PAGE }&page=${ next }`,
				parse: false,
			} );
			const items = await response.json();
			setDesigns( ( prev ) =>
				next === 1 ? items : [ ...prev, ...items ]
			);
			setTotalPages(
				parseInt( response.headers.get( 'X-WP-TotalPages' ), 10 ) || 1
			);
			setPage( next );
		} catch {
			setError( __( 'Could not load your templates.', 'socialframe' ) );
		} finally {
			setLoading( false );
		}
	}, [] );

	useEffect( () => {
		loadPage( 1 );
	}, [ loadPage ] );

	const handlePick = async ( design ) => {
		setFillingId( design.id );
		setError( null );
		try {
			const result = await apiFetch( {
				path: `socialframe/v1/designs/${ design.id }/fill`,
				method: 'POST',
				data: { post_id: post.id },
			} );
			window.location.href = result.design.editUrl;
		} catch ( err ) {
			setError(
				err?.message ||
					__( 'Could not create the graphic.', 'socialframe' )
			);
			setFillingId( null );
		}
	};

	return (
		<div className="socialframe-new">
			<div className="socialframe-new__inner">
				<h1 className="socialframe-new__title">
					{ sprintf(
						/* translators: %s: post title. */
						__( 'Create a graphic for “%s”', 'socialframe' ),
						post.title
					) }
				</h1>
				<p className="socialframe-new__subtitle">
					{ __(
						'Pick a design or template with template fields. A new design is created with the fields filled from this post.',
						'socialframe'
					) }
				</p>

				{ error && (
					<Notice
						status="error"
						isDismissible
						onRemove={ () => setError( null ) }
					>
						{ error }
					</Notice>
				) }

				{ ! loading && designs.length === 0 && ! error && (
					<div className="socialframe-new__empty">
						<p>
							{ __(
								'No designs have template fields yet.',
								'socialframe'
							) }
						</p>
						<p>
							{ __(
								'Open a design, select a text or image layer, and choose a source under “Template field” in the properties panel. Save it, then come back here.',
								'socialframe'
							) }
						</p>
						<Button variant="secondary" href={ blankUrl }>
							{ __( 'Start a blank design', 'socialframe' ) }
						</Button>
					</div>
				) }

				{ designs.length > 0 && (
					<div className="socialframe-new__grid">
						{ designs.map( ( design ) => (
							<button
								key={ design.id }
								className={ `socialframe-new__format-card socialframe-new__template-card${
									fillingId === design.id
										? ' is-selected'
										: ''
								}` }
								onClick={ () => handlePick( design ) }
								disabled={ null !== fillingId }
								aria-busy={ fillingId === design.id }
							>
								<span className="socialframe-new__template-thumb">
									{ design.thumbnailUrl ? (
										<img
											src={ design.thumbnailUrl }
											alt=""
										/>
									) : null }
									{ fillingId === design.id && <Spinner /> }
								</span>
								<span className="socialframe-new__format-label">
									{ design.title ||
										__( 'Untitled', 'socialframe' ) }
								</span>
								<span className="socialframe-new__format-dims">
									{ design.type === 'template'
										? __( 'Template', 'socialframe' )
										: __( 'Design', 'socialframe' ) }
								</span>
							</button>
						) ) }
					</div>
				) }

				{ loading && (
					<div className="socialframe-new__loading">
						<Spinner />
					</div>
				) }

				{ ! loading && page < totalPages && (
					<Button
						variant="secondary"
						onClick={ () => loadPage( page + 1 ) }
					>
						{ __( 'Load more', 'socialframe' ) }
					</Button>
				) }
			</div>
		</div>
	);
}
