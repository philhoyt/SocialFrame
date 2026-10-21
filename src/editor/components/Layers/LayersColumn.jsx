import { useEffect, useRef } from '@wordpress/element';
import { useDispatch, useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import { LayerTree } from './LayerTree';
import { LayerMenu } from './LayerMenu';
import './layers.css';

export const LAYERS_TOGGLE_ID = 'socialframe-layers-toggle';

/**
 * The Layers column. Always shown on wide screens; below 1100px it is a
 * drawer opened from the Layers button in the icon nav.
 */
export function LayersColumn() {
	const open = useSelect(
		( select ) => select( STORE_KEY ).isLayersOpen(),
		[]
	);
	const { setLayersOpen } = useDispatch( STORE_KEY );
	const ref = useRef( null );

	// Move focus into the drawer when it opens.
	useEffect( () => {
		if ( open ) {
			ref.current
				?.querySelector( '[role="treeitem"][tabindex="0"]' )
				?.focus();
		}
	}, [ open ] );

	return (
		<>
			{ /* Escape from anywhere in the drawer closes it. */ }
			{ /* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */ }
			<section
				ref={ ref }
				className={ `socialframe-layers${ open ? ' is-open' : '' }` }
				aria-label={ __( 'Layers', 'socialframe' ) }
				onKeyDown={ ( e ) => {
					if ( open && e.key === 'Escape' && ! e.defaultPrevented ) {
						setLayersOpen( false );
						document.getElementById( LAYERS_TOGGLE_ID )?.focus();
					}
				} }
			>
				<h2 className="socialframe-layers__title">
					{ __( 'Layers', 'socialframe' ) }
				</h2>
				<LayerTree />
			</section>
			<LayerMenu />
		</>
	);
}
