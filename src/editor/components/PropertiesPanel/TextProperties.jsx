import { useSelect } from '@wordpress/data';
import { SelectControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';
import { Accordion } from './Accordion';
import { NumField } from './NumField';
import { AlignmentSection } from './AlignmentSection';
import { FlipSection } from './FlipSection';
import { ShadowSection } from './ShadowSection';
import { FieldSection } from './FieldSection';
import { LayoutSection } from './LayoutSection';
import { ColorRow } from './ColorRow';

const { themeFonts } = window.socialFrameConfig ?? {};

export function TextProperties() {
	const props = useSelect( ( select ) =>
		select( STORE_KEY ).getSelectionProps()
	);
	const fabric = useFabric();

	const update = ( partial, label ) =>
		fabric?.updateSelected( partial, label );

	const fontOptions = ( themeFonts ?? [] ).map( ( f ) => ( {
		label: f.name || f.fontFamily,
		value: f.fontFamily,
	} ) );

	return (
		<div className="socialframe-props">
			<Accordion title={ __( 'Position', 'socialframe' ) }>
				<div className="socialframe-num-grid">
					<NumField
						label="X"
						value={ Math.round( props.left ?? 0 ) }
						onChange={ ( v ) =>
							update(
								{ left: v },
								__( 'Position X', 'socialframe' )
							)
						}
					/>
					<NumField
						label="Y"
						value={ Math.round( props.top ?? 0 ) }
						onChange={ ( v ) =>
							update(
								{ top: v },
								__( 'Position Y', 'socialframe' )
							)
						}
					/>
					<NumField
						label="W"
						value={ Math.round( props.width ?? 0 ) }
						onChange={ ( v ) =>
							update( { width: v }, __( 'Width', 'socialframe' ) )
						}
					/>
					<NumField
						label="H"
						value={ Math.round( props.height ?? 0 ) }
						readOnly
					/>
					<NumField
						label="°"
						value={ Math.round( props.angle ?? 0 ) }
						onChange={ ( v ) =>
							update(
								{ angle: v },
								__( 'Rotation', 'socialframe' )
							)
						}
					/>
					<NumField
						label="%"
						value={ Math.round( ( props.opacity ?? 1 ) * 100 ) }
						min={ 0 }
						max={ 100 }
						onChange={ ( v ) =>
							update(
								{ opacity: v / 100 },
								__( 'Opacity', 'socialframe' )
							)
						}
					/>
				</div>
			</Accordion>

			<Accordion title={ __( 'Typography', 'socialframe' ) }>
				{ fontOptions.length > 0 && (
					<SelectControl
						label={ __( 'Font', 'socialframe' ) }
						value={ props.fontFamily ?? '' }
						options={ fontOptions }
						onChange={ ( v ) =>
							update(
								{ fontFamily: v },
								__( 'Font family', 'socialframe' )
							)
						}
					/>
				) }

				<div
					className="socialframe-num-grid"
					style={ { marginBottom: 12 } }
				>
					<NumField
						label="Size"
						value={ props.fontSize ?? 16 }
						min={ 8 }
						max={ 300 }
						onChange={ ( v ) =>
							update(
								{ fontSize: v },
								__( 'Font size', 'socialframe' )
							)
						}
					/>
					<NumField
						label="LH"
						value={ props.lineHeight ?? 1.16 }
						step={ 0.01 }
						min={ 0.5 }
						max={ 4 }
						onChange={ ( v ) =>
							update(
								{ lineHeight: v },
								__( 'Line height', 'socialframe' )
							)
						}
					/>
					<NumField
						label="LS"
						value={ props.charSpacing ?? 0 }
						min={ -200 }
						max={ 800 }
						onChange={ ( v ) =>
							update(
								{ charSpacing: v },
								__( 'Letter spacing', 'socialframe' )
							)
						}
					/>
				</div>

				<div className="socialframe-props__subsection-label">
					{ __( 'Style', 'socialframe' ) }
				</div>
				<div
					className="socialframe-props__button-group"
					style={ { marginBottom: 10 } }
				>
					<button
						className={ `socialframe-props__toggle-btn${
							props.fontWeight === 'bold'
								? ' socialframe-props__toggle-btn--active'
								: ''
						}` }
						aria-pressed={ props.fontWeight === 'bold' }
						onClick={ () =>
							update(
								{
									fontWeight:
										props.fontWeight === 'bold'
											? 'normal'
											: 'bold',
								},
								__( 'Bold', 'socialframe' )
							)
						}
						aria-label={ __( 'Bold', 'socialframe' ) }
					>
						<strong>B</strong>
					</button>
					<button
						className={ `socialframe-props__toggle-btn${
							props.fontStyle === 'italic'
								? ' socialframe-props__toggle-btn--active'
								: ''
						}` }
						aria-pressed={ props.fontStyle === 'italic' }
						onClick={ () =>
							update(
								{
									fontStyle:
										props.fontStyle === 'italic'
											? 'normal'
											: 'italic',
								},
								__( 'Italic', 'socialframe' )
							)
						}
						aria-label={ __( 'Italic', 'socialframe' ) }
					>
						<em>I</em>
					</button>
					<button
						className={ `socialframe-props__toggle-btn${
							props.underline
								? ' socialframe-props__toggle-btn--active'
								: ''
						}` }
						aria-pressed={ !! props.underline }
						onClick={ () =>
							update(
								{ underline: ! props.underline },
								__( 'Underline', 'socialframe' )
							)
						}
						aria-label={ __( 'Underline', 'socialframe' ) }
					>
						<u>U</u>
					</button>
				</div>

				<div className="socialframe-props__subsection-label">
					{ __( 'Alignment', 'socialframe' ) }
				</div>
				<div className="socialframe-props__button-group">
					{ [
						{
							value: 'left',
							label: __( 'Align left', 'socialframe' ),
							icon: (
								<svg
									width="16"
									height="16"
									viewBox="0 0 16 16"
									fill="currentColor"
									aria-hidden="true"
								>
									<rect
										x="1"
										y="2"
										width="14"
										height="2"
										rx="1"
									/>
									<rect
										x="1"
										y="7"
										width="9"
										height="2"
										rx="1"
									/>
									<rect
										x="1"
										y="12"
										width="11"
										height="2"
										rx="1"
									/>
								</svg>
							),
						},
						{
							value: 'center',
							label: __( 'Align center', 'socialframe' ),
							icon: (
								<svg
									width="16"
									height="16"
									viewBox="0 0 16 16"
									fill="currentColor"
									aria-hidden="true"
								>
									<rect
										x="1"
										y="2"
										width="14"
										height="2"
										rx="1"
									/>
									<rect
										x="3.5"
										y="7"
										width="9"
										height="2"
										rx="1"
									/>
									<rect
										x="2.5"
										y="12"
										width="11"
										height="2"
										rx="1"
									/>
								</svg>
							),
						},
						{
							value: 'right',
							label: __( 'Align right', 'socialframe' ),
							icon: (
								<svg
									width="16"
									height="16"
									viewBox="0 0 16 16"
									fill="currentColor"
									aria-hidden="true"
								>
									<rect
										x="1"
										y="2"
										width="14"
										height="2"
										rx="1"
									/>
									<rect
										x="6"
										y="7"
										width="9"
										height="2"
										rx="1"
									/>
									<rect
										x="4"
										y="12"
										width="11"
										height="2"
										rx="1"
									/>
								</svg>
							),
						},
					].map( ( { value, label, icon } ) => (
						<button
							key={ value }
							className={ `socialframe-props__toggle-btn${
								props.textAlign === value
									? ' socialframe-props__toggle-btn--active'
									: ''
							}` }
							aria-pressed={ props.textAlign === value }
							title={ label }
							aria-label={ label }
							onClick={ () =>
								update( { textAlign: value }, label )
							}
						>
							{ icon }
						</button>
					) ) }
				</div>
			</Accordion>

			<Accordion title={ __( 'Fill', 'socialframe' ) }>
				<ColorRow
					value={ typeof props.fill === 'string' ? props.fill : null }
					onChange={ ( hex ) =>
						update(
							{ fill: hex },
							__( 'Text color', 'socialframe' )
						)
					}
				/>
			</Accordion>

			<Accordion
				title={ __( 'Background', 'socialframe' ) }
				defaultOpen={ false }
			>
				<ColorRow
					value={ props.backgroundColor || null }
					onChange={ ( hex ) =>
						update(
							{ backgroundColor: hex },
							__( 'Text background', 'socialframe' )
						)
					}
					showNone
					noneValue=""
					noneLabel={ __( 'No background', 'socialframe' ) }
				/>
			</Accordion>

			<Accordion
				title={ __( 'Layout', 'socialframe' ) }
				defaultOpen={ false }
			>
				<FlipSection />
				<AlignmentSection />
			</Accordion>

			<Accordion
				title={ __( 'Effects', 'socialframe' ) }
				defaultOpen={ false }
			>
				<ShadowSection />
			</Accordion>

			<FieldSection kind="text" />

			<LayoutSection />
		</div>
	);
}
