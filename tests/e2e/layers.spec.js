/**
 * Layers: the always-visible tree, drag and drop, multi-select and the
 * layer menu.
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const { deleteAllDesigns, withApi } = require( './utils' );

/**
 * WCAG 2.1 A/AA violations inside the given selectors.
 *
 * @param {Object}   page      Playwright page.
 * @param {string[]} selectors Regions to scan.
 * @return {Promise<string[]>} One line per violation.
 */
async function axe( page, selectors ) {
	await page.addScriptTag( { path: require.resolve( 'axe-core' ) } );
	return page.evaluate( async ( include ) => {
		const result = await window.axe.run(
			{ include: include.map( ( s ) => [ s ] ) },
			{
				runOnly: {
					type: 'tag',
					values: [ 'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa' ],
				},
			}
		);
		return result.violations.flatMap( ( v ) =>
			v.nodes.map( ( n ) => `${ v.id }: ${ n.target.join( ' ' ) }` )
		);
	}, selectors );
}

/**
 * A card frame with two texts, plus a loose logo and note.
 *
 * @return {string} Fabric JSON.
 */
function cardJson() {
	const text = ( props ) => ( {
		type: 'Textbox',
		originX: 'left',
		originY: 'top',
		fontFamily: 'sans-serif',
		fill: '#222222',
		fontSize: 40,
		width: 500,
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
				height: 1080,
				fill: '#ffffff',
				strokeWidth: 0,
			},
			{
				type: 'Rect',
				id: 'card',
				name: 'Card',
				originX: 'left',
				originY: 'top',
				left: 100,
				top: 100,
				width: 600,
				height: 200,
				fill: '#eeeeee',
				strokeWidth: 0,
				sfFrame: {
					direction: 'column',
					padding: { top: 20, right: 20, bottom: 20, left: 20 },
					gap: 10,
					alignX: 'start',
					alignY: 'start',
					width: 'fixed',
					height: 'hug',
					children: [ 'title', 'sub' ],
				},
			},
			text( {
				id: 'title',
				name: 'Title',
				left: 120,
				top: 120,
				text: 'Title',
			} ),
			text( {
				id: 'sub',
				name: 'Sub',
				left: 120,
				top: 180,
				text: 'Sub',
			} ),
			{
				type: 'Rect',
				id: 'logo',
				name: 'Logo',
				originX: 'left',
				originY: 'top',
				left: 800,
				top: 100,
				width: 120,
				height: 120,
				fill: '#f24c62',
				strokeWidth: 0,
			},
			text( {
				id: 'note',
				name: 'Note',
				left: 100,
				top: 800,
				text: 'Note',
			} ),
		],
	} );
}

/**
 * The tree row for a layer name.
 *
 * @param {Object} page Playwright page.
 * @param {string} name Layer name.
 * @return {Object} Locator.
 */
const row = ( page, name ) =>
	page
		.getByRole( 'tree', { name: 'Layers' } )
		.getByRole( 'treeitem' )
		.filter( {
			has: page.locator( '.socialframe-tree__name', {
				hasText: new RegExp( `^${ name }$` ),
			} ),
		} );

const childrenOf = ( page, id ) =>
	withApi(
		page,
		( api, target ) =>
			api
				.getFabric()
				.getObjects()
				.find( ( o ) => o.id === target )?.sfFrame?.children ?? null,
		id
	);

const frameIds = ( page ) =>
	withApi( page, ( api ) =>
		api
			.getFabric()
			.getObjects()
			.filter( ( o ) => o.sfFrame && ! o.isArtboard )
			.map( ( o ) => o.id )
	);

const parentOf = ( page, id ) =>
	withApi(
		page,
		( api, target ) =>
			api
				.getFabric()
				.getObjects()
				.find( ( o ) => o.sfFrame?.children?.includes( target ) )?.id ??
			null,
		id
	);

/**
 * Save, and wait for the server to have the canvas.
 *
 * @param {Object} page Playwright page.
 * @param {number} id   Design id.
 */
async function save( page, id ) {
	const saved = page.waitForResponse(
		( res ) =>
			res.url().includes( `/socialframe/v1/designs/${ id }` ) &&
			res.request().method() !== 'GET' &&
			! res.url().includes( '/preview' )
	);
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	expect( ( await saved ).ok() ).toBe( true );
}

