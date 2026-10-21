import { useEffect, useState } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { Button, CheckboxControl, TextControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';
import { Accordion } from './Accordion';

/**
 * A number field that commits on blur or Enter, so typing a value is one
 * undo step.
 *
 * @param {Object}                  props
 * @param {string}                  props.label    Field label.
 * @param {number}                  props.value    Current value.
 * @param {number}                  props.min      Lowest value.
 * @param {(value: number) => void} props.onCommit Called with the new value.
 */
export function CommitNumber( { label, value, min, onCommit } ) {
	const [ draft, setDraft ] = useState( String( value ) );
	useEffect( () => setDraft( String( value ) ), [ value ] );

	const commit = () => {
		const next = Math.max( min, Math.round( Number( draft ) ) );
		if ( Number.isFinite( next ) && next !== value ) {
			onCommit( next );
		} else {
			setDraft( String( value ) );
		}
	};

	return (
		<TextControl
			__next40pxDefaultSize
			__nextHasNoMarginBottom
			type="number"
			min={ min }
			label={ label }
			value={ draft }
			onChange={ setDraft }
			onBlur={ commit }
			onKeyDown={ ( e ) => {
				if ( e.key === 'Enter' ) {
					commit();
				}
			} }
		/>
	);
}

/**
 * Vertical stack membership for the selected layer: join or leave, row
 * order, and how text fits when the stack runs out of room.
 */
export function StackSection() {
	const fabric = useFabric();
	const { objectId } = useSelect( ( select ) => ( {
		objectId: select( STORE_KEY ).getSelectedObjectId(),
		// Re-read stack details after every change, undo and redo.
		revision: select( STORE_KEY ).getRevision(),
	} ) );
	const stack = fabric?.stack;
	if ( ! stack || ! objectId ) {
		return null;
	}
	const info = stack.getInfo( objectId );

	return (
		<Accordion
			title={ __( 'Stack', 'socialframe' ) }
			defaultOpen={ info.inStack }
		>
			<p className="socialframe-props__hint">
				{ __(
					'Layers in the stack flow top to bottom with the spacing you give them, so content of any size pushes the layers below it down.',
					'socialframe'
				) }
			</p>

			<CheckboxControl
				__nextHasNoMarginBottom
				label={ __( 'Part of the vertical stack', 'socialframe' ) }
				checked={ info.inStack }
				disabled={ ! info.inStack && ! info.canJoin }
				onChange={ ( checked ) =>
					checked ? stack.join( objectId ) : stack.leave( objectId )
				}
			/>
			{ ! info.inStack && ! info.canJoin && (
				<p className="socialframe-props__hint">
					{ __(
						'Rotated, skewed or grouped layers can’t join the stack.',
						'socialframe'
					) }
				</p>
			) }

			{ info.inStack && (
				<>
					{ info.rowMates.length > 0 && (
						<p className="socialframe-props__hint">
							{ sprintf(
								/* translators: %s: comma-separated layer names. */
								__( 'Row with: %s', 'socialframe' ),
								info.rowMates.join( ', ' )
							) }
						</p>
					) }

					<div className="socialframe-props__button-group">
						<Button
							variant="secondary"
							size="small"
							disabled={ info.rowIndex <= 0 }
							onClick={ () => stack.moveRowOf( objectId, -1 ) }
						>
							{ __( 'Move row up', 'socialframe' ) }
						</Button>
						<Button
							variant="secondary"
							size="small"
							disabled={ info.rowIndex >= info.rowCount - 1 }
							onClick={ () => stack.moveRowOf( objectId, 1 ) }
						>
							{ __( 'Move row down', 'socialframe' ) }
						</Button>
					</div>

					{ info.canFlex && (
						<>
							<CheckboxControl
								__nextHasNoMarginBottom
								label={ __( 'Shrink to fit', 'socialframe' ) }
								help={ __(
									'If the stack is too tall, this text gets smaller down to its minimum size, then is shortened with “…” in exports.',
									'socialframe'
								) }
								checked={ info.flex }
								onChange={ ( flex ) =>
									stack.setFlex( objectId, { flex } )
								}
							/>
							{ info.flex && (
								<CommitNumber
									label={ __(
										'Minimum size',
										'socialframe'
									) }
									value={ info.minFontSize }
									min={ 6 }
									onCommit={ ( minFontSize ) =>
										stack.setFlex( objectId, {
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
				</>
			) }
		</Accordion>
	);
}
