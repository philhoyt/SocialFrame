import { useSelect } from '@wordpress/data';
import { RangeControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import { STORE_KEY } from '../../store';
import { useFabric } from '../../EditorApp';

const { themeColors } = window.socialFrameConfig ?? {};

export function ShapeProperties() {
	const props  = useSelect( ( select ) => select( STORE_KEY ).getSelectionProps() );
	const fabric = useFabric();

	const update = ( partial, label ) => fabric?.updateSelected( partial, label );

	return (
		<div className="socialframe-props">
			<div className="socialframe-props__section">
				<p className="socialframe-props__section-title">{ __( 'Shape', 'socialframe' ) }</p>

				<div className="socialframe-props__section">
					<p className="socialframe-props__section-title">{ __( 'Fill Color', 'socialframe' ) }</p>
					<div className="socialframe-color-row">
						{ ( themeColors ?? [] ).map( ( { color, name, slug } ) => (
							<button
								key={ slug }
								className={ `socialframe-color-swatch${ props.fill === color ? ' socialframe-color-swatch--active' : '' }` }
								style={ { background: color } }
								onClick={ () => update( { fill: color }, 'Fill color' ) }
								title={ name }
								aria-label={ name }
							/>
						) ) }
						{ /* Transparent / no fill option */ }
						<button
							className={ `socialframe-color-swatch${ ( ! props.fill || props.fill === 'transparent' ) ? ' socialframe-color-swatch--active' : '' }` }
							style={ { background: 'transparent', border: '2px dashed #666' } }
							onClick={ () => update( { fill: 'transparent' }, 'No fill' ) }
							title={ __( 'No fill', 'socialframe' ) }
							aria-label={ __( 'No fill', 'socialframe' ) }
						/>
					</div>
				</div>

				<RangeControl
					label={ __( 'Opacity', 'socialframe' ) }
					value={ Math.round( ( props.opacity ?? 1 ) * 100 ) }
					min={ 0 }
					max={ 100 }
					onChange={ ( v ) => update( { opacity: v / 100 }, 'Opacity' ) }
				/>

				<div className="socialframe-props__section">
					<p className="socialframe-props__section-title">{ __( 'Stroke Color', 'socialframe' ) }</p>
					<div className="socialframe-color-row">
						{ ( themeColors ?? [] ).map( ( { color, name, slug } ) => (
							<button
								key={ slug }
								className={ `socialframe-color-swatch${ props.stroke === color ? ' socialframe-color-swatch--active' : '' }` }
								style={ { background: color } }
								onClick={ () => update( { stroke: color }, 'Stroke color' ) }
								title={ name }
								aria-label={ name }
							/>
						) ) }
					</div>
				</div>

				<RangeControl
					label={ __( 'Stroke Width', 'socialframe' ) }
					value={ props.strokeWidth ?? 0 }
					min={ 0 }
					max={ 50 }
					onChange={ ( v ) => update( { strokeWidth: v }, 'Stroke width' ) }
				/>

				{ /* Corner radius — only for rect shapes */ }
				{ ( props.rx !== undefined ) && (
					<RangeControl
						label={ __( 'Corner Radius', 'socialframe' ) }
						value={ props.rx ?? 0 }
						min={ 0 }
						max={ 200 }
						onChange={ ( v ) => update( { rx: v, ry: v }, 'Corner radius' ) }
					/>
				) }
			</div>
		</div>
	);
}