test.describe.serial( 'Layers', () => {
	let designId;

	test.beforeAll( async ( { requestUtils } ) => {
		await deleteAllDesigns( requestUtils );
		const design = await requestUtils.rest( {
			path: '/socialframe/v1/designs',
			method: 'POST',
			data: {
				title: 'Layers Card',
				format: 'instagram-post',
				fabricJson: cardJson(),
			},
		} );
		designId = design.id;
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await deleteAllDesigns( requestUtils );
	} );

	test.beforeEach( async ( { admin, page } ) => {
		await admin.visitAdminPage(
			'admin.php',
			`page=socialframe-editor&id=${ designId }`
		);
		await expect( page.locator( 'canvas.lower-canvas' ) ).toBeVisible();
		await expect( row( page, 'Card' ).first() ).toBeVisible();
	} );

	test( 'stays visible while switching tools', async ( { page } ) => {
		const tree = page.getByRole( 'tree', { name: 'Layers' } );
		await page.getByRole( 'button', { name: 'Text', exact: true } ).click();
		await expect( tree ).toBeVisible();
		await page.getByRole( 'button', { name: 'Elements' } ).click();
		await expect( tree ).toBeVisible();
		await expect( row( page, 'Title' ) ).toHaveAttribute(
			'aria-level',
			'2'
		);
		await expect( row( page, 'Artboard' ) ).toBeVisible();
	} );

	test( 'drags a layer into a frame, between its layers, and out', async ( {
		page,
	} ) => {
		await row( page, 'Note' ).dragTo( row( page, 'Sub' ), {
			targetPosition: { x: 80, y: 3 },
		} );
		expect( await childrenOf( page, 'card' ) ).toEqual( [
			'title',
			'note',
			'sub',
		] );
		await expect( row( page, 'Note' ) ).toHaveAttribute(
			'aria-level',
			'2'
		);

		// One undo step each way.
		await page.getByRole( 'button', { name: 'Undo Move layers' } ).click();
		expect( await childrenOf( page, 'card' ) ).toEqual( [
			'title',
			'sub',
		] );
		await page.getByRole( 'button', { name: /^Redo/ } ).click();
		expect( await childrenOf( page, 'card' ) ).toEqual( [
			'title',
			'note',
			'sub',
		] );

		// Out again, above the logo.
		await row( page, 'Note' ).dragTo( row( page, 'Logo' ), {
			targetPosition: { x: 80, y: 3 },
		} );
		expect( await childrenOf( page, 'card' ) ).toEqual( [
			'title',
			'sub',
		] );
		await expect( row( page, 'Note' ) ).toHaveAttribute(
			'aria-level',
			'1'
		);
	} );

	test( 'selects several layers and frames them from the menu', async ( {
		page,
	} ) => {
		await row( page, 'Logo' ).click();
		await row( page, 'Note' ).click( { modifiers: [ 'ControlOrMeta' ] } );
		await expect( row( page, 'Logo' ) ).toHaveAttribute(
			'aria-selected',
			'true'
		);
		expect(
			( await withApi( page, ( api ) => api.getSelectedIds() ) ).sort()
		).toEqual( [ 'logo', 'note' ] );

		await row( page, 'Note' ).click( { button: 'right' } );
		await page.getByRole( 'menuitem', { name: 'Create frame' } ).click();
		await expect( page.getByRole( 'menu' ) ).toBeHidden();

		const [ frame ] = ( await frameIds( page ) ).filter(
			( id ) => id !== 'card'
		);
		expect( ( await childrenOf( page, frame ) ).sort() ).toEqual( [
			'logo',
			'note',
		] );

		await page.getByRole( 'button', { name: /^Undo/ } ).click();
		expect( await frameIds( page ) ).toEqual( [ 'card' ] );
		await page.getByRole( 'button', { name: /^Redo/ } ).click();
		expect( await parentOf( page, 'logo' ) ).toBe( frame );

		await save( page, designId );
	} );

	test( 'works from the keyboard', async ( { page } ) => {
		await row( page, 'Title' ).click();
		await page.keyboard.press( 'ArrowDown' );
		await expect( row( page, 'Sub' ) ).toBeFocused();

		await page.keyboard.press( 'Alt+ArrowUp' );
		expect( await childrenOf( page, 'card' ) ).toEqual( [
			'sub',
			'title',
		] );
		await expect( row( page, 'Sub' ) ).toBeFocused();

		await page.keyboard.press( 'Shift+F10' );
		await expect(
			page.getByRole( 'menuitem', { name: 'Create frame' } )
		).toBeFocused();
		await page.keyboard.press( 'Escape' );
		await expect( page.getByRole( 'menu' ) ).toBeHidden();
		await expect( row( page, 'Sub' ) ).toBeFocused();

		// Collapse the card and step back out of it.
		await page.keyboard.press( 'ArrowLeft' );
		await expect( row( page, 'Card' ) ).toBeFocused();
		await page.keyboard.press( 'ArrowLeft' );
		await expect( row( page, 'Card' ) ).toHaveAttribute(
			'aria-expanded',
			'false'
		);
		await expect( row( page, 'Sub' ) ).toBeHidden();
	} );

	test( 'deletes from the canvas menu in one undo step', async ( {
		page,
	} ) => {
		const point = await withApi( page, ( api ) => {
			const c = api.getFabric();
			const o = c.getObjects().find( ( x ) => x.id === 'logo' );
			const vt = c.viewportTransform;
			const box = c.lowerCanvasEl.getBoundingClientRect();
			return {
				x: box.left + vt[ 4 ] + ( o.left + 10 ) * vt[ 0 ],
				y: box.top + vt[ 5 ] + ( o.top + 10 ) * vt[ 3 ],
			};
		} );
		await page.mouse.click( point.x, point.y, { button: 'right' } );
		await page.getByRole( 'menuitem', { name: 'Delete' } ).click();
		await expect( row( page, 'Logo' ) ).toHaveCount( 0 );

		await page.getByRole( 'button', { name: 'Undo Delete' } ).click();
		await expect( row( page, 'Logo' ) ).toBeVisible();
	} );

	test( 'keeps duplicated and dissolved frames, locks and hides after a reload', async ( {
		page,
		requestUtils,
	} ) => {
		const before = await frameIds( page );
		await row( page, 'Card' ).click( { button: 'right' } );
		await page.getByRole( 'menuitem', { name: 'Duplicate' } ).click();
		await expect( row( page, 'Card' ) ).toHaveCount( 2 );
		const copy = ( await frameIds( page ) ).find(
			( id ) => ! before.includes( id )
		);
		const copies = await childrenOf( page, copy );
		expect( copies ).toHaveLength( 2 );
		expect( copies ).not.toContain( 'title' );

		// The copy is selected; dissolve it and keep its layers.
		await row( page, 'Card' ).first().click( { button: 'right' } );
		await page
			.getByRole( 'menuitem', { name: 'Remove frame (keep layers)' } )
			.click();

		await row( page, 'Logo' )
			.getByRole( 'button', { name: 'Lock Logo' } )
			.click();
		await row( page, 'Logo' )
			.getByRole( 'button', { name: 'Hide Logo' } )
			.click();

		await save( page, designId );

		const design = await requestUtils.rest( {
			path: `/socialframe/v1/designs/${ designId }`,
		} );
		const objects = Object.fromEntries(
			JSON.parse( design.fabricJson ).objects.map( ( o ) => [ o.id, o ] )
		);
		// The copy's rectangle stays as a plain shape.
		expect( objects[ copy ].sfFrame ).toBeUndefined();
		for ( const id of copies ) {
			expect( objects[ id ] ).toBeDefined();
		}
		expect( objects.card.sfFrame.children ).toEqual( [ 'title', 'sub' ] );
		expect( objects.logo ).toMatchObject( {
			selectable: false,
			visible: false,
		} );

		await page.reload();
		await expect( row( page, 'Logo' ) ).toHaveClass( /is-hidden/ );
		await expect(
			row( page, 'Logo' ).getByRole( 'button', { name: 'Lock Logo' } )
		).toHaveAttribute( 'aria-pressed', 'true' );
		await expect( row( page, 'Title' ) ).toHaveCount( 2 );
		expect( await childrenOf( page, 'card' ) ).toEqual( [
			'title',
			'sub',
		] );

		const exported = page.waitForResponse(
			( res ) =>
				res
					.url()
					.includes(
						`/socialframe/v1/designs/${ designId }/export`
					) && res.request().method() === 'POST'
		);
		await page.getByRole( 'button', { name: 'Export PNG' } ).click();
		expect( ( await exported ).status() ).toBe( 201 );
	} );

	test( 'passes an axe scan wide, as a drawer and with the menu open', async ( {
		page,
	} ) => {
		expect( await axe( page, [ '.socialframe-layers' ] ) ).toEqual( [] );

		await row( page, 'Note' ).click( { button: 'right' } );
		await expect( page.getByRole( 'menu' ) ).toBeVisible();
		expect( await axe( page, [ '.socialframe-layer-menu' ] ) ).toEqual(
			[]
		);
		await page.keyboard.press( 'Escape' );

		await page.setViewportSize( { width: 900, height: 720 } );
		const tree = page.getByRole( 'tree', { name: 'Layers' } );
		await expect( tree ).toBeHidden();
		const toggle = page.getByRole( 'button', { name: 'Layers' } );
		await toggle.click();
		await expect( tree ).toBeVisible();
		await expect(
			tree
				.getByRole( 'treeitem', { selected: true } )
				.or( tree.locator( '[role="treeitem"][tabindex="0"]' ) )
				.first()
		).toBeFocused();
		expect(
			await axe( page, [
				'.socialframe-layers',
				'.socialframe-editor__icon-nav',
			] )
		).toEqual( [] );

		await page.keyboard.press( 'Escape' );
		await expect( tree ).toBeHidden();
		await expect( toggle ).toBeFocused();
		await page.setViewportSize( { width: 1280, height: 720 } );
	} );

	test( 'never deletes the artboard', async ( { page } ) => {
		const first = page
			.getByRole( 'tree', { name: 'Layers' } )
			.getByRole( 'treeitem' )
			.first();
		await first.click();
		await row( page, 'Artboard' ).click( { modifiers: [ 'Shift' ] } );
		await first.press( 'Delete' );

		await expect(
			page.getByRole( 'tree', { name: 'Layers' } ).getByRole( 'treeitem' )
		).toHaveCount( 1 );
		await expect( row( page, 'Artboard' ) ).toBeVisible();

		await page.getByRole( 'button', { name: 'Undo Delete' } ).click();
		await expect( row( page, 'Card' ).first() ).toBeVisible();
	} );
} );
