/**
 * Template field items: insert bound layers from the Elements panel, then
 * fill the design from a post.
 */
const path = require( 'path' );
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const { deleteAllDesigns, withApi } = require( './utils' );

const FIXTURES = path.join( __dirname, 'fixtures' );

test.describe( 'Template field items', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await deleteAllDesigns( requestUtils );
		await requestUtils.deleteAllMedia();
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await requestUtils.deleteAllPosts();
		await deleteAllDesigns( requestUtils );
		await requestUtils.deleteAllMedia();
	} );

	test( 'inserts bound layers that a post fill replaces', async ( {
		admin,
		page,
		requestUtils,
	} ) => {
		const design = await requestUtils.rest( {
			path: '/socialframe/v1/designs',
			method: 'POST',
			data: {
				title: 'Field Items',
				format: 'instagram-post',
				type: 'template',
			},
		} );
		await admin.visitAdminPage(
			'admin.php',
			`page=socialframe-editor&id=${ design.id }`
		);
		await expect( page.locator( 'canvas.lower-canvas' ) ).toBeVisible();

		await page
			.getByRole( 'button', { name: 'Elements', exact: true } )
			.click();

		// Post title: placeholder text, bound, shown in the Template field panel.
		await page
			.getByRole( 'button', { name: 'Post title', exact: true } )
			.click();
		const title = await withApi( page, ( api ) => {
			const o = api.getFabric().getActiveObject();
			return { type: o.type, text: o.text, fieldName: o.fieldName };
		} );
		expect( title ).toEqual( {
			type: 'textbox',
			text: 'Post title',
			fieldName: 'post.title',
		} );
		await expect(
			page.getByRole( 'combobox', { name: 'Fill from' } )
		).toHaveValue( 'post.title' );

		// Featured image: a placeholder image bound to the featured image.
		await page
			.getByRole( 'button', { name: 'Featured image', exact: true } )
			.click();
		await expect
			.poll( () =>
				withApi(
					page,
					( api ) => api.getFabric().getActiveObject()?.fieldName
				)
			)
			.toBe( 'post.featured_image' );
		await expect(
			page.getByRole( 'combobox', { name: 'Fill from' } )
		).toHaveValue( 'post.featured_image' );

		// Undo removes the image layer; redo brings it back.
		await page.getByRole( 'button', { name: /^Undo/ } ).click();
		const countAfterUndo = await withApi(
			page,
			( api ) =>
				api
					.getFabric()
					.getObjects()
					.filter( ( o ) => o.fieldName === 'post.featured_image' )
					.length
		);
		expect( countAfterUndo ).toBe( 0 );
		await page.getByRole( 'button', { name: /^Redo/ } ).click();

		const saved = page.waitForResponse(
			( res ) =>
				res
					.url()
					.includes( `/socialframe/v1/designs/${ design.id }` ) &&
				res.request().method() !== 'GET' &&
				! res.url().includes( '/preview' )
		);
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		expect( ( await saved ).ok() ).toBe( true );

		// Fill from a post with a title and a featured image.
		const media = await requestUtils.uploadMedia(
			path.join( FIXTURES, 'landscape-frame.png' )
		);
		const post = await requestUtils.createPost( {
			title: 'Filled Title',
			status: 'publish',
			featured_media: media.id,
		} );
		const fill = await requestUtils.rest( {
			path: `/socialframe/v1/designs/${ design.id }/fill`,
			method: 'POST',
			data: { post_id: post.id },
		} );
		expect( fill.filled ).toEqual(
			expect.arrayContaining( [ 'post.title', 'post.featured_image' ] )
		);

		const filled = await requestUtils.rest( {
			path: `/socialframe/v1/designs/${ fill.design.id }`,
		} );
		const objects = JSON.parse( filled.fabricJson ).objects;
		const byField = ( name ) =>
			objects.find( ( o ) => o.fieldName === name );
		expect( byField( 'post.title' ).text ).toBe( 'Filled Title' );
		expect( byField( 'post.featured_image' ).src ).toBe( media.source_url );
	} );
} );
