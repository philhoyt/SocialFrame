import { createReduxStore, register } from '@wordpress/data';

import { reducer }   from './reducer';
import * as actions  from './actions';
import * as selectors from './selectors';

export const STORE_KEY = 'socialframe/editor';

const store = createReduxStore( STORE_KEY, {
	reducer,
	actions,
	selectors,
} );

register( store );

export { store };
