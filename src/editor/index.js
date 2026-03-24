import apiFetch from '@wordpress/api-fetch';
import { createRoot } from '@wordpress/element';

// Register the store before mounting the app.
import './store';

import { EditorApp } from './EditorApp';
import './editor.css';

// Wire REST nonce into all apiFetch calls globally.
const { nonce } = window.socialFrameConfig ?? {};
apiFetch.use( apiFetch.createNonceMiddleware( nonce ) );

const root = document.getElementById( 'socialframe-editor-root' );
if ( root ) {
	createRoot( root ).render( <EditorApp /> );
}
