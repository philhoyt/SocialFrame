import { useSelect } from '@wordpress/data';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';
import { Accordion } from './Accordion';
import { NumField } from './NumField';
import { LinkedNumFields } from './LinkedNumFields';
import { AlignmentSection } from './AlignmentSection';
import { FlipSection } from './FlipSection';
import { ShadowSection } from './ShadowSection';

export function ImageProperties() {
	const props = useSelect( ( select ) =>
		select( STORE_KEY ).getSelectionProps()
	);
	const fabric = useFabric();

	const update = ( partial, label ) =>
		fabric?.updateSelected( partial, label );

	const handleReplaceImage = () => {
		if ( ! window.wp?.media ) {
			return;
		}

		const frame = window.wp.media( {
			title: __( 'Replace Image', 'socialframe' ),
			button: { text: __( 'Replace', 'socialframe' ) },
			multiple: false,
			library: { type: 'image' },
		} );

		frame.on( 'select', () => {
			const attachment = frame
				.state()
				.get( 'selection' )
				.first()
				.toJSON();
			fabric.replaceImage( attachment.url );
		} );

		frame.open();
	};

	return (
		<div className="socialframe-props">
			{ /* ── Position ─────────────────────────────────────────────────── */ }
			<Accordion title={ __( 'Position', 'socialframe' ) }>
				<div className="socialframe-num-grid">
					<NumField
						label="X"
						value={ Math.round( props.left ?? 0 ) }
						onChange={ ( v ) =>
							update( { left: v }, 'Position X' )
						}
					/>
					<NumField
						label="Y"
						value={ Math.round( props.top ?? 0 ) }
						onChange={ ( v ) => update( { top: v }, 'Position Y' ) }
					/>
					<LinkedNumFields
						stateKey="wh"
						aLabel="W"
						aValue={ props.width ?? 0 }
						aMin={ 1 }
						onChangeA={ ( v ) =>
							update(
								{ scaleX: v / ( props.naturalWidth ?? 100 ) },
								'Width'
							)
						}
						bLabel="H"
						bValue={ props.height ?? 0 }
						bMin={ 1 }
						onChangeB={ ( v ) =>
							update(
								{ scaleY: v / ( props.naturalHeight ?? 100 ) },
								'Height'
							)
						}
						onChangeBoth={ ( w, h ) =>
							update(
								{
									scaleX: w / ( props.naturalWidth ?? 100 ),
									scaleY: h / ( props.naturalHeight ?? 100 ),
								},
								'Size'
							)
						}
					/>
					<NumField
						label="°"
						value={ Math.round( props.angle ?? 0 ) }
						onChange={ ( v ) => update( { angle: v }, 'Rotation' ) }
					/>
					<NumField
						label="%"
						value={ Math.round( ( props.opacity ?? 1 ) * 100 ) }
						min={ 0 }
						max={ 100 }
						onChange={ ( v ) =>
							update( { opacity: v / 100 }, 'Opacity' )
						}
					/>
				</div>
				<Button
					variant="secondary"
					onClick={ handleReplaceImage }
					style={ {
						width: '100%',
						justifyContent: 'center',
						marginTop: 10,
					} }
				>
					{ __( 'Replace Image', 'socialframe' ) }
				</Button>
			</Accordion>

			{ /* ── Layout ───────────────────────────────────────────────────── */ }
			<Accordion
				title={ __( 'Layout', 'socialframe' ) }
				defaultOpen={ false }
			>
				<FlipSection />
				<AlignmentSection />
			</Accordion>

			{ /* ── Effects ──────────────────────────────────────────────────── */ }
			<Accordion
				title={ __( 'Effects', 'socialframe' ) }
				defaultOpen={ false }
			>
				<ShadowSection />
			</Accordion>
		</div>
	);
}
