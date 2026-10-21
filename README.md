# SocialFrame

A graphic editor that runs inside your WordPress Admin. It reads your theme's `theme.json` for colors and fonts, lets you pull content from any post directly onto the canvas, and exports full-resolution PNGs to the Media Library.

---

## Features

### Editor
- Zoom, pan, fit-to-screen, keyboard shortcuts
- Undo / redo with labeled history so you know what you're undoing
- Auto-save debounced on every change
- Export saves to the Media Library and opens a QR code modal so you can scan it on your phone

### Panels
| Panel | What it does |
|---|---|
| Templates | Load bundled starters or your own saved templates |
| Text | Five size presets — Huge down to Small |
| Elements | Rect, rounded rect, circle, triangle, line |
| Media | Pick from the Media Library |
| Import Post | Search any public post type; import title, featured image, content, excerpt, terms, and meta, or create a filled copy of a template |
| Layers | Always-visible layer tree: drag and drop into and out of frames, multi-select, right-click menu, rename, hide, lock |

### Properties Panel
Selected-object controls on the right side of the editor. What's available depends on the object type:

- **Artboard** — change the canvas format
- **Text** — font, size, weight, style, underline, alignment, color, background, letter spacing, line height, shadow
- **Image** — position, size (aspect-ratio lock), rotation, flip, opacity, shadow
- **Shape** — fill, stroke, corner radius, position, size (aspect-ratio lock), rotation, flip, opacity, shadow, plus canvas alignment shortcuts

### Theme Integration
Reads `theme.json` at runtime. Theme colors show up as swatches in color pickers; theme font families appear in the font selector. Works with any block theme that defines a palette or font families.

### Supported Formats
| Format | Dimensions |
|---|---|
| Instagram Post | 1080 × 1080 |
| Instagram Portrait | 1080 × 1350 |
| Instagram Story | 1080 × 1920 |
| Facebook Post | 1200 × 630 |
| Twitter / X Post | 1200 × 675 |
| LinkedIn Post | 1200 × 627 |
| Pinterest Pin | 1000 × 1500 |
| YouTube Thumbnail | 1920 × 1080 |
| YouTube Short | 1080 × 1920 |

---

## Requirements

- **WordPress** 6.5 or higher
- **PHP** 8.1 or higher
- A block theme with `theme.json` is recommended for full color and font integration

---

## Installation

1. Upload the `socialframe` folder to `/wp-content/plugins/`
2. Activate the plugin through **Plugins → Installed Plugins**
3. Navigate to **SocialFrame** in the admin menu
4. Click **New Design**, choose a format, and start designing

### Building from source

```bash
npm install
npm run build
```

For local development with hot-reload:

```bash
npm run start
```

### Running tests

```bash
npm run test:js    # Vitest unit tests
npm run test:php   # PHPUnit (needs bin/install-wp-tests.sh once)
npm run test:e2e   # Playwright, against a wp-env site on port 8889
```

The E2E tests need Docker. Build first (`npm run build`); `npm run test:e2e` starts wp-env if it is not running yet. They cover creating, editing, saving, duplicating and exporting a design, and generating a design from the block editor's SocialFrame panel, frames, and the Layers tree, including an axe-core accessibility scan of the Layers column and menu.

---

## Usage

### Creating a design
1. Go to **SocialFrame → New Design**
2. Enter a title and select a social media format
3. The editor opens with a blank artboard in the correct dimensions

### Adding content
- Use the **Text**, **Elements**, and **Media** panels in the left sidebar to add objects to the canvas
- Click any object to open its properties in the right panel
- Drag objects to reposition; use handles to resize and rotate

### Importing from a post
1. Open the **Import Post** panel (document icon in the sidebar)
2. Search for any published post across all post types
3. Select what to import — title, featured image, content, excerpt, taxonomy terms, or individual meta fields
4. Click **Import to Canvas** — each item is added as a separate canvas object

### Template fields
Turn a design into a template that fills itself from a post.

1. Select a text or image layer and open **Template field** at the bottom of the properties panel
2. Choose where its value comes from, for example **Post title** or **Featured image**
3. Save the design (as a design or a template)

To fill it, either:
- open **Import Post** in the editor, pick a post and click **Create filled copy**, or
- on any post list in wp-admin (Posts, Pages, or a custom post type), hover a published post and click **Create graphic**, then pick the template

Filling always creates a **new design**. The template is never changed, so one template can be reused for any number of posts.

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

The same name can be used on several layers; all of them are filled. A replacement image keeps the layer's size and position and is cropped to fit, never stretched.

Developers can add or change post-derived values with the `socialframe_post_field_values` filter:

```php
add_filter( 'socialframe_post_field_values', function ( $values, $post, $names ) {
	if ( in_array( 'price', $names, true ) ) {
		$values['price'] = '$' . get_post_meta( $post->ID, 'price', true );
	}
	return $values;
}, 10, 3 );
```

### Generating from the post editor
Assign a design with template fields to one or more post types, and every post of those types can generate its own image without leaving the block editor.

1. Open the design, click an empty part of the canvas, and tick the post types under **Post types** in the properties panel
2. Edit a post of one of those types and open the **SocialFrame** panel in the post sidebar
3. Click **Generate** next to the design. The image is rendered in your browser, saved to the Media Library and shown in the panel

The post's current title, excerpt and featured image are used even before you save. Other fields (content, custom fields, terms, date, author) come from the last saved version.

Each post has one generated design and one image per assigned design. **Regenerate** fills the same design again and replaces its image, keeping the Media Library attachment ID. Changes made to the generated design in SocialFrame are lost, and you are asked to confirm first. Click **Edit in SocialFrame** to touch up a generated design by hand.

A generated design holds content from its post, which may be a draft, so only users who can edit that post see it in the designs list.

