import { useRef, useEffect, useState } from '@wordpress/element';
import { useSelect } from '@wordpress/data';

import { STORE_KEY } from '../../store';
import { FORMATS } from '../../utils/formats';

const CANVAS_PADDING = 48;

/**
 * Canvas area — mounts the <canvas> element and applies a CSS scale transform
 * so the artboard fits the available space. Fabric stays at native resolution.
 *
 * @param {Object} props
 * @param {React.RefObject} props.canvasRef Ref to attach to the <canvas> element.
 */
export function Canvas( { canvasRef } ) {
	const format      = useSelect( ( select ) => select( STORE_KEY ).getFormat() );
	const wrapperRef  = useRef( null );
	const areaRef     = useRef( null );
	const [ scale, setScale ] = useState( 1 );

	const formatDef = FORMATS[ format ] ?? { width: 1080, height: 1080 };

	useEffect( () => {
		function updateScale() {
			if ( ! areaRef.current ) return;
			const rect = areaRef.current.getBoundingClientRect();
			const availW = rect.width  - CANVAS_PADDING * 2;
			const availH = rect.height - CANVAS_PADDING * 2;
			const nextScale = Math.min(
				availW / formatDef.width,
				availH / formatDef.height,
				1 // Never upscale beyond 100%.
			);
			setScale( nextScale );
		}

		updateScale();

		const observer = new ResizeObserver( updateScale );
		if ( areaRef.current ) observer.observe( areaRef.current );

		return () => observer.disconnect();
	}, [ formatDef.width, formatDef.height ] );

	const scaledW = formatDef.width  * scale;
	const scaledH = formatDef.height * scale;

	return (
		<div className="socialframe-editor__canvas-area" ref={ areaRef }>
			{ /*
			 * Sizer: sized to the visual (scaled) dimensions so the flex container
			 * centers it correctly. The canvas wrapper inside is positioned absolutely
			 * at native Fabric resolution, scaled from the top-left to fill the sizer.
			 */ }
			<div style={ {
				width:      scaledW,
				height:     scaledH,
				flexShrink: 0,
				position:   'relative',
				margin:     CANVAS_PADDING,
			} }>
				<div
					ref={ wrapperRef }
					className="socialframe-canvas-wrapper"
					style={ {
						width:           formatDef.width,
						height:          formatDef.height,
						transform:       `scale(${ scale })`,
						transformOrigin: 'top left',
						position:        'absolute',
						top:             0,
						left:            0,
					} }
				>
					<canvas ref={ canvasRef } />
				</div>
			</div>
		</div>
	);
}
