import { useState, useEffect, useRef } from '@wordpress/element';
import { Button, CheckboxControl, Spinner, SearchControl } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

import { useFabric } from '../../EditorApp';

export function PostsPanel() {
	const fabric = useFabric();

	// Step: 'search' | 'options'
	const [ step,           setStep           ] = useState( 'search' );
	const [ query,          setQuery          ] = useState( '' );
	const [ results,        setResults        ] = useState( [] );
	const [ searching,      setSearching      ] = useState( false );
	const [ selectedPost,   setSelectedPost   ] = useState( null );
	const [ postData,       setPostData       ] = useState( null );
	const [ loadingPost,    setLoadingPost    ] = useState( false );
	const [ metaOpen,       setMetaOpen       ] = useState( false );
	const [ importing,      setImporting      ] = useState( false );

	// Import options — booleans keyed by field name
	const [ checks, setChecks ] = useState( {} );

	const debounceRef = useRef( null );

	// Debounced search
	useEffect( () => {
		clearTimeout( debounceRef.current );
		if ( ! query.trim() ) {
			setResults( [] );
			setSearching( false );
			return;
		}
		setSearching( true );
		debounceRef.current = setTimeout( () => {
			apiFetch( { path: `socialframe/v1/post-import?search=${ encodeURIComponent( query ) }` } )
				.then( ( data ) => setResults( data ) )
				.catch( () => setResults( [] ) )
				.finally( () => setSearching( false ) );
		}, 300 );
		return () => clearTimeout( debounceRef.current );
	}, [ query ] );

	function selectPost( post ) {
		setSelectedPost( post );
		setLoadingPost( true );
		setPostData( null );
		setChecks( {} );
		setMetaOpen( false );
		setStep( 'options' );

		apiFetch( { path: `socialframe/v1/post-import/${ post.id }` } )
			.then( ( data ) => {
				setPostData( data );
				// Default-check title and featured image if available.
				const termChecks = {};
				Object.keys( data.terms ?? {} ).forEach( ( slug ) => {
					termChecks[ `term_${ slug }` ] = false;
				} );
				setChecks( {
					title:          !! data.title,
					featured_image: !! data.featured_image_url,
					content:        false,
					excerpt:        false,
					...termChecks,
				} );
			} )
			.catch( () => setPostData( null ) )
			.finally( () => setLoadingPost( false ) );
	}

	function goBack() {
		setStep( 'search' );
		setSelectedPost( null );
		setPostData( null );
	}

	function toggleCheck( key ) {
		setChecks( ( prev ) => ( { ...prev, [ key ]: ! prev[ key ] } ) );
	}

	function toggleMeta( key ) {
		setChecks( ( prev ) => ( { ...prev, [ `meta_${ key }` ]: ! prev[ `meta_${ key }` ] } ) );
	}

	function toggleTerm( slug ) {
		setChecks( ( prev ) => ( { ...prev, [ `term_${ slug }` ]: ! prev[ `term_${ slug }` ] } ) );
	}

	async function handleImport() {
		if ( ! fabric || ! postData ) return;
		setImporting( true );
		try {
			if ( checks.title && postData.title ) {
				fabric.addText( 'huge', { text: postData.title } );
			}
			if ( checks.featured_image && postData.featured_image_url ) {
				await fabric.addImage( postData.featured_image_url );
			}
			if ( checks.content && postData.content ) {
				fabric.addText( 'medium', { text: postData.content } );
			}
			if ( checks.excerpt && postData.excerpt ) {
				fabric.addText( 'small', { text: postData.excerpt } );
			}
			if ( postData.terms ) {
				for ( const [ slug, taxonomy ] of Object.entries( postData.terms ) ) {
					if ( checks[ `term_${ slug }` ] ) {
						fabric.addText( 'small', { text: taxonomy.terms.join( ', ' ) } );
					}
				}
			}
			if ( postData.meta ) {
				for ( const [ key, item ] of Object.entries( postData.meta ) ) {
					if ( checks[ `meta_${ key }` ] ) {
						if ( item.type === 'image' ) {
							await fabric.addImage( item.image_url );
						} else {
							fabric.addText( 'small', { text: String( item.value ) } );
						}
					}
				}
			}
		} finally {
			setImporting( false );
		}
	}

	// ── Render ───────────────────────────────────────────────────────────────

	if ( step === 'options' ) {
		const metaKeys  = postData ? Object.keys( postData.meta ?? {} ) : [];
		const termSlugs = postData ? Object.keys( postData.terms ?? {} ) : [];

		return (
			<div className="socialframe-panel socialframe-posts-panel">
				<button className="socialframe-posts-panel__back" onClick={ goBack }>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
						<path d="M10.5 3.5 6 8l4.5 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
					</svg>
					{ __( 'Back', 'socialframe' ) }
				</button>

				<p className="socialframe-posts-panel__post-title">
					{ selectedPost?.title }
				</p>

				{ loadingPost ? (
					<div className="socialframe-posts-panel__loading"><Spinner /></div>
				) : postData ? (
					<>
						<div className="socialframe-posts-panel__options">
							{ postData.title && (
								<CheckboxControl
									label={ __( 'Title', 'socialframe' ) }
									checked={ !! checks.title }
									onChange={ () => toggleCheck( 'title' ) }
								/>
							) }
							{ postData.featured_image_url && (
								<CheckboxControl
									label={ __( 'Featured Image', 'socialframe' ) }
									checked={ !! checks.featured_image }
									onChange={ () => toggleCheck( 'featured_image' ) }
								/>
							) }
							{ postData.content && (
								<CheckboxControl
									label={ __( 'Content', 'socialframe' ) }
									checked={ !! checks.content }
									onChange={ () => toggleCheck( 'content' ) }
								/>
							) }
							{ postData.excerpt && (
								<CheckboxControl
									label={ __( 'Excerpt', 'socialframe' ) }
									checked={ !! checks.excerpt }
									onChange={ () => toggleCheck( 'excerpt' ) }
								/>
							) }
						</div>

						{ termSlugs.length > 0 && (
							<div className="socialframe-posts-panel__terms-section">
								<p className="socialframe-posts-panel__section-label">
									{ __( 'Taxonomies', 'socialframe' ) }
								</p>
								{ termSlugs.map( ( slug ) => {
									const taxonomy = postData.terms[ slug ];
									return (
										<CheckboxControl
											key={ slug }
											label={
												<span className="socialframe-posts-panel__term-label">
													<span className="socialframe-posts-panel__term-name">{ taxonomy.label }</span>
													<span className="socialframe-posts-panel__term-values">{ taxonomy.terms.join( ', ' ) }</span>
												</span>
											}
											checked={ !! checks[ `term_${ slug }` ] }
											onChange={ () => toggleTerm( slug ) }
										/>
									);
								} ) }
							</div>
						) }

						{ metaKeys.length > 0 && (
							<div className="socialframe-posts-panel__meta-section">
								<button
									className="socialframe-posts-panel__meta-toggle"
									onClick={ () => setMetaOpen( ( v ) => ! v ) }
									aria-expanded={ metaOpen }
								>
									{ __( 'Advanced: Meta Fields', 'socialframe' ) }
									<svg
										width="12" height="12" viewBox="0 0 12 12"
										fill="currentColor" aria-hidden="true"
										style={ { transform: metaOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' } }
									>
										<path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
									</svg>
								</button>

								{ metaOpen && (
									<div className="socialframe-posts-panel__meta-list">
										{ metaKeys.map( ( key ) => {
											const item = postData.meta[ key ];
											return (
												<CheckboxControl
													key={ key }
													label={
														<span className="socialframe-posts-panel__meta-label">
															<span className="socialframe-posts-panel__meta-key">{ key }</span>
															{ item.type === 'image' ? (
																<img
																	src={ item.image_url }
																	alt=""
																	className="socialframe-posts-panel__meta-thumb"
																/>
															) : (
																<span className="socialframe-posts-panel__meta-value">
																	{ String( item.value ).slice( 0, 40 ) }
																</span>
															) }
														</span>
													}
													checked={ !! checks[ `meta_${ key }` ] }
													onChange={ () => toggleMeta( key ) }
												/>
											);
										} ) }
									</div>
								) }
							</div>
						) }

						<Button
							variant="primary"
							onClick={ handleImport }
							disabled={ importing || ! Object.values( checks ).some( Boolean ) }
							isBusy={ importing }
							style={ { width: '100%', justifyContent: 'center', marginTop: 16 } }
						>
							{ __( 'Import to Canvas', 'socialframe' ) }
						</Button>
					</>
				) : (
					<p className="socialframe-posts-panel__empty">
						{ __( 'Could not load post data.', 'socialframe' ) }
					</p>
				) }
			</div>
		);
	}

	// Step: search
	return (
		<div className="socialframe-panel socialframe-posts-panel">
			<p className="socialframe-panel__title">{ __( 'Import Post', 'socialframe' ) }</p>

			<SearchControl
				value={ query }
				onChange={ setQuery }
				placeholder={ __( 'Search posts…', 'socialframe' ) }
				className="socialframe-posts-panel__search"
			/>

			{ searching && (
				<div className="socialframe-posts-panel__loading"><Spinner /></div>
			) }

			{ ! searching && query.trim() && results.length === 0 && (
				<p className="socialframe-posts-panel__empty">
					{ __( 'No posts found.', 'socialframe' ) }
				</p>
			) }

			{ ! searching && results.length > 0 && (
				<ul className="socialframe-posts-panel__results">
					{ results.map( ( post ) => (
						<li key={ post.id }>
							<button
								className="socialframe-posts-panel__result"
								onClick={ () => selectPost( post ) }
							>
								<span className="socialframe-posts-panel__result-title">
									{ post.title }
								</span>
								<span className="socialframe-posts-panel__result-type">
									{ post.post_type_label }
								</span>
							</button>
						</li>
					) ) }
				</ul>
			) }

			{ ! query.trim() && (
				<p className="socialframe-posts-panel__hint">
					{ __( 'Search across all post types to import content into your design.', 'socialframe' ) }
				</p>
			) }
		</div>
	);
}
