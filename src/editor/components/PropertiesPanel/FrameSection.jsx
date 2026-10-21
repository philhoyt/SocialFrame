import { useState } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { Button, CheckboxControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';
import { CommitNumber } from './CommitNumber';
import { ToggleGroup } from './ToggleGroup';

const DIRECTIONS = [
	{ value: 'column', label: __( 'Vertical', 'socialframe' ) },
	{ value: 'row', label: __( 'Horizontal', 'socialframe' ) },
];
const ALIGN_X = [
	{ value: 'start', label: __( 'Left', 'socialframe' ) },
	{ value: 'center', label: __( 'Center', 'socialframe' ) },
	{ value: 'end', label: __( 'Right', 'socialframe' ) },
];
const ALIGN_Y = [
	{ value: 'start', label: __( 'Top', 'socialframe' ) },
	{ value: 'center', label: __( 'Middle', 'socialframe' ) },
	{ value: 'end', label: __( 'Bottom', 'socialframe' ) },
];
const SIZING = [
	{ value: 'fixed', label: __( 'Fixed', 'socialframe' ) },
	{ value: 'hug', label: __( 'Fit content', 'socialframe' ) },
];
const SIDES = [
	[ 'top', __( 'Top', 'socialframe' ) ],
	[ 'right', __( 'Right', 'socialframe' ) ],
	[ 'bottom', __( 'Bottom', 'socialframe' ) ],
	[ 'left', __( 'Left', 'socialframe' ) ],
];

/**
 * Layout settings for a frame: direction, gap, padding, alignment and
 * sizing. Used for frames and for the artboard's own layout.
 *
 * @param {Object}  props
 * @param {string}  props.frameId    Frame (or artboard) id.
 * @param {boolean} props.isArtboard Whether this is the artboard (size is fixed).
 */
export function FrameSection( { frameId, isArtboard = false } ) {
	const fabric = useFabric();
	// Re-read frame details after every change, undo and redo.
	useSelect( ( select ) => select( STORE_KEY ).getRevision(), [] );
	const frames = fabric?.frames;
	const info = frames?.getInfo( isArtboard ? null : frameId );
	const frame = info?.frame;
	const pad = frame?.padding;
	const [ perSide, setPerSide ] = useState(
		() => !! pad && new Set( Object.values( pad ) ).size > 1
	);
	if ( ! frame ) {
		return null;
	}

	const set = ( props, label ) => frames.setFrame( frameId, props, label );

	return (
		<div className="socialframe-frame-settings">
			<div className="socialframe-props__subsection-label">
				{ __( 'Direction', 'socialframe' ) }
			</div>
			<ToggleGroup
				label={ __( 'Direction', 'socialframe' ) }
				value={ frame.direction }
				options={ DIRECTIONS }
				onChange={ ( direction ) => set( { direction } ) }
			/>

			<CommitNumber
				label={ __( 'Gap', 'socialframe' ) }
				value={ frame.gap }
				onCommit={ ( gap ) => set( { gap } ) }
			/>

			{ perSide ? (
				<div className="socialframe-frame-settings__sides">
					{ SIDES.map( ( [ side, label ] ) => (
						<CommitNumber
							key={ side }
							label={ label }
							value={ pad[ side ] }
							onCommit={ ( v ) =>
								set( { padding: { ...pad, [ side ]: v } } )
							}
						/>
					) ) }
				</div>
			) : (
				<CommitNumber
					label={ __( 'Padding', 'socialframe' ) }
					value={ pad.top }
					onCommit={ ( v ) =>
						set( {
							padding: { top: v, right: v, bottom: v, left: v },
						} )
					}
				/>
			) }
			<CheckboxControl
				__nextHasNoMarginBottom
				label={ __( 'Padding per side', 'socialframe' ) }
				checked={ perSide }
				onChange={ setPerSide }
			/>

			<div className="socialframe-props__subsection-label">
				{ __( 'Align horizontally', 'socialframe' ) }
			</div>
			<ToggleGroup
				label={ __( 'Align horizontally', 'socialframe' ) }
				value={ frame.alignX }
				options={ ALIGN_X }
				onChange={ ( alignX ) => set( { alignX } ) }
			/>
			<div className="socialframe-props__subsection-label">
				{ __( 'Align vertically', 'socialframe' ) }
			</div>
			<ToggleGroup
				label={ __( 'Align vertically', 'socialframe' ) }
				value={ frame.alignY }
				options={ ALIGN_Y }
				onChange={ ( alignY ) => set( { alignY } ) }
			/>

			{ ! isArtboard && (
				<>
					<div className="socialframe-props__subsection-label">
						{ __( 'Width', 'socialframe' ) }
					</div>
					<ToggleGroup
						label={ __( 'Width', 'socialframe' ) }
						value={ frame.width }
						options={ SIZING }
						onChange={ ( width ) => set( { width } ) }
					/>
					<div className="socialframe-props__subsection-label">
						{ __( 'Height', 'socialframe' ) }
					</div>
					<ToggleGroup
						label={ __( 'Height', 'socialframe' ) }
						value={ frame.height }
						options={ SIZING }
						onChange={ ( height ) => set( { height } ) }
					/>
				</>
			) }

			{ info.overflowing && (
				<p className="socialframe-props__hint socialframe-props__hint--warning">
					{ __(
						'The content doesn’t fit. Text set to shrink is shortened when exported.',
						'socialframe'
					) }
				</p>
			) }

			<Button
				variant="secondary"
				size="small"
				isDestructive
				onClick={ () =>
					isArtboard
						? frames.setArtboardLayout( false )
						: frames.removeFrame( frameId )
				}
			>
				{ isArtboard
					? __( 'Stop laying out content', 'socialframe' )
					: __( 'Remove frame (keep layers)', 'socialframe' ) }
			</Button>
		</div>
	);
}
