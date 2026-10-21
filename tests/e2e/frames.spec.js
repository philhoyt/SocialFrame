/**
 * Frames: build a card with the panels, then fill it from posts.
 */
const path = require( 'path' );
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const { deleteAllDesigns } = require( './utils' );

const FIXTURES = path.join( __dirname, 'fixtures' );
const LONG_CONTENT = Array.from(
	{ length: 160 },
	( _, i ) => `word${ i }`
).join( ' ' );

/**
 * Loose layers for a 1080×1350 card: photo, badge rect with its grade,
 * area, title and content. No frames yet; the test builds them.
 *
 * @param {string} src Placeholder image URL.
 * @return {string} Fabric JSON.
 */
function looseJson( src ) {
	const text = ( props ) => ( {
		type: 'Textbox',
		originX: 'left',
		originY: 'top',
		fontFamily: 'sans-serif',
		fill: '#2b3342',
		lineHeight: 1.16,
		styles: [],
		...props,
	} );
	return JSON.stringify( {
		version: '7.4.0',
		objects: [
			{
				type: 'Rect',
				id: 'artboard',
				isArtboard: true,
				originX: 'left',
				originY: 'top',
				left: 0,
				top: 0,
				width: 1080,
				height: 1350,
				fill: '#ffffff',
				strokeWidth: 0,
			},
			{
				type: 'Image',
				id: 'photo',
				name: 'Photo',
				fieldName: 'post.featured_image',
				originX: 'left',
				originY: 'top',
				left: 60,
				top: 60,
				src,
				width: 960,
				height: 720,
				scaleX: 1,
				scaleY: 1,
			},
			{
				type: 'Rect',
				id: 'badge',
				name: 'Badge',
				originX: 'left',
				originY: 'top',
				left: 60,
				top: 820,
				width: 160,
				height: 80,
				fill: '#f24c62',
				strokeWidth: 0,
			},
			text( {
				id: 'grade',
				name: 'Grade',
				left: 80,
				top: 832,
				width: 120,
				fontSize: 48,
				textAlign: 'center',
				fill: '#ffffff',
				text: 'V4',
			} ),
			text( {
				id: 'area',
				name: 'Area',
				left: 260,
				top: 840,
				width: 500,
				fontSize: 36,
				text: 'Midstream North',
			} ),
			text( {
				id: 'title',
				name: 'Title',
				fieldName: 'post.title',
				left: 60,
				top: 960,
				width: 960,
				fontSize: 64,
				text: 'Title',
			} ),
			text( {
				id: 'content',
				name: 'Content',
				fieldName: 'post.content',
				left: 60,
				top: 1060,
				width: 960,
				fontSize: 36,
				text: 'Content',
			} ),
		],
	} );
}

/**
 * Run a function against the editor's canvas API in the page.
 *
 * @param {Object}                                 page Playwright page.
 * @param {(api: Object, arg: unknown) => unknown} fn   Receives the editor API; must be serialisable.
 * @param {unknown}                                arg  Argument.
 * @return {Promise<unknown>} Its result.
 */
function withApi( page, fn, arg ) {
	return page.evaluate(
		( [ source, value ] ) => {
			const el = document.querySelector( 'canvas.lower-canvas' );
			let f =
				el[
					Object.keys( el ).find( ( k ) =>
						k.startsWith( '__reactFiber' )
					)
				];
			while ( f ) {
				const v = f.memoizedProps?.value;
				if ( v && typeof v.toDataURL === 'function' ) {
					return new Function(
						'api',
						'arg',
						`return (${ source })( api, arg );`
					)( v, value );
				}
				f = f.return;
			}
			return null;
		},
		[ fn.toString(), arg ]
	);
}

/**
 * Click a layer on the canvas, optionally adding it to the selection.
 * Clicks near the top-left corner when `corner` is set, for a layer whose
 * centre is covered by another.
 *
 * @param {Object}  page   Playwright page.
 * @param {string}  id     Layer id.
 * @param {boolean} shift  Add to the selection.
 * @param {boolean} corner Click near the top-left corner.
 */
async function clickLayer( page, id, shift = false, corner = false ) {
	const point = await withApi(
		page,
		( api, target ) => {
			const c = api.getFabric();
			const o = c.getObjects().find( ( x ) => x.id === target.id );
			const vt = c.viewportTransform;
			const box = c.lowerCanvasEl.getBoundingClientRect();
			const dx = target.corner ? 6 : o.getScaledWidth() / 2;
			const dy = target.corner ? 6 : o.getScaledHeight() / 2;
			return {
				x: box.left + vt[ 4 ] + ( o.left + dx ) * vt[ 0 ],
				y: box.top + vt[ 5 ] + ( o.top + dy ) * vt[ 3 ],
			};
		},
		{ id, corner }
	);
	if ( shift ) {
		await page.keyboard.down( 'Shift' );
	}
	await page.mouse.click( point.x, point.y );
	if ( shift ) {
		await page.keyboard.up( 'Shift' );
	}
}

