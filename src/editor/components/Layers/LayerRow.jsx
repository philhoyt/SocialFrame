import { forwardRef } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

const ICONS = {
	text: 'T',
	image: '🖼',
	shape: '◻',
	frame: '▦',
	artboard: '▭',
};

/**
 * One row of the Layers tree.
 *
 * The row itself is the tree item (roving focus); the lock and hide toggles
 * are buttons inside it that arrow keys skip. Depth guides are drawn as one
 * line per level.
 */
export const LayerRow = forwardRef( function Row(
	{
		row,
		level,
		setSize,
		posInSet,
		selected,
		focused,
		expanded,
		renaming,
		renameValue,
		indicator,
		dragProps,
		onClick,
		onKeyDown,
		onContextMenu,
		onToggle,
		onRenameChange,
		onRenameDone,
		onDoubleClick,
		onLock,
		onHide,
	},
	ref
) {
	const icon = row.isFrame
		? ICONS.frame
		: ( ICONS[ row.kind ] ?? ICONS.shape );
	const classes = [
		'socialframe-tree__row',
		selected && 'is-selected',
		! row.visible && 'is-hidden',
		row.locked && 'is-locked',
		indicator && `is-drop-${ indicator }`,
	]
		.filter( Boolean )
		.join( ' ' );

	return (
		<div
			ref={ ref }
			role="treeitem"
			aria-level={ level }
			aria-setsize={ setSize }
			aria-posinset={ posInSet }
			aria-selected={ selected }
			aria-expanded={
				row.isFrame && row.childCount ? expanded : undefined
			}
			tabIndex={ focused ? 0 : -1 }
			className={ classes }
			onClick={ onClick }
			onDoubleClick={ onDoubleClick }
			onKeyDown={ onKeyDown }
			onContextMenu={ onContextMenu }
			{ ...dragProps }
		>
			{ Array.from( { length: row.depth } ).map( ( _, i ) => (
				<span
					key={ i }
					className="socialframe-tree__guide"
					aria-hidden="true"
				/>
			) ) }
			{ row.isFrame && row.childCount ? (
				<button
					type="button"
					tabIndex={ -1 }
					className="socialframe-tree__toggle"
					aria-label={
						expanded
							? __( 'Collapse frame', 'socialframe' )
							: __( 'Expand frame', 'socialframe' )
					}
					onClick={ ( e ) => {
						e.stopPropagation();
						onToggle();
					} }
				>
					<span aria-hidden="true">{ expanded ? '▾' : '▸' }</span>
				</button>
			) : (
				<span className="socialframe-tree__toggle" aria-hidden="true" />
			) }
			<span className="socialframe-tree__icon" aria-hidden="true">
				{ icon }
			</span>
			{ renaming ? (
				<input
					className="socialframe-tree__rename"
					aria-label={ __( 'Layer name', 'socialframe' ) }
					value={ renameValue }
					// eslint-disable-next-line jsx-a11y/no-autofocus -- rename starts on request.
					autoFocus
					onFocus={ ( e ) => e.target.select() }
					onChange={ ( e ) => onRenameChange( e.target.value ) }
					onBlur={ () => onRenameDone( true ) }
					onClick={ ( e ) => e.stopPropagation() }
					onKeyDown={ ( e ) => {
						e.stopPropagation();
						if ( e.key === 'Enter' || e.key === 'Escape' ) {
							e.preventDefault();
							onRenameDone( e.key === 'Enter' );
						}
					} }
				/>
			) : (
				<span className="socialframe-tree__name">{ row.name }</span>
			) }
			{ row.inLayout && (
				<span
					className="socialframe-tree__badge"
					title={ __(
						'In the artboard’s content layout',
						'socialframe'
					) }
				>
					<span aria-hidden="true">↕</span>
					<span className="screen-reader-text">
						{ __( 'in content layout', 'socialframe' ) }
					</span>
				</span>
			) }
			{ row.kind !== 'artboard' && (
				<span className="socialframe-tree__toggles">
					<button
						type="button"
						tabIndex={ -1 }
						className={ `socialframe-tree__state${ row.locked ? ' is-active' : '' }` }
						aria-pressed={ row.locked }
						aria-label={ sprintf(
							/* translators: %s: layer name. */
							__( 'Lock %s', 'socialframe' ),
							row.name
						) }
						onClick={ ( e ) => {
							e.stopPropagation();
							onLock();
						} }
					>
						<span aria-hidden="true">
							{ row.locked ? '🔒' : '🔓' }
						</span>
					</button>
					<button
						type="button"
						tabIndex={ -1 }
						className={ `socialframe-tree__state${ ! row.visible ? ' is-active' : '' }` }
						aria-pressed={ ! row.visible }
						aria-label={ sprintf(
							/* translators: %s: layer name. */
							__( 'Hide %s', 'socialframe' ),
							row.name
						) }
						onClick={ ( e ) => {
							e.stopPropagation();
							onHide();
						} }
					>
						<span aria-hidden="true">
							{ row.visible ? '👁' : '🚫' }
						</span>
					</button>
				</span>
			) }
		</div>
	);
} );
