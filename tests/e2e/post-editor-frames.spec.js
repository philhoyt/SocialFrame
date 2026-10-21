/**
 * Generating an assigned design from the block editor's SocialFrame panel.
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const { deleteAllDesigns } = require( './utils' );

/**
 * A 1080×1080 canvas with a white artboard and a post-title text field.
 */
const TEMPLATE_JSON = JSON.stringify( {
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
			height: 1080,
			fill: '#ffffff',
			strokeWidth: 0,
		},
		{
			type: 'Textbox',
			id: 'title',
			originX: 'left',
			originY: 'top',
			left: 80,
			top: 80,
			width: 920,
			fontSize: 72,
			fontFamily: 'sans-serif',
			text: 'Placeholder',
			fieldName: 'post.title',
		},
	],
} );

test.describe( 'Post editor SocialFrame panel', () => {
	let designId;
	let postId;

	test.beforeAll( async ( { requestUtils } ) => {
		await deleteAllDesigns( requestUtils );
		const design = await requestUtils.rest( {
			path: '/socialframe/v1/designs',
			method: 'POST',
			data: {
				title: 'E2E Frame',
				format: 'instagram-post',
				type: 'template',
				fabricJson: TEMPLATE_JSON,
			},
		} );
		designId = design.id;

		await requestUtils.rest( {
			path: `/socialframe/v1/designs/${ designId }`,
			method: 'PUT',
			data: { postTypes: [ 'post' ] },
		} );

		const post = await requestUtils.createPost( {
			title: 'Saved E2E Title',
			status: 'draft',
		} );
		postId = post.id;
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await requestUtils.deleteAllPosts();
		await deleteAllDesigns( requestUtils );
		await requestUtils.deleteAllMedia();
	} );

	test( 'generates from unsaved edits, then regenerates in place', async ( {
		admin,
		editor,
		page,
		requestUtils,
	} ) => {
		const fabricRequests = [];
		page.on( 'request', ( req ) => {
			if ( /\/build\/fabric\.js/.test( req.url() ) ) {
				fabricRequests.push( req.url() );
			}
		} );

		await admin.editPost( postId );
		await editor.canvas
			.getByRole( 'textbox', { name: 'Add title' } )
			.fill( 'Unsaved E2E Title' );

		await editor.openDocumentSettingsSidebar();
		const panelToggle = page.getByRole( 'button', {
			name: 'SocialFrame',
			exact: true,
		} );
		if (
			( await panelToggle.getAttribute( 'aria-expanded' ) ) !== 'true'
		) {
			await panelToggle.click();
		}

		const panel = page.locator( '.socialframe-frames' );
		await expect( panel.getByText( 'E2E Frame' ) ).toBeVisible();
		expect( fabricRequests ).toHaveLength( 0 );

		// Generate: a dry run, a browser render, then the commit.
		const committed = page.waitForResponse(
			( res ) =>
				res.url().includes( `/designs/${ designId }/generate` ) &&
				res.request().postDataJSON()?.imageData !== undefined
		);
		await panel.getByRole( 'button', { name: 'Generate' } ).click();
		const first = await ( await committed ).json();

		expect( first.created ).toBe( true );
		expect( fabricRequests.length ).toBeGreaterThan( 0 );
		await expect(
			panel.getByRole( 'img', { name: 'Generated E2E Frame image' } )
		).toBeVisible();

		const output = await requestUtils.rest( {
			path: `/socialframe/v1/designs/${ first.design.id }`,
		} );
		const title = JSON.parse( output.fabricJson ).objects.find(
			( o ) => o.fieldName === 'post.title'
		);
		expect( title.text ).toBe( 'Unsaved E2E Title' );

		const media = await requestUtils.rest( {
			path: `/wp/v2/media/${ first.imageId }`,
		} );
		expect( media.media_details.width ).toBe( 1080 );
		expect( media.media_details.height ).toBe( 1080 );

		// Regenerate after another edit: confirm, same design and attachment.
		await editor.canvas
			.getByRole( 'textbox', { name: 'Add title' } )
			.fill( 'Second E2E Title' );

		const recommitted = page.waitForResponse(
			( res ) =>
				res.url().includes( `/designs/${ designId }/generate` ) &&
				res.request().postDataJSON()?.imageData !== undefined
		);
		await panel.getByRole( 'button', { name: 'Regenerate' } ).click();
		await page
			.getByRole( 'dialog' )
			.getByRole( 'button', { name: 'Regenerate' } )
			.click();
		const second = await ( await recommitted ).json();

		expect( second.created ).toBe( false );
		expect( second.design.id ).toBe( first.design.id );
		expect( second.imageId ).toBe( first.imageId );

		const regenerated = await requestUtils.rest( {
			path: `/socialframe/v1/designs/${ first.design.id }`,
		} );
		expect(
			JSON.parse( regenerated.fabricJson ).objects.find(
				( o ) => o.fieldName === 'post.title'
			).text
		).toBe( 'Second E2E Title' );

		// The template itself never changes.
		const template = await requestUtils.rest( {
			path: `/socialframe/v1/designs/${ designId }`,
		} );
		expect(
			JSON.parse( template.fabricJson ).objects.find(
				( o ) => o.fieldName === 'post.title'
			).text
		).toBe( 'Placeholder' );
	} );

	test( 'is not loaded on post types with no assigned design', async ( {
		admin,
		page,
	} ) => {
		await admin.createNewPost( { postType: 'page' } );

		await expect(
			page.locator( 'script[src*="build/post-editor/index.js"]' )
		).toHaveCount( 0 );
	} );
} );
