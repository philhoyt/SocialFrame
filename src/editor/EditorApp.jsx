import {
	useRef,
	useEffect,
	useState,
	createContext,
	useContext,
} from '@wordpress/element';
import { useDispatch } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { Spinner } from '@wordpress/components';

import { STORE_KEY } from './store';
import { useFabricCanvas } from './hooks/useFabricCanvas';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Canvas } from './components/Canvas';
import { Header } from './components/Header';
import { IconNav } from './components/IconNav';
import { ContentPanel } from './components/ContentPanel';
import { PropertiesPanel } from './components/PropertiesPanel';

// ── Fabric context — provides the imperative API to all editor components ────

export const FabricContext = createContext( null );

/** Hook to consume the Fabric imperative API anywhere in the editor. */
export function useFabric() {
	return useContext( FabricContext );
}

// ── Root: loads the design then hands off to EditorInner ─────────────────────

const { designId: initialDesignId } = window.socialFrameConfig ?? {};

export function EditorApp() {
	const [ design, setDesign ] = useState( null );
	const [ error, setError ] = useState( null );
	const dispatch = useDispatch( STORE_KEY );

	useEffect( () => {
		if ( ! initialDesignId ) {
			setError( __( 'No design ID provided.', 'socialframe' ) );
			return;
		}

		apiFetch( { path: `socialframe/v1/designs/${ initialDesignId }` } )
			.then( ( d ) => {
				dispatch.setDesign( {
					designId: d.id,
					title: d.title,
					format: d.format,
				} );
				setDesign( d );
			} )
			.catch( () =>
				setError( __( 'Failed to load design.', 'socialframe' ) )
			);
	}, [] ); // eslint-disable-line react-hooks/exhaustive-deps

	if ( error ) {
		return (
			<div className="socialframe-editor socialframe-editor--center">
				<p style={ { color: '#fff' } }>{ error }</p>
			</div>
		);
	}

	if ( ! design ) {
		return (
			<div className="socialframe-editor socialframe-editor--center">
				<Spinner />
			</div>
		);
	}

	return <EditorInner design={ design } />;
}

// ── Inner editor: receives a loaded design, initializes Fabric ────────────────

function EditorInner( { design } ) {
	const canvasRef = useRef( null );
	const areaRef = useRef( null );

	const fabricApi = useFabricCanvas( canvasRef, areaRef, {
		format: design.format,
		fabricJson: design.fabricJson,
	} );

	useKeyboardShortcuts( fabricApi, design.id );

	return (
		<FabricContext.Provider value={ fabricApi }>
			<div className="socialframe-editor">
				<Header />
				<div className="socialframe-editor__body">
					<IconNav />
					<ContentPanel />
					<Canvas canvasRef={ canvasRef } areaRef={ areaRef } />
					<PropertiesPanel />
				</div>
			</div>
		</FabricContext.Provider>
	);
}