Developers can narrow the post types offered with the `socialframe_frame_post_types` filter:

```php
add_filter( 'socialframe_frame_post_types', fn( $types ) => array_intersect( $types, [ 'post', 'event' ] ) );
```

### Frames
Templates filled from posts get content of unknown size. Frames lay layers out for you, so a tall photo or a long title pushes what follows instead of overlapping it.

**Creating frames**
1. Shift-click two or more layers and choose **Create frame**. The direction and gap are worked out from where the layers sit.
2. If one selected rectangle surrounds the others (a badge behind its text, say), it becomes the frame and its fill is the background.
3. Frames nest: select a frame and another layer to put them side by side in a row.
4. To use the whole card, click an empty part of the canvas and tick **Lay out content** under **Content layout**. Then select a layer and use **Frame placement → Add to frame → Artboard**.

**Frame settings** (select the frame, or the artboard for its content layout)
- **Direction:** vertical or horizontal.
- **Gap:** space between layers.
- **Padding:** one value, or per side.
- **Align horizontally / vertically:** start, centre or end.
- **Width / Height:** fixed, or fit the content.

**A layer in a frame** (**Frame placement**)
- **Width:** fixed, or fill the frame.
- **Maximum height** for images, which are always shown whole, never cropped.
- **Shrink to fit** and **Minimum size** for wrapping text.
- **Move earlier / later**, and **Remove from frame**.

A frame places its layers, so dragging a layer inside one snaps it back; drag the frame to move them together. When a frame with a fixed height runs out of room, text with **Shrink to fit** gets smaller down to its minimum size, then is shortened with "…" in exports and generated images. The design keeps the full text, and the editor outlines what doesn't fit in red. Rotated, skewed and grouped layers can't be in a frame.

The layout runs in the browser: in the editor, on export, and when generating from the block editor. Designs filled through `POST /designs/{id}/fill` and rendered elsewhere get each framed image's size but not the frame positions.

### Layers
The **Layers** column lists every layer, top first, with each frame's layers nested under it. Below 1100px wide it becomes a drawer opened from the **Layers** button at the bottom of the left toolbar.

- **Select:** click a row; Shift-click selects a range and Cmd/Ctrl-click adds or removes one. The canvas shows the same selection.
- **Drag and drop:** drag rows to reorder them. Drop on the middle of a frame's row to add to the end of that frame, between a frame's layers to place them there, or between top-level rows to take them out of their frame.
- **Layer menu:** right-click a row or a layer on the canvas, or press Shift+F10, for **Create frame**, **Add to frame**, **Remove from frame**, **Remove frame (keep layers)**, **Duplicate**, **Bring forward**, **Send backward**, **Lock**, **Hide**, **Rename** and **Delete**. It acts on the whole selection. Right-click an empty part of the canvas to turn the artboard's content layout on or off.
- **Keyboard:** arrow keys move between rows, Right and Left open and close frames, Enter selects, F2 renames, Alt+Up/Down moves a layer, Delete removes it and Cmd/Ctrl+D duplicates it.

Every action is one undo step. Locked and hidden layers stay that way after saving.

### Exporting
1. Click **Export PNG** in the top-right toolbar
2. The image is saved to the WordPress Media Library at full resolution
3. A **Share to Phone** modal appears with a QR code — scan it to download directly to your phone's Camera Roll

### Templates
- Click **Save as Template** in the toolbar to save the current design as a reusable template
- Templates appear in the **Templates** panel for any future design

---

## REST API

All endpoints are under the `socialframe/v1` namespace and require the `edit_posts` capability.

| Method | Route | Description |
|---|---|---|
| GET | `/designs` | List designs (`?type=design\|template\|any`, `?has_fields=1`, `?assigned_to={post type}`) |
| POST | `/designs` | Create a new design |
| GET | `/designs/{id}` | Fetch a single design |
| PUT | `/designs/{id}` | Update title, canvas JSON and/or assigned `postTypes` |
| DELETE | `/designs/{id}` | Delete a design |
| POST | `/designs/{id}/export` | Export as PNG, save to Media Library |
| POST | `/designs/{id}/duplicate` | Duplicate a design or instantiate a template |
| GET | `/templates` | List bundled and user-saved templates |
| GET | `/post-import` | Search posts across all public post types |
| GET | `/post-import/{id}` | Fetch importable data for a single post |
| GET | `/designs/{id}/fields` | List a design's template fields |
| POST | `/designs/{id}/fill` | Create a new design with the fields filled |
| GET | `/posts/{id}/frames` | Designs assigned to a post's type, with that post's generated image |
| POST | `/designs/{id}/generate` | Fill a design from a post and store the post's generated image |

`POST /designs/{id}/fill` takes `post_id` (fill from a post), `values` (an object of field name to value), or both; `values` win for the same name. Text values are strings and image values are attachment IDs. An optional `title` names the new design. The response holds the new `design`, plus `filled` and `unmatched` lists of field names; an unknown name or an unusable image is reported in `unmatched` rather than failing the request.

```bash
curl -X POST https://example.com/wp-json/socialframe/v1/designs/42/fill \
  -H 'Content-Type: application/json' \
  -u admin:APPLICATION_PASSWORD \
  -d '{"values": {"headline": "Spring sale", "post.featured_image": 123}}'
```

`POST /designs/{id}/generate` takes `post_id` and optional `values`, and needs `upload_files` plus permission to edit the post. Without `imageData` it is a dry run that returns the filled `fabricJson` and its `width` and `height` for rendering. Send it again with the rendered PNG as `imageData` to store the image and the generated design; nothing is written until then.

---

## License

GPL-2.0-or-later — see [https://www.gnu.org/licenses/gpl-2.0.html](https://www.gnu.org/licenses/gpl-2.0.html)
