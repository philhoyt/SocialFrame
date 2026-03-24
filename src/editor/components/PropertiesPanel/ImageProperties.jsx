import { useSelect } from '@wordpress/data';
import { TextControl, RangeControl, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';

export function ImageProperties() {
	const props  = useSelect( ( select ) => select( STORE_KEY ).getSelectionProps() );
	const fabric = useFabric();

	const update = ( partial, label ) => fabric?.updateSelected( partial, label );

	const handleReplaceImage = () => {
		if ( ! window.wp?.media ) return;

		const frame = window.wp.media( {
			title:    __( 'Replace Image', 'socialframe' ),
			button:   { text: __( 'Replace', 'socialframe' ) },
			multiple: false,
			library:  { type: 'image' },
		} );

		frame.on( 'select', () => {
			const attachment = frame.state().get( 'selection' ).first().toJSON();
			const canvas     = fabric?.getFabric();
			const obj        = canvas?.getActiveObject();
			if ( ! obj || obj.type !== 'image' ) return;

			const { fabric: fabricLib } = require( 'fabric' );
			fabricLib.Image.fromURL( attachment.url, { crossOrigin: 'anonymous' } ).then( ( newImg ) => {
				obj.setElement( newImg.getElement() );
				canvas.renderAll();
				fabric.markDirty?.();
			} );
		} );

		frame.open();
	};

	return (
		<div className="socialframe-props">
			<div className="socialframe-props__section">
				<p className="socialframe-props__section-title">{ __( 'Image', 'socialframe' ) }</p>

				<div className="socialframe-props__row">
					<TextControl
						label={ __( 'X', 'socialframe' ) }
						type="number"
						value={ Math.round( props.left ?? 0 ) }
						onChange={ ( v ) => update( { left: Number( v ) }, 'Position X' ) }
					/>
					<TextControl
						label={ __( 'Y', 'socialframe' ) }
						type="number"
						value={ Math.round( props.top ?? 0 ) }
						onChange={ ( v ) => update( { top: Number( v ) }, 'Position Y' ) }
					/>
				</div>

				<div className="socialframe-props__row">
					<TextControl
						label={ __( 'W', 'socialframe' ) }
						type="number"
						value={ props.width ?? 0 }
						onChange={ ( v ) => update( { scaleX: Number( v ) / ( props.naturalWidth ?? 100 ) }, 'Width' ) }
					/>
					<TextControl
						label={ __( 'H', 'socialframe' ) }
						type="number"
						value={ props.height ?? 0 }
						onChange={ ( v ) => update( { scaleY: Number( v ) / ( props.naturalHeight ?? 100 ) }, 'Height' ) }
					/>
				</div>

				<RangeControl
					label={ __( 'Opacity', 'socialframe' ) }
					value={ Math.round( ( props.opacity ?? 1 ) * 100 ) }
					min={ 0 }
					max={ 100 }
					onChange={ ( v ) => update( { opacity: v / 100 }, 'Opacity' ) }
				/>

				<Button
					variant="secondary"
					onClick={ handleReplaceImage }
					style={ { width: '100%', justifyContent: 'center', marginTop: 8 } }
				>
					{ __( 'Replace Image', 'socialframe' ) }
				</Button>
			</div>
		</div>
	);
}
