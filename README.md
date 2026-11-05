# SocialFrame

A social media graphic editor inside wp-admin that fills templates from your posts and exports PNGs to the Media Library.

SocialFrame adds a canvas editor (Fabric.js) under a SocialFrame menu in wp-admin. It reads the active theme's `theme.json` for colors and fonts, imports content from any public post onto the canvas, and exports full-size PNGs to the Media Library. Designs can be marked up as templates and filled from a post, either in the editor or from a panel in the block editor sidebar.

## Requirements

- WordPress 7.0 or later
- PHP 8.1 or later
- A theme with a `theme.json` palette and font families, if you want them in the editor. Classic themes get the WordPress default palette and no theme fonts.
- Generating and exporting happens in the browser, so the user needs a current browser with canvas support.

## Installation

1. Download `socialframe.zip` from the latest [GitHub release](https://github.com/philhoyt/SocialFrame/releases) and upload it under Plugins > Add New > Upload Plugin, or copy the `socialframe` folder to `wp-content/plugins/`.
2. Activate the plugin.
3. Open SocialFrame in the admin menu, click New Design, and choose a format.

The plugin bundles Plugin Update Checker and reads the `socialframe.zip` asset from GitHub releases, so later updates show on the Plugins screen.

If you clone the repository instead, build the JavaScript before activating:

```bash
npm install
npm run build
```

## Usage

### The editor

The canvas supports zoom, pan, fit-to-screen and keyboard shortcuts, undo and redo with a labeled history, and an autosave that runs shortly after each change. The left sidebar has six panels:

| Panel | What it does |
|---|---|
| Templates | Loads one of the six bundled starters or a template you saved |
| Text | Adds text at five size presets, Huge to Small |
| Elements | Adds rectangles, rounded rectangles, circles, triangles and lines, plus text and image layers already bound to a post field |
| Media | Inserts an image from the Media Library |
| Import Post | Searches every public post type and places a post's title, featured image, content, excerpt, terms and meta on the canvas, or creates a filled copy of a template |
| Layers | A layer tree with drag and drop into and out of frames, multi-select, a right-click menu, rename, hide and lock |

Click an object to open its properties in the right panel. What is shown depends on the object:

- Artboard: canvas format, post type assignments, content layout.
- Text: font, size, weight, style, underline, alignment, color, background, letter spacing, line height, shadow.
- Image: position, size (with aspect-ratio lock), rotation, flip, opacity, corner radius, shadow.
- Shape: fill, stroke, corner radius, position, size, rotation, flip, opacity, shadow, and canvas alignment buttons.

Formats: Instagram Post (1080 x 1080), Instagram Portrait (1080 x 1350), Instagram Story (1080 x 1920), Facebook Post (1200 x 630), Twitter / X Post (1200 x 675), LinkedIn Post (1200 x 627), Pinterest Pin (1000 x 1500), YouTube Thumbnail (1920 x 1080), YouTube Short (1080 x 1920). The New Design screen also takes a custom width and height.

### Importing from a post

Open the Import Post panel, search for a published post, tick the parts you want (title, featured image, content, excerpt, taxonomy terms, individual meta fields) and click Import to Canvas. Each item becomes its own layer.

### Template fields

A template field is a text or image layer that is filled from a post.

1. Select a layer and open Template field at the bottom of the properties panel.
2. Choose the source, for example Post title or Featured image.
3. Save the design, as a design or as a template.

The Template fields group in the Elements panel skips the first two steps: it adds a Post title, Post excerpt, Post content, Post date or Post author text, or a Featured image placeholder, already bound. For custom fields and taxonomies, add a plain layer and pick the source under Template field.

To fill a template, open Import Post in the editor, pick a post and click Create filled copy. Or hover a published post on any post list in wp-admin and click Create graphic, then pick the template. Filling creates a new design; the template is not changed.

| Field name | Fills with |
|---|---|
| `post.title` | Post title |
| `post.excerpt` | Excerpt, or the first 55 words of the content when there is none |
| `post.content` | Post content as plain text |
| `post.date` | Publish date in the site's date format |
| `post.author` | Author display name |
| `post.featured_image` | Featured image (image layers only) |
| `meta.{key}` | A public custom field; images must be Media Library attachments |
| `terms.{taxonomy}` | The post's terms in that taxonomy, comma separated |
| anything else | Only filled through the REST API's `values` |

The same name can be used on several layers, and all of them are filled. A replacement image keeps the layer's size and position and is cropped to fit, not stretched.

The `socialframe_post_field_values` filter adds or changes post-derived values:

```php
add_filter( 'socialframe_post_field_values', function ( $values, $post, $names ) {
	if ( in_array( 'price', $names, true ) ) {
		$values['price'] = '$' . get_post_meta( $post->ID, 'price', true );
	}
	return $values;
}, 10, 3 );
```

### Generating from the post editor

Assign a design with template fields to one or more post types, and each post of those types can generate its own image from the block editor.

1. Open the design, click an empty part of the canvas, and tick the post types under Post types in the properties panel.
2. Edit a post of one of those types and open the SocialFrame panel in the post sidebar.
3. Click Generate next to the design. The image is rendered in your browser, saved to the Media Library and shown in the panel.

The post's current title, excerpt and featured image are used even before you save. Content, custom fields, terms, date and author come from the last saved version.

Each post keeps one generated design and one image per assigned design. Regenerate fills the design again and replaces the image, keeping the attachment ID; any hand edits to the generated design are lost, and you are asked to confirm first. Edit in SocialFrame opens the generated design in the editor. After generating, a Share to Phone QR code opens, and the Share to Phone button reopens it.

A generated design holds content from its post, which may be a draft, so only users who can edit that post see it in the designs list.

Anyone who can edit the post and upload files can generate its images, including roles that edit only a custom post type and lack `edit_posts`. Those users get the panel but not the rest of SocialFrame, so Edit in SocialFrame is hidden for them.

Two filters narrow this. `socialframe_frame_post_types` limits which post types can be assigned:

```php
add_filter( 'socialframe_frame_post_types', fn( $types ) => array_intersect( $types, [ 'post', 'event' ] ) );
```

`socialframe_can_generate` receives `true`, the post type and the post ID (0 when the whole type is checked). It runs only after the capability checks above passed, so returning `true` never grants more:

```php
add_filter( 'socialframe_can_generate', fn( $can, $type ) => $can && current_user_can( 'publish_posts' ), 10, 2 );
```

### Frames

Templates filled from posts get content of unknown size. A frame lays its layers out so a tall photo or a long title pushes what follows instead of overlapping it.

To create one, Shift-click two or more layers and choose Create frame. The direction and gap come from where the layers sit. If one selected rectangle surrounds the others (a badge behind its text, say), it becomes the frame and its fill is the background. Frames nest: select a frame and another layer to put them side by side in a row. To lay out the whole card, click an empty part of the canvas, tick Lay out content under Content layout, then select a layer and use Frame placement > Add to frame > Artboard.

A frame (or the artboard, for its content layout) has these settings:

- Direction: vertical or horizontal.
- Gap: space between layers.
- Padding: one value, or per side.
- Align horizontally and vertically: start, centre or end.
- Width and Height: fixed, or fit the content.

A layer inside a frame has, under Frame placement:

- Width: fixed, or fill the frame.
- Maximum height for images. Framed images are always shown whole, not cropped.
- Shrink to fit and Minimum size for wrapping text.
- Move earlier, Move later and Remove from frame.

Corner radius for images is under Position. It is in canvas pixels, so corners keep their size when a frame resizes the image or a fill swaps the photo.

A frame places its layers, so dragging a layer inside one snaps it back; drag the frame to move them together. When a frame with a fixed height runs out of room, text with Shrink to fit gets smaller down to its minimum size and is then shortened with an ellipsis in exports and generated images. The design keeps the full text, and the editor outlines what does not fit in red. Rotated, skewed and grouped layers cannot be in a frame.

Layout runs in the browser: in the editor, on export, and when generating from the block editor. A design filled through `POST /designs/{id}/fill` and rendered elsewhere gets each framed image's size but not the frame positions.

### Layers

The Layers column lists every layer, top first, with each frame's layers nested under it. Below 1100px wide it becomes a drawer opened from the Layers button at the bottom of the left toolbar.

- Select: click a row. Shift-click selects a range, Cmd/Ctrl-click adds or removes one. The canvas shows the same selection.
- Drag and drop: drag rows to reorder. Drop on the middle of a frame's row to add to the end of that frame, between a frame's layers to place there, or between top-level rows to take a layer out of its frame.
- Layer menu: right-click a row or a layer on the canvas, or press Shift+F10, for Create frame, Add to frame, Remove from frame, Remove frame (keep layers), Duplicate, Bring forward, Send backward, Lock, Hide, Rename and Delete. It acts on the whole selection. Right-click an empty part of the canvas to turn the artboard's content layout on or off.
- Keyboard: arrow keys move between rows, Right and Left open and close frames, Enter selects, F2 renames, Alt+Up/Down moves a layer, Delete removes it and Cmd/Ctrl+D duplicates it.

Every action is one undo step. Locked and hidden layers stay that way after saving.

### Exporting and templates

Export PNG in the toolbar saves the image to the Media Library at the format's size and opens a Share to Phone modal with a QR code for downloading it on a phone.

Save as Template in the toolbar saves the current design as a template. Templates appear in the Templates panel for any new design.

### Permissions

Any user with `edit_posts` can open SocialFrame, see every design, and create, edit and duplicate designs. Exporting also needs `upload_files`. Users can delete their own designs; deleting someone else's needs `delete_others_posts`.

## REST API

All routes are under the `socialframe/v1` namespace and require `edit_posts`, except `/designs/{id}/export` (also `upload_files`), `DELETE /designs/{id}` (`delete_post` on that design), and `/posts/{id}/frames` and `/designs/{id}/generate` (`upload_files` plus the right to edit the source post).

| Method | Route | Description |
|---|---|---|
| GET | `/designs` | List designs (`?type=design\|template\|any`, `?has_fields=1`, `?assigned_to={post type}`) |
| POST | `/designs` | Create a design |
| GET | `/designs/{id}` | Fetch one design |
| PUT | `/designs/{id}` | Update title, canvas JSON and/or assigned `postTypes` |
| DELETE | `/designs/{id}` | Delete a design |
| POST | `/designs/{id}/export` | Export as PNG and save to the Media Library |
| POST | `/designs/{id}/duplicate` | Duplicate a design or instantiate a template |
| GET | `/templates` | List bundled and user-saved templates |
| GET | `/post-import` | Search posts across all public post types |
| GET | `/post-import/{id}` | Fetch importable data for one post |
| GET | `/designs/{id}/fields` | List a design's template fields |
| POST | `/designs/{id}/fill` | Create a new design with the fields filled |
| GET | `/posts/{id}/frames` | Designs assigned to a post's type, with that post's generated image |
| POST | `/designs/{id}/generate` | Fill a design from a post and store the post's generated image |

`POST /designs/{id}/fill` takes `post_id` (fill from a post), `values` (an object of field name to value), or both; `values` win for the same name. Text values are strings and image values are attachment IDs. An optional `title` names the new design. The response holds the new `design`, plus `filled` and `unmatched` lists of field names. An unknown name or an unusable image lands in `unmatched` instead of failing the request.

```bash
curl -X POST https://example.com/wp-json/socialframe/v1/designs/42/fill \
  -H 'Content-Type: application/json' \
  -u admin:APPLICATION_PASSWORD \
  -d '{"values": {"headline": "Spring sale", "post.featured_image": 123}}'
```

`POST /designs/{id}/generate` takes `post_id` and optional `values`. Without `imageData` it is a dry run that returns the filled `fabricJson` with its `width` and `height` for rendering. Send it again with the rendered PNG as `imageData` to store the image and the generated design; nothing is written until then.

## Development

```bash
npm install
composer install

npm start              # webpack watch
npm run build          # production build into build/

npm run lint:js        # ESLint
npm run lint:css       # Stylelint
npm run lint:php       # phpcs (also: composer lint, composer lint:fix)
composer analyse       # PHPStan

npm run test:js        # Vitest unit tests
npm run test:php       # PHPUnit (run bin/install-wp-tests.sh once first)
npm run test:e2e       # Playwright against a wp-env site on port 8889
```

`npm run env:start` brings up wp-env (PHP 8.3, current WordPress, this plugin). The E2E tests need Docker and a fresh `npm run build`; `npm run test:e2e` starts wp-env if it is not running. They cover creating, editing, saving, duplicating and exporting a design, generating from the block editor's SocialFrame panel, frames, and the Layers tree, including an axe-core scan of the Layers column and menu.

`composer install` and `composer update` copy Plugin Update Checker into `lib/`, which is what ships; `vendor/` does not.

CI runs the JS lint, Vitest and build on Node 24, and phpcs plus PHPUnit on PHP 8.1 and 8.5, on every push to `main` and every pull request.

## Releases

Bump the version in `socialframe.php` (header and `SOCIALFRAME_VERSION`), `package.json` and the readme.txt `Stable tag`, add the changelog entry to readme.txt, then push a `v`-prefixed tag:

```bash
git tag v1.3.2 && git push origin v1.3.2
```

The release workflow installs dependencies, runs `npm run build` and `npm run plugin-zip`, pulls that version's section out of the readme.txt changelog for the release notes, and attaches `socialframe.zip` and `readme.txt` to the GitHub release. Installed sites pick the zip up through the update checker.

## Limitations

- Rendering happens in the browser. There is no server-side export, so `POST /designs/{id}/fill` returns canvas JSON, not an image.
- Rotated, skewed and grouped layers cannot be placed in a frame.
- Import Post, Create graphic and `POST /designs/{id}/fill` read only published posts of public post types. Generating from the block editor works on the post being edited, including drafts.
- Uninstalling deletes every design and template and their preview images. Exported PNGs in the Media Library are kept.

## License

GPL-2.0-or-later. See [https://www.gnu.org/licenses/gpl-2.0.html](https://www.gnu.org/licenses/gpl-2.0.html).
