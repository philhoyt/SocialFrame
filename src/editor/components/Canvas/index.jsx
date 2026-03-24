/**
 * Canvas area — mounts the <canvas> element. The Fabric canvas is sized to
 * fill this container via ResizeObserver in useFabricCanvas. Zoom and pan are
 * handled entirely through Fabric's viewport transform.
 *
 * @param {Object}              props
 * @param {React.RefObject}     props.canvasRef Ref attached to the <canvas> element.
 * @param {React.RefObject}     props.areaRef   Ref attached to the container div (observed for resize).
 */
export function Canvas( { canvasRef, areaRef } ) {
	return (
		<div className="socialframe-editor__canvas-area" ref={ areaRef }>
			<canvas ref={ canvasRef } />
		</div>
	);
}