/**
 * Read RGB pixels from an image URL in the page.
 *
 * @param {Object}                  page   Playwright page.
 * @param {string}                  url    Image URL.
 * @param {Array<[number, number]>} points Pixel coordinates.
 * @return {Promise<number[][]>} RGB triples.
 */
function pixels( page, url, points ) {
	return page.evaluate(
		async ( [ src, pts ] ) => {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.src = src + ( src.includes( '?' ) ? '&' : '?' ) + Date.now();
			await img.decode();
			const c = document.createElement( 'canvas' );
			c.width = img.naturalWidth;
			c.height = img.naturalHeight;
			const ctx = c.getContext( '2d' );
			ctx.drawImage( img, 0, 0 );
			return pts.map( ( [ x, y ] ) =>
				Array.from( ctx.getImageData( x, y, 1, 1 ).data.slice( 0, 3 ) )
			);
		},
		[ url, points ]
	);
}

const isRed = ( [ r, g, b ] ) => r > 200 && g < 80 && b < 80;

test.describe.serial( 'Frames', () => {
	let designId;
	let postId;
	let portrait;
	let landscape;

	test.beforeAll( async ( { requestUtils } ) => {
		await deleteAllDesigns( requestUtils );
		await requestUtils.deleteAllMedia();
		portrait = await requestUtils.uploadMedia(
			path.join( FIXTURES, 'portrait-frame.png' )
		);
		landscape = await requestUtils.uploadMedia(
			path.join( FIXTURES, 'landscape-frame.png' )
		);
		const design = await requestUtils.rest( {
			path: '/socialframe/v1/designs',
			method: 'POST',
			data: {
				title: 'Frame Card',
				format: 'instagram-portrait',
				type: 'template',
				fabricJson: looseJson( portrait.source_url ),
			},
		} );
		designId = design.id;
		const post = await requestUtils.createPost( {
			title: 'Framed Problem',
			content: 'Short beta.',
			status: 'draft',
			featured_media: portrait.id,
		} );
		postId = post.id;
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await requestUtils.deleteAllPosts();
		await deleteAllDesigns( requestUtils );
		await requestUtils.deleteAllMedia();
	} );

	const saved = async ( requestUtils, id = designId ) => {
		const data = await requestUtils.rest( {
			path: `/socialframe/v1/designs/${ id }`,
		} );
		return Object.fromEntries(
			JSON.parse( data.fabricJson ).objects.map( ( o ) => [ o.id, o ] )
		);
	};

	test( 'builds a card with frames from the panels', async ( {
		admin,
		page,
		requestUtils,
	} ) => {
		await admin.visitAdminPage(
			'admin.php',
			`page=socialframe-editor&id=${ designId }`
		);
		await expect( page.locator( 'canvas.lower-canvas' ) ).toBeVisible();
		await page.evaluate( () => document.fonts.ready );

		// The badge rect around the grade becomes the badge frame.
		await clickLayer( page, 'badge', false, true );
		await clickLayer( page, 'grade', true );
		await page
			.getByRole( 'button', { name: 'Create frame', exact: true } )
			.click();

		// Undo and redo the creation.
		await page.getByRole( 'button', { name: /^Undo/ } ).click();
		expect(
			await withApi(
				page,
				( api ) =>
					!! api
						.getFabric()
						.getObjects()
						.find( ( o ) => o.id === 'badge' ).sfFrame
			)
		).toBe( false );
		await page.getByRole( 'button', { name: /^Redo/ } ).click();

		// The badge frame and the area become a row.
		await clickLayer( page, 'badge', false, true );
		await clickLayer( page, 'area', true );
		await page
			.getByRole( 'button', { name: 'Create frame', exact: true } )
			.click();
		const rowId = await withApi(
			page,
			( api ) => api.getFabric().getActiveObject()?.id
		);

		// Lay out the artboard: padding 60, gap 24, centred.
		await withApi( page, ( api ) => api.getFabric().discardActiveObject() );
		await page.keyboard.press( 'Escape' );
		await withApi( page, ( api ) => {
			api.getFabric().discardActiveObject();
			api.getFabric().fire( 'selection:cleared' );
		} );
		const layout = page.getByRole( 'checkbox', {
			name: 'Lay out content',
		} );
		if ( ! ( await layout.isVisible() ) ) {
			await page
				.getByRole( 'button', { name: 'Content layout', exact: true } )
				.click();
		}
		await layout.check();
		await page
			.getByRole( 'spinbutton', { name: 'Padding', exact: true } )
			.fill( '60' );
		await page
			.getByRole( 'spinbutton', { name: 'Padding', exact: true } )
			.press( 'Enter' );
		await page.getByRole( 'spinbutton', { name: 'Gap' } ).fill( '24' );
		await page.getByRole( 'spinbutton', { name: 'Gap' } ).press( 'Enter' );
		await page
			.getByRole( 'group', { name: 'Align horizontally' } )
			.getByRole( 'button', { name: 'Center' } )
			.click();

		// Add the photo, row, title and content to the artboard in order.
		for ( const id of [ 'photo', rowId, 'title', 'content' ] ) {
			await withApi(
				page,
				( api, target ) => api.selectById( target ),
				id
			);
			const section = page.getByRole( 'combobox', {
				name: 'Add to frame',
			} );
			if ( ! ( await section.isVisible() ) ) {
				await page
					.getByRole( 'button', {
						name: 'Frame placement',
						exact: true,
					} )
					.click();
			}
			await section.selectOption( { label: 'Artboard' } );
			await page
				.getByRole( 'button', { name: 'Add', exact: true } )
				.click();
		}

		// A typed gap applies when you click away to the canvas, which
		// deselects the frame and closes its panel.
		await withApi(
			page,
			( api, target ) => api.selectById( target ),
			rowId
		);
		const frameToggle = page.getByRole( 'button', {
			name: 'Frame',
			exact: true,
		} );
		const gapField = page.getByRole( 'spinbutton', { name: 'Gap' } );
		if ( ! ( await gapField.isVisible() ) ) {
			await frameToggle.click();
		}
		await gapField.fill( '16' );
		const canvasBox = await page
			.locator( 'canvas.upper-canvas' )
			.boundingBox();
		await page.mouse.click(
			canvasBox.x + 10,
			canvasBox.y + canvasBox.height - 10
		);
		await expect
			.poll( () =>
				withApi(
					page,
					( api, target ) =>
						api
							.getFabric()
							.getObjects()
							.find( ( o ) => o.id === target ).sfFrame.gap,
					rowId
				)
			)
			.toBe( 16 );

		// Photo fills the width up to 810 tall; title and content fill; content shrinks.
		const setItem = ( id, props ) =>
			withApi(
				page,
				( api, [ target, values ] ) =>
					api.frames.setItem( target, values ),
				[ id, props ]
			);
		await setItem( 'photo', { width: 'fill', maxHeight: 810 } );
		await setItem( 'title', { width: 'fill' } );
		await setItem( 'content', {
			width: 'fill',
			flex: true,
			minFontSize: 24,
		} );

		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect
			.poll(
				async () =>
					( await saved( requestUtils ) ).content?.sfItem?.flex
			)
			.toBe( true );

		const objects = await saved( requestUtils );
		expect( objects.badge.sfFrame.children ).toEqual( [ 'grade' ] );
		expect( objects[ rowId ].sfFrame ).toMatchObject( {
			direction: 'row',
			children: [ 'badge', 'area' ],
		} );
		expect( objects.artboard.sfFrame ).toMatchObject( {
			gap: 24,
			alignX: 'center',
			padding: { top: 60, right: 60, bottom: 60, left: 60 },
			children: [ 'photo', rowId, 'title', 'content' ],
		} );

		// Independent bounds: the row sits 24px under the photo, the title 24px under the row.
		const bounds = await withApi( page, ( api ) => {
			const by = Object.fromEntries(
				api
					.getFabric()
					.getObjects()
					.map( ( o ) => [
						o.id,
						{
							top: Math.round( o.top ),
							left: Math.round( o.left ),
							height: Math.round( o.getScaledHeight() ),
						},
					] )
			);
			return by;
		} );
		expect( bounds.photo.top ).toBe( 60 );
		expect( bounds[ rowId ].top ).toBe( 60 + bounds.photo.height + 24 );
		expect( bounds.title.top ).toBe(
			bounds[ rowId ].top + bounds[ rowId ].height + 24
		);

		await requestUtils.rest( {
			path: `/socialframe/v1/designs/${ designId }`,
			method: 'PUT',
			data: { postTypes: [ 'post' ] },
		} );
	} );

	/**
	 * Generate (or regenerate) from the block editor and return the commit.
	 *
	 * @param {Object} fixtures        Playwright fixtures.
	 * @param {Object} fixtures.admin  Admin utils.
	 * @param {Object} fixtures.editor Editor utils.
	 * @param {Object} fixtures.page   Page.
	 * @return {Promise<Object>} Commit response.
	 */
	async function generate( { admin, editor, page } ) {
		await admin.editPost( postId );
		await editor.openDocumentSettingsSidebar();
		const toggle = page.getByRole( 'button', {
			name: 'SocialFrame',
			exact: true,
		} );
		if ( ( await toggle.getAttribute( 'aria-expanded' ) ) !== 'true' ) {
			await toggle.click();
		}
		const panel = page.locator( '.socialframe-frames' );
		const committed = page.waitForResponse(
			( res ) =>
				res.url().includes( `/designs/${ designId }/generate` ) &&
				res.request().postDataJSON()?.imageData !== undefined
		);
		const regenerate = panel.getByRole( 'button', { name: 'Regenerate' } );
		if ( await regenerate.isVisible() ) {
			await regenerate.click();
			await page
				.getByRole( 'dialog' )
				.getByRole( 'button', { name: 'Regenerate' } )
				.click();
		} else {
			await panel.getByRole( 'button', { name: 'Generate' } ).click();
		}
		return ( await committed ).json();
	}

	test( 'shows a portrait photo whole, centred at the frame width', async ( {
		admin,
		editor,
		page,
	} ) => {
		const result = await generate( { admin, editor, page } );

		// Content width 960; 2048×2560 capped at 810 tall is 648 wide at x=216.
		const px = await pixels( page, result.imageUrl, [
			[ 217, 400 ],
			[ 862, 400 ],
			[ 540, 61 ],
			[ 540, 868 ],
			[ 210, 400 ],
		] );
		expect( px.slice( 0, 4 ).every( isRed ) ).toBe( true );
		expect( isRed( px[ 4 ] ) ).toBe( false );
	} );

	test( 'fills the width with a landscape photo and moves the rest up', async ( {
		admin,
		editor,
		page,
		requestUtils,
	} ) => {
		await requestUtils.rest( {
			path: `/wp/v2/posts/${ postId }`,
			method: 'POST',
			data: { featured_media: landscape.id },
		} );
		const result = await generate( { admin, editor, page } );

		// 2048×1152 at 960 wide is 540 tall, from (60, 60).
		const px = await pixels( page, result.imageUrl, [
			[ 61, 300 ],
			[ 1018, 300 ],
			[ 540, 61 ],
			[ 540, 598 ],
			[ 540, 606 ],
		] );
		expect( px.slice( 0, 4 ).every( isRed ) ).toBe( true );
		expect( isRed( px[ 4 ] ) ).toBe( false );
	} );

	test( 'shortens long content only in the output, matching Export', async ( {
		admin,
		editor,
		page,
		requestUtils,
	} ) => {
		await requestUtils.rest( {
			path: `/wp/v2/posts/${ postId }`,
			method: 'POST',
			data: { featured_media: portrait.id, content: LONG_CONTENT },
		} );
		const result = await generate( { admin, editor, page } );
		const outputId = result.design.id;

		await admin.visitAdminPage(
			'admin.php',
			`page=socialframe-editor&id=${ outputId }`
		);
		await expect( page.locator( 'canvas.lower-canvas' ) ).toBeVisible();
		await page.evaluate( () => document.fonts.ready );
		await page.waitForTimeout( 500 );

		const texts = await withApi( page, ( api ) => {
			const c = api.getFabric();
			const content = c.getObjects().find( ( o ) => o.id === 'content' );
			return {
				live: content.text,
				exported: api.frames.forExport( () => content.text ),
			};
		} );
		expect( texts.live ).toBe( LONG_CONTENT );
		expect( texts.exported.endsWith( '…' ) ).toBe( true );

		const objects = await saved( requestUtils, outputId );
		expect( objects.content.text ).toBe( LONG_CONTENT );

		// Export from the editor matches the generated image.
		const exported = page.waitForResponse(
			( res ) =>
				res
					.url()
					.includes(
						`/socialframe/v1/designs/${ outputId }/export`
					) && res.request().method() === 'POST'
		);
		await page.getByRole( 'button', { name: 'Export PNG' } ).click();
		const { url } = await ( await exported ).json();
		const differing = await page.evaluate(
			async ( [ a, b ] ) => {
				const load = async ( src ) => {
					const img = new Image();
					img.crossOrigin = 'anonymous';
					img.src = src + '?' + Date.now();
					await img.decode();
					const c = document.createElement( 'canvas' );
					c.width = img.naturalWidth;
					c.height = img.naturalHeight;
					c.getContext( '2d' ).drawImage( img, 0, 0 );
					return c
						.getContext( '2d' )
						.getImageData( 0, 0, c.width, c.height ).data;
				};
				const [ pa, pb ] = await Promise.all( [
					load( a ),
					load( b ),
				] );
				if ( pa.length !== pb.length ) {
					return -1;
				}
				let n = 0;
				for ( let i = 0; i < pa.length; i += 4 ) {
					const d =
						Math.abs( pa[ i ] - pb[ i ] ) +
						Math.abs( pa[ i + 1 ] - pb[ i + 1 ] ) +
						Math.abs( pa[ i + 2 ] - pb[ i + 2 ] );
					if ( d > 30 ) {
						n++;
					}
				}
				return n;
			},
			[ result.imageUrl, url ]
		);
		expect( differing ).toBe( 0 );
	} );
} );
