/**
 * Canvas area — mounts the <canvas> element. The Fabric canvas is sized to
 * fill this container via ResizeObserver in useFabricCanvas. Zoom and pan are
 * handled entirely through Fabric's viewport transform.
 *
 * @param {Object}                                       props
 * @param {import('react').RefObject<HTMLCanvasElement>} props.canvasRef Ref attached to the <canvas> element.
 * @param {import('react').RefObject<HTMLDivElement>}    props.areaRef   Ref attached to the container div (observed for resize).
 */
export function Canvas( { canvasRef, areaRef } ) {
	return (
		<div className="socialframe-editor__canvas-area" ref={ areaRef }>
			<canvas ref={ canvasRef } />
		</div>
	);
}
