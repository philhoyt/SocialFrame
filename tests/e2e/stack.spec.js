/**
 * Vertical stack: images keep their aspect ratio and the rows below reflow,
 * in both Generate output and the editor.
 */
const path = require( 'path' );
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const { deleteAllDesigns } = require( './utils' );

const FIXTURES = path.join( __dirname, 'fixtures' );
const LONG_CONTENT = Array.from(
	{ length: 120 },
	( _, i ) => `word${ i }`
).join( ' ' );

/**
 * A 1080×1350 template: a stacked featured image in a 1080×810 box, a row
 * with a badge and the grade, the title, and flexible content.
 *
 * @param {string} src Placeholder image URL.
 * @return {string} Fabric JSON.
 */
function templateJson( src ) {
	const text = ( props ) => ( {
		type: 'Textbox',
		originX: 'left',
		originY: 'top',
		fontFamily: 'sans-serif',
		fill: '#ffffff',
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
				sfStack: {
					top: 0,
					bottom: 40,
					rows: [
						{ id: 'img', gap: 0 },
						{ id: 'meta', gap: 30 },
						{ id: 'title', gap: 20 },
						{ id: 'body', gap: 16 },
					],
				},
			},
			{
				type: 'Image',
				id: 'photo',
				name: 'Photo',
				fieldName: 'post.featured_image',
				originX: 'left',
				originY: 'top',
				left: 0,
				top: 0,
				src,
				width: 1080,
				height: 810,
				scaleX: 1,
				scaleY: 1,
				sfBox: { left: 0, width: 1080, height: 810 },
				sfStackItem: { row: 'img', offset: 0 },
			},
			{
				type: 'Rect',
				id: 'badge',
				name: 'Badge',
				originX: 'left',
				originY: 'top',
				left: 60,
				top: 840,
				width: 160,
				height: 80,
				fill: '#f24c62',
				strokeWidth: 0,
				sfStackItem: { row: 'meta', offset: 0 },
			},
			text( {
				id: 'grade',
				name: 'Grade',
				left: 60,
				top: 852,
				width: 160,
				fontSize: 48,
				textAlign: 'center',
				text: 'V4',
				sfStackItem: { row: 'meta', offset: 12 },
			} ),
			text( {
				id: 'title',
				name: 'Title',
				fieldName: 'post.title',
				left: 60,
				top: 940,
				width: 960,
				fontSize: 72,
				fill: '#2b3342',
				text: 'Title',
				sfStackItem: { row: 'title', offset: 0 },
			} ),
			text( {
				id: 'content',
				name: 'Content',
				fieldName: 'post.content',
				left: 60,
				top: 1040,
				width: 960,
				fontSize: 40,
				fill: '#434344',
				text: 'Content',
				sfStackItem: {
					row: 'body',
					offset: 0,
					flex: true,
					fontSize: 40,
					minFontSize: 24,
				},
			} ),
		],
	} );
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

