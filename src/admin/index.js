import apiFetch from '@wordpress/api-fetch';
import { createRoot } from '@wordpress/element';

import { AdminApp } from './AdminApp';
import './admin.css';

const { nonce } = window.socialFrameAdminConfig ?? {};
apiFetch.use( apiFetch.createNonceMiddleware( nonce ) );

const root = document.getElementById( 'socialframe-admin-root' );
if ( root ) {
	createRoot( root ).render( <AdminApp /> );
}
