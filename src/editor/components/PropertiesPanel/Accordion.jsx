import { useState } from '@wordpress/element';

/**
 * Figma-style collapsible accordion section for the properties panel.
 *
 * @param {Object}          props
 * @param {string}          props.title              Section label shown in the header.
 * @param {boolean}         [props.defaultOpen=true] Whether the section starts expanded.
 * @param {React.ReactNode} props.children
 */
export function Accordion( { title, children, defaultOpen = true } ) {
	const [ isOpen, setIsOpen ] = useState( defaultOpen );

	return (
		<div className={ `socialframe-accordion${ isOpen ? ' is-open' : '' }` }>
			<button
				type="button"
				className="socialframe-accordion__header"
				onClick={ () => setIsOpen( ( v ) => ! v ) }
			>
				<span className="socialframe-accordion__title">{ title }</span>
				<span
					className="socialframe-accordion__chevron"
					aria-hidden="true"
				>
					<svg width="10" height="6" viewBox="0 0 10 6" fill="none">
						<path
							d="M1 1L5 5L9 1"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</span>
			</button>
			{ isOpen && (
				<div className="socialframe-accordion__body">{ children }</div>
			) }
		</div>
	);
}
