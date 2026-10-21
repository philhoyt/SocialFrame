/**
 * Smoke test for the design editor: create, edit, save, duplicate, export.
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const { deleteAllDesigns } = require( './utils' );

/**
 * Read a design through the plugin's REST API.
 *
 * @param {Object} requestUtils Playwright request utils.
 * @param {number} id           Design ID.
 * @return {Promise<Object>} The design.
 */
function getDesign( requestUtils, id ) {
	return requestUtils.rest( { path: `/socialframe/v1/designs/${ id }` } );
}

test.describe( 'Design editor', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await deleteAllDesigns( requestUtils );
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await deleteAllDesigns( requestUtils );
		await requestUtils.deleteAllMedia();
	} );

	test( 'creates, edits, saves, duplicates and exports a design', async ( {
		admin,
		page,
		requestUtils,
	} ) => {
		// Create from the New Design screen.
		await admin.visitAdminPage( 'admin.php', 'page=socialframe-new' );
		await page.getByRole( 'button', { name: /Instagram Post/ } ).click();
		await page
			.getByRole( 'textbox', { name: 'Design Title (optional)' } )
			.fill( 'E2E Banner' );
		await page.getByRole( 'button', { name: 'Create Design' } ).click();

		await page.waitForURL( /page=socialframe-editor&id=\d+/ );
		const id = Number( new URL( page.url() ).searchParams.get( 'id' ) );

		// Edit: add a heading from the Text panel.
		await page.getByRole( 'button', { name: 'Text', exact: true } ).click();
		await page.getByRole( 'button', { name: 'Huge' } ).click();

		// Save, and wait for the server to have the canvas.
		const saved = page.waitForResponse(
			( res ) =>
				res.url().includes( `/socialframe/v1/designs/${ id }` ) &&
				res.request().method() !== 'GET' &&
				! res.url().includes( '/preview' )
		);
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		expect( ( await saved ).ok() ).toBe( true );

		const design = await getDesign( requestUtils, id );
		const objects = JSON.parse( design.fabricJson ).objects;
		expect( design.title ).toBe( 'E2E Banner' );
		expect(
			objects.some( ( o ) => /text/i.test( o.type ) && o.text === 'Huge' )
		).toBe( true );
		expect( objects.find( ( o ) => o.isArtboard ) ).toMatchObject( {
			left: 0,
			top: 0,
			originX: 'left',
			originY: 'top',
		} );

		// The canvas survives a reload.
		await page.reload();
		await expect( page.locator( 'canvas.lower-canvas' ) ).toBeVisible();
		const reloaded = await getDesign( requestUtils, id );
		expect( JSON.parse( reloaded.fabricJson ).objects ).toHaveLength(
			objects.length
		);

		// Export saves a PNG at the format's size.
		const exported = page.waitForResponse(
			( res ) =>
				res
					.url()
					.includes( `/socialframe/v1/designs/${ id }/export` ) &&
				res.request().method() === 'POST'
		);
		await page.getByRole( 'button', { name: 'Export PNG' } ).click();
		const exportResponse = await exported;
		expect( exportResponse.status() ).toBe( 201 );
		const { attachmentId } = await exportResponse.json();
		await expect(
			page.getByRole( 'dialog', { name: 'Share to Phone' } )
		).toBeVisible();

		const media = await requestUtils.rest( {
			path: `/wp/v2/media/${ attachmentId }`,
		} );
		expect( media.media_details.width ).toBe( 1080 );
		expect( media.media_details.height ).toBe( 1080 );

		// Duplicate from the designs list.
		await admin.visitAdminPage( 'admin.php', 'page=socialframe' );
		const duplicated = page.waitForResponse(
			( res ) =>
				res
					.url()
					.includes( `/socialframe/v1/designs/${ id }/duplicate` ) &&
				res.request().method() === 'POST'
		);
		const card = page
			.locator( '.dataviews-view-grid__card' )
			.filter( { hasText: 'E2E Banner' } );
		await card.getByRole( 'button', { name: 'Actions' } ).click();
		await page.getByRole( 'menuitem', { name: 'Duplicate' } ).click();
		const duplicateResponse = await duplicated;
		expect( duplicateResponse.status() ).toBe( 201 );

		const copy = await duplicateResponse.json();
		expect( copy.title ).toBe( 'E2E Banner (Copy)' );
		const copied = await getDesign( requestUtils, copy.id );
		expect( copied.fabricJson ).toBe( reloaded.fabricJson );
	} );
} );
