import { useState, useEffect, useCallback } from '@wordpress/element';
import { Button, Notice, Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { DataViews, filterSortAndPaginate } from '@wordpress/dataviews/wp';

const { adminUrl, formats } = window.socialFrameAdminConfig ?? {};

const FORMAT_LABELS = Object.fromEntries(
	Object.entries( formats ?? {} ).map( ( [ key, val ] ) => [ key, val.label ] )
);

export function AdminApp() {
	const [ items, setItems ]       = useState( [] );
	const [ isLoading, setLoading ] = useState( true );
	const [ error, setError ]       = useState( null );
	const [ filter, setFilter ]     = useState( 'design' );
	const [ view, setView ]         = useState( {
		type:        'grid',
		perPage:     24,
		page:        1,
		search:      '',
		fields:      [ 'format', 'modified' ],
		filters:     [],
		sort:        { field: 'modified', direction: 'desc' },
		titleField:  'title',
		mediaField:  'thumbnailUrl',
		layout:      {},
	} );

	const loadItems = useCallback( () => {
		setLoading( true );
		setError( null );
		apiFetch( { path: `socialframe/v1/designs?type=${ filter }` } )
			.then( setItems )
			.catch( ( err ) => setError( err.message || __( 'Failed to load designs.', 'socialframe' ) ) )
			.finally( () => setLoading( false ) );
	}, [ filter ] );

	useEffect( () => {
		loadItems();
	}, [ loadItems ] );

	const handleDuplicate = useCallback( ( [ item ] ) => {
		apiFetch( {
			path:   `socialframe/v1/designs/${ item.id }/duplicate`,
			method: 'POST',
		} ).then( loadItems );
	}, [ loadItems ] );

	const handleDelete = useCallback( ( [ item ] ) => {
		// eslint-disable-next-line no-alert
		if ( ! window.confirm( __( 'Delete this design? This cannot be undone.', 'socialframe' ) ) ) {
			return;
		}
		apiFetch( {
			path:   `socialframe/v1/designs/${ item.id }`,
			method: 'DELETE',
		} ).then( loadItems );
	}, [ loadItems ] );

	const fields = [
		{
			id:            'thumbnailUrl',
			label:         __( 'Preview', 'socialframe' ),
			getValue:      ( { item } ) => item.thumbnailUrl,
			render:        ( { item } ) => (
				item.thumbnailUrl
					? <img
						src={ item.thumbnailUrl }
						alt={ item.title }
						style={ { width: '100%', height: '100%', objectFit: 'cover', display: 'block' } }
					/>
					: <div style={ { width: '100%', height: '100%', background: '#f0f0f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a7aaad', fontSize: 12 } }>
						{ __( 'No preview', 'socialframe' ) }
					</div>
			),
			enableSorting: false,
			enableHiding:  false,
		},
		{
			id:                 'title',
			label:              __( 'Name', 'socialframe' ),
			type:               'text',
			getValue:           ( { item } ) => item.title,
			render:             ( { item } ) => (
				<a href={ item.editUrl } style={ { textDecoration: 'none', color: 'inherit', fontWeight: 600 } }>
					{ item.title }
				</a>
			),
			enableSorting:      true,
			enableGlobalSearch: true,
		},
		{
			id:            'format',
			label:         __( 'Format', 'socialframe' ),
			type:          'text',
			getValue:      ( { item } ) => FORMAT_LABELS[ item.format ] ?? item.format,
			enableSorting: false,
			elements:      Object.entries( FORMAT_LABELS ).map( ( [ value, label ] ) => ( { value, label } ) ),
			filterBy:      { operators: [ 'isAny' ] },
		},
		{
			id:            'modified',
			label:         __( 'Modified', 'socialframe' ),
			type:          'text',
			getValue:      ( { item } ) => item.modified,
			render:        ( { item } ) => {
				const date = new Date( item.modified + 'Z' );
				return <span>{ date.toLocaleDateString() }</span>;
			},
			enableSorting: true,
		},
	];

	const actions = [
		{
			id:        'edit',
			label:     __( 'Edit', 'socialframe' ),
			isPrimary: true,
			callback:  ( [ item ] ) => {
				window.location.href = item.editUrl;
			},
		},
		{
			id:       'duplicate',
			label:    __( 'Duplicate', 'socialframe' ),
			callback: handleDuplicate,
		},
		{
			id:              'delete',
			label:           __( 'Delete', 'socialframe' ),
			isDestructive:   true,
			supportsBulk:    true,
			callback:        handleDelete,
		},
	];

	const { data, paginationInfo } = filterSortAndPaginate( items, view, fields );

	return (
		<div className="socialframe-admin">
			<div className="socialframe-admin__header">
				<h1 className="socialframe-admin__title">
					{ filter === 'design'
						? __( 'Designs', 'socialframe' )
						: __( 'Templates', 'socialframe' ) }
				</h1>
				<Button
					variant="primary"
					href={ adminUrl + '?page=socialframe-new' }
				>
					{ __( 'New Design', 'socialframe' ) }
				</Button>
			</div>

			<div className="socialframe-admin__filter-tabs">
				{ [ 'design', 'template' ].map( ( type ) => (
					<button
						key={ type }
						className={ `socialframe-admin__filter-tab${ filter === type ? ' socialframe-admin__filter-tab--active' : '' }` }
						onClick={ () => setFilter( type ) }
					>
						{ type === 'design'
							? __( 'Designs', 'socialframe' )
							: __( 'Templates', 'socialframe' ) }
					</button>
				) ) }
			</div>

			{ error && (
				<Notice status="error" isDismissible={ false }>{ error }</Notice>
			) }

			{ isLoading ? (
				<div style={ { padding: '40px', textAlign: 'center' } }>
					<Spinner />
				</div>
			) : (
				<DataViews
					data={ data }
					fields={ fields }
					view={ view }
					onChangeView={ setView }
					actions={ actions }
					paginationInfo={ paginationInfo }
					getItemId={ ( item ) => String( item.id ) }
					defaultLayouts={ {
						grid: {
							mediaField:  'thumbnailUrl',
							primaryField: 'title',
						},
						list: {
							primaryField: 'title',
						},
					} }
				/>
			) }
		</div>
	);
}
