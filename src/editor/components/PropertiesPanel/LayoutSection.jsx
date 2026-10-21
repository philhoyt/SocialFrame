import { useState } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { Button, CheckboxControl, SelectControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';
import { Accordion } from './Accordion';
import { CommitNumber } from './CommitNumber';
import { FrameSection } from './FrameSection';
import { ToggleGroup } from './ToggleGroup';

const WIDTHS = [
	{ value: 'fixed', label: __( 'Fixed', 'socialframe' ) },
	{ value: 'fill', label: __( 'Fill', 'socialframe' ) },
];

/**
 * Frames for the selected layer: its own frame settings when it is a
 * frame, and its place in a parent frame (or adding it to one).
 */
export function LayoutSection() {
	const fabric = useFabric();
	const { objectId } = useSelect( ( select ) => ( {
		objectId: select( STORE_KEY ).getSelectedObjectId(),
		// Re-read frame details after every change, undo and redo.
		revision: select( STORE_KEY ).getRevision(),
	} ) );
	const [ target, setTarget ] = useState( '' );
	const frames = fabric?.frames;
	if ( ! frames || ! objectId ) {
		return null;
	}
	const info = frames.getInfo( objectId );
	const item = info.item;

	return (
		<>
			{ info.frame && (
				<Accordion title={ __( 'Frame', 'socialframe' ) }>
					<FrameSection frameId={ objectId } />
				</Accordion>
			) }

			<Accordion
				title={ __( 'Frame placement', 'socialframe' ) }
				defaultOpen={ info.inFrame }
			>
				{ info.inFrame ? (
					<>
						<p className="socialframe-props__hint">
							{ sprintf(
								/* translators: %s: frame name. */
								__( 'In frame: %s', 'socialframe' ),
								info.parentName
							) }
						</p>
						<div className="socialframe-props__button-group">
							<Button
								variant="secondary"
								size="small"
								disabled={ info.index <= 0 }
								onClick={ () =>
									frames.moveInFrame( objectId, -1 )
								}
							>
								{ __( 'Move earlier', 'socialframe' ) }
							</Button>
							<Button
								variant="secondary"
								size="small"
								disabled={ info.index >= info.count - 1 }
								onClick={ () =>
									frames.moveInFrame( objectId, 1 )
								}
							>
								{ __( 'Move later', 'socialframe' ) }
							</Button>
						</div>

						<div className="socialframe-props__subsection-label">
							{ __( 'Width', 'socialframe' ) }
						</div>
						<ToggleGroup
							label={ __( 'Width in frame', 'socialframe' ) }
							value={ item?.width ?? 'fixed' }
							options={ WIDTHS }
							onChange={ ( width ) =>
								frames.setItem( objectId, { width } )
							}
						/>

						{ info.isImage && (
							<CommitNumber
								label={ __(
									'Maximum height (0 for none)',
									'socialframe'
								) }
								value={ item?.maxHeight ?? 0 }
								onCommit={ ( maxHeight ) =>
									frames.setItem( objectId, { maxHeight } )
								}
							/>
						) }

						{ info.canFlex && (
							<>
								<CheckboxControl
									__nextHasNoMarginBottom
									label={ __(
										'Shrink to fit',
										'socialframe'
									) }
									help={ __(
										'If the frame runs out of room, this text gets smaller down to its minimum size, then is shortened with “…” in exports.',
										'socialframe'
									) }
									checked={ !! item?.flex }
									onChange={ ( flex ) =>
										frames.setItem( objectId, { flex } )
									}
								/>
								{ item?.flex && (
									<CommitNumber
										label={ __(
											'Minimum size',
											'socialframe'
										) }
										value={ item.minFontSize }
										min={ 6 }
										onCommit={ ( minFontSize ) =>
											frames.setItem( objectId, {
												minFontSize,
											} )
										}
									/>
								) }
							</>
						) }

						{ info.truncated && (
							<p className="socialframe-props__hint socialframe-props__hint--warning">
								{ __(
									'This text doesn’t fit and will be shortened when exported.',
									'socialframe'
								) }
							</p>
						) }

						<Button
							variant="secondary"
							size="small"
							onClick={ () => frames.removeFromFrame( objectId ) }
						>
							{ __( 'Remove from frame', 'socialframe' ) }
						</Button>
					</>
				) : (
					<>
						<p className="socialframe-props__hint">
							{ info.canJoin
								? __(
										'Put this layer in a frame to place it automatically, or select several layers and choose Create frame.',
										'socialframe'
									)
								: __(
										'Rotated, skewed or grouped layers can’t be in a frame.',
										'socialframe'
									) }
						</p>
						{ info.canJoin && info.targets.length > 0 && (
							<>
								<SelectControl
									__next40pxDefaultSize
									__nextHasNoMarginBottom
									label={ __(
										'Add to frame',
										'socialframe'
									) }
									value={ target }
									options={ [
										{
											value: '',
											label: __(
												'Choose a frame…',
												'socialframe'
											),
										},
										...info.targets.map( ( t ) => ( {
											value: t.id,
											label: t.name,
										} ) ),
									] }
									onChange={ setTarget }
								/>
								<Button
									variant="secondary"
									size="small"
									disabled={ ! target }
									onClick={ () => {
										frames.addToFrame( objectId, target );
										setTarget( '' );
									} }
								>
									{ __( 'Add', 'socialframe' ) }
								</Button>
							</>
						) }
					</>
				) }
			</Accordion>
		</>
	);
}
