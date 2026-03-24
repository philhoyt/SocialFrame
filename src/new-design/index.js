import apiFetch from '@wordpress/api-fetch';
import { createRoot } from '@wordpress/element';

import { NewDesignApp } from './NewDesignApp';
import './new-design.css';

const { nonce } = window.socialFrameNewConfig ?? {};
apiFetch.use( apiFetch.createNonceMiddleware( nonce ) );

const root = document.getElementById( 'socialframe-new-root' );
if ( root ) {
	createRoot( root ).render( <NewDesignApp /> );
}