test.describe( 'Vertical stack', () => {
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
				title: 'Stack Card',
				format: 'instagram-portrait',
				type: 'template',
				fabricJson: templateJson( portrait.source_url ),
			},
		} );
		designId = design.id;
		await requestUtils.rest( {
			path: `/socialframe/v1/designs/${ designId }`,
			method: 'PUT',
			data: { postTypes: [ 'post' ] },
		} );

		const post = await requestUtils.createPost( {
			title: 'Stacked Problem',
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

	/**
	 * Open a design in the editor and read its stacked layers' layout.
	 *
	 * @param {Object} page  Playwright page.
	 * @param {Object} admin Admin utils.
	 * @param {number} id    Design ID.
	 * @return {Promise<Object>} Tops by id, and export-time truncated text.
	 */
	async function editorLayout( page, admin, id ) {
		await admin.visitAdminPage(
			'admin.php',
			`page=socialframe-editor&id=${ id }`
		);
		await expect( page.locator( 'canvas.lower-canvas' ) ).toBeVisible();
		return page.evaluate( async () => {
			await document.fonts.ready;
			// Let the stack's scheduled layout run.
			await new Promise( ( r ) => setTimeout( r, 500 ) );
			const el = document.querySelector( 'canvas.lower-canvas' );
			let f =
				el[
					Object.keys( el ).find( ( k ) =>
						k.startsWith( '__reactFiber' )
					)
				];
			let api = null;
			while ( f ) {
				const v = f.memoizedProps?.value;
				if ( v && typeof v.toDataURL === 'function' ) {
					api = v;
					break;
				}
				f = f.return;
			}
			const objects = api.getFabric().getObjects();
			const byId = ( key ) => objects.find( ( o ) => o.id === key );
			const exportText = api.stack.forExport(
				() => byId( 'content' ).text
			);
			return {
				tops: Object.fromEntries(
					objects
						.filter( ( o ) => o.id )
						.map( ( o ) => [ o.id, Math.round( o.top ) ] )
				),
				photoHeight: Math.round( byId( 'photo' ).getScaledHeight() ),
				liveText: byId( 'content' ).text,
				exportText,
			};
		} );
	}

	test( 'shows a portrait photo whole and flows the rows below it', async ( {
		admin,
		editor,
		page,
	} ) => {
		const result = await generate( { admin, editor, page } );

		// 2048×2560 in a 1080×810 box: 648×810 at x=216, frame intact.
		const px = await pixels( page, result.imageUrl, [
			[ 217, 400 ],
			[ 862, 400 ],
			[ 540, 1 ],
			[ 540, 808 ],
			[ 210, 400 ],
			[ 540, 400 ],
		] );
		expect( px.slice( 0, 4 ).every( isRed ) ).toBe( true );
		expect( isRed( px[ 4 ] ) ).toBe( false );
		expect( isRed( px[ 5 ] ) ).toBe( false );

		const layout = await editorLayout( page, admin, result.design.id );
		expect( layout.photoHeight ).toBe( 810 );
		expect( layout.tops.badge ).toBe( 840 );
		expect( layout.tops.grade ).toBe( 852 );
		expect( layout.tops.title ).toBe( 940 );
	} );

	test( 'shows a landscape photo full width and moves the rows up', async ( {
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

		// 2048×1152 at full width is 1080×607.5, from the top.
		const px = await pixels( page, result.imageUrl, [
			[ 1, 300 ],
			[ 1078, 300 ],
			[ 540, 1 ],
			[ 540, 605 ],
			[ 540, 615 ],
		] );
		expect( px.slice( 0, 4 ).every( isRed ) ).toBe( true );
		expect( isRed( px[ 4 ] ) ).toBe( false );

		const layout = await editorLayout( page, admin, result.design.id );
		expect( layout.photoHeight ).toBe( 608 );
		expect( layout.tops.badge ).toBe( 608 + 30 );
		expect( layout.tops.title ).toBeLessThan( 940 );
	} );

	test( 'shrinks, then shortens long content only in the output', async ( {
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
		const layout = await editorLayout( page, admin, result.design.id );

		expect( layout.liveText ).toBe( LONG_CONTENT );
		expect( layout.exportText.endsWith( '…' ) ).toBe( true );
		expect( layout.exportText.length ).toBeLessThan( LONG_CONTENT.length );

		const saved = await requestUtils.rest( {
			path: `/socialframe/v1/designs/${ result.design.id }`,
		} );
		const content = JSON.parse( saved.fabricJson ).objects.find(
			( o ) => o.id === 'content'
		);
		expect( content.text ).toBe( LONG_CONTENT );
		expect( content.sfStackItem.fontSize ).toBe( 40 );
	} );

	test( 'Generate and editor Export produce the same image', async ( {
		admin,
		editor,
		page,
		requestUtils,
	} ) => {
		await requestUtils.rest( {
			path: `/wp/v2/posts/${ postId }`,
			method: 'POST',
			data: { featured_media: portrait.id, content: 'Short beta.' },
		} );
		const generated = await generate( { admin, editor, page } );

		await editorLayout( page, admin, generated.design.id );
		const exported = page.waitForResponse(
			( res ) =>
				res
					.url()
					.includes(
						`/socialframe/v1/designs/${ generated.design.id }/export`
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
			[ generated.imageUrl, url ]
		);

		expect( differing ).toBe( 0 );
	} );

	test( 'joins, reorders and undoes from the properties panel', async ( {
		admin,
		page,
		requestUtils,
	} ) => {
		const design = await requestUtils.rest( {
			path: '/socialframe/v1/designs',
			method: 'POST',
			data: {
				title: 'Join Test',
				format: 'instagram-post',
				fabricJson: JSON.stringify( {
					version: '7.4.0',
					objects: [
						{
							type: 'Rect',
							id: 'artboard',
							isArtboard: true,
							originX: 'left',
							originY: 'top',
							width: 1080,
							height: 1080,
							fill: '#ffffff',
						},
						...[ 'one', 'two' ].map( ( id, i ) => ( {
							type: 'Textbox',
							id,
							name: id,
							originX: 'left',
							originY: 'top',
							left: 100,
							top: 100 + i * 200,
							width: 600,
							fontSize: 40,
							text: id,
						} ) ),
					],
				} ),
			},
		} );

		await admin.visitAdminPage(
			'admin.php',
			`page=socialframe-editor&id=${ design.id }`
		);
		await expect( page.locator( 'canvas.lower-canvas' ) ).toBeVisible();

		const select = ( id ) =>
			page.evaluate( ( target ) => {
				const el = document.querySelector( 'canvas.lower-canvas' );
				let f =
					el[
						Object.keys( el ).find( ( k ) =>
							k.startsWith( '__reactFiber' )
						)
					];
				while ( f ) {
					const v = f.memoizedProps?.value;
					if ( v && typeof v.selectById === 'function' ) {
						v.selectById( target );
						return;
					}
					f = f.return;
				}
			}, id );

		const join = async ( id ) => {
			await select( id );
			const checkbox = page.getByRole( 'checkbox', {
				name: 'Part of the vertical stack',
			} );
			if ( ! ( await checkbox.isVisible() ) ) {
				await page
					.getByRole( 'button', { name: 'Stack', exact: true } )
					.click();
			}
			await checkbox.check();
		};
		await join( 'one' );
		await join( 'two' );

		await page.getByRole( 'button', { name: 'Move row up' } ).click();
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();

		const saved = async () => {
			const data = await requestUtils.rest( {
				path: `/socialframe/v1/designs/${ design.id }`,
			} );
			const objects = JSON.parse( data.fabricJson ).objects;
			const top = ( id ) => objects.find( ( o ) => o.id === id ).top;
			return {
				rows: objects.find( ( o ) => o.isArtboard ).sfStack?.rows ?? [],
				order: top( 'two' ) < top( 'one' ) ? 'two-first' : 'one-first',
			};
		};

		// Saves race with autosave, so wait for the stored order to settle.
		await expect
			.poll( async () => ( await saved() ).order )
			.toBe( 'two-first' );
		expect( ( await saved() ).rows ).toHaveLength( 2 );

		// Undo the move, save, and the original order is back.
		await page.getByRole( 'button', { name: /^Undo/ } ).click();
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect
			.poll( async () => ( await saved() ).order )
			.toBe( 'one-first' );
	} );
} );
