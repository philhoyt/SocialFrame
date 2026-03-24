import { __ } from '@wordpress/i18n';
import { useFabric } from '../../EditorApp';

const { themeColors } = window.socialFrameConfig ?? {};

export function ArtboardPanel() {
	const fabric = useFabric();

	return (
		<div className="socialframe-props">
			<div className="socialframe-props__section">
				<p className="socialframe-props__section-title">{ __( 'Artboard', 'socialframe' ) }</p>

				<label className="socialframe-props__section-title">
					{ __( 'Background Color', 'socialframe' ) }
				</label>
				<div className="socialframe-color-row">
					{ ( themeColors ?? [] ).map( ( { color, name, slug } ) => (
						<button
							key={ slug }
							className="socialframe-color-swatch"
							style={ { background: color } }
							onClick={ () => fabric?.setBackground( color ) }
							title={ name }
							aria-label={ name }
						/>
					) ) }
				</div>
			</div>
		</div>
	);
}
