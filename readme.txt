=== SocialFrame ===
Contributors:      philhoyt
Tags:              social media, graphics, editor, canvas, design
Requires at least: 7.0
Tested up to:      7.1
Stable tag:        1.2.0
Requires PHP:      8.1
License:           GPL-2.0-or-later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html

A graphic editor that runs inside your WordPress Admin.

== Description ==

A graphic editor that runs inside your WordPress Admin. It reads your theme's theme.json for colors and fonts, lets you pull content from any post directly onto the canvas, and exports full-resolution PNGs to the Media Library.

**Key Features**

* Zoom, pan, fit-to-screen, keyboard shortcuts
* Undo / redo with labeled history so you know what you're undoing
* Auto-save debounced on every change
* Export saves to the Media Library and opens a QR code modal so you can scan it on your phone
* Reads theme.json at runtime — theme colors show up as swatches, theme fonts appear in the font selector

**Panels**

* Templates — load bundled starter templates or your own saved templates
* Text — add text at five size presets (Huge, Extra Large, Large, Medium, Small)
* Elements — add shapes (rectangle, rounded rectangle, circle, triangle, line) and template fields that are already bound to a post's title, excerpt, content, date, author or featured image
* Media — insert images from the WordPress Media Library
* Import Post — search all public post types and import title, featured image, content, excerpt, taxonomy terms, and meta fields directly onto the canvas
* Layers — an always-visible layer tree with drag and drop into and out of frames, multi-select, a right-click menu, rename, hide, and lock

**Template fields**

Mark any text or image layer as a template field, such as Post title, Featured image, a custom field or a taxonomy, or add a ready-bound Post title text or Featured image placeholder from the Elements panel. Then create a graphic from any published post, either from the editor's Import Post panel or from the Create graphic link on the Posts, Pages or custom post type list. Each fill creates a new design, and the template is left as it was. Replacement images keep their layer's size and are cropped to fit.

**Generate from the post editor**

Assign a design with template fields to post types such as Posts or Pages. Each post of those types then gets a SocialFrame panel in the block editor sidebar, where Generate renders the design with that post's title, excerpt, featured image and other fields and saves it to the Media Library. Regenerate replaces the image in place, and Edit in SocialFrame opens the generated design for touch-ups.

**Supported Formats**

* Instagram Post (1080 × 1080)
* Instagram Portrait (1080 × 1350)
* Instagram Story (1080 × 1920)
* Facebook Post (1200 × 630)
* Twitter / X Post (1200 × 675)
* LinkedIn Post (1200 × 627)
* Pinterest Pin (1000 × 1500)
* YouTube Thumbnail (1920 × 1080)
* YouTube Short (1080 × 1920)

== Installation ==

1. Upload the `socialframe` folder to the `/wp-content/plugins/` directory.
2. Activate the plugin through the Plugins menu in WordPress.
3. Navigate to SocialFrame in the admin menu.
4. Click New Design, choose a social media format, and start creating.

**Building from source**

If installing from source, build the JavaScript assets before activating:

    npm install
    npm run build

== Frequently Asked Questions ==

= What formats are supported? =

SocialFrame includes nine presets covering the most common social platforms: Instagram (Post, Portrait, Story), Facebook Post, Twitter/X Post, LinkedIn Post, Pinterest Pin, YouTube Thumbnail, and YouTube Short.

= Do my theme colors and fonts appear in the editor? =

Yes. SocialFrame reads your active theme's theme.json at runtime and populates the color swatches and font family selector with your theme's palette and font families. A block theme with theme.json is recommended for full integration.

= Where are exported images saved? =

Exported PNGs are saved as attachments in the WordPress Media Library and linked back to the design. The export modal shows a QR code you can scan with a phone to download the image directly to your Camera Roll.

= Can I reuse designs as templates? =

Yes. Click Save as Template in the editor toolbar to save a design as a reusable template. It will appear in the Templates panel for any future design.

= What user role is required? =

Any user with the edit_posts capability can access SocialFrame, view all designs, and use every editor feature, including creating, editing, exporting, and duplicating. Designs are a shared workspace. Deleting a design you did not create requires the delete_others_posts capability (Editor role and above); you can always delete your own designs.

= How do I make a graphic for every post from one template? =

Select a text or image layer, open Template field in the properties panel, and choose a source such as Post title or Featured image. Or add a ready-bound field, such as Post title or a Featured image placeholder, from Template fields in the Elements panel. Save the design. Then click Create graphic under any published post in the post list and pick that design. A new, filled design opens in the editor.

= Can I generate the image while writing a post? =

Yes. Open a design with template fields, click an empty part of the canvas, and tick the post types under Post types. Posts of those types get a SocialFrame panel in the block editor sidebar with a Generate button for each assigned design. Unsaved changes to the title, excerpt and featured image are used. The image is saved to the Media Library, and Regenerate replaces it.

== Screenshots ==

1. The SocialFrame editor showing the canvas, sidebars, and header toolbar.
2. The Import Post panel — search and import content from any post type.
3. The Share to Phone modal with QR code after exporting a PNG.
4. The admin designs list built with WordPress DataViews.

== Changelog ==

= 1.2.0 =
* Add: Frames. Lay layers out with a direction, padding, gap and alignment, nest frames for rows, and let the artboard lay out the card. Framed images are shown whole at their own aspect ratio, and text set to shrink fits its frame, then is shortened with "…" in exports.
* Add: The Layers panel is now an always-visible column (a drawer on narrow screens) with frames nested as a tree. Drag layers to reorder them or move them into and out of frames, Shift- or Cmd-click to select several, and right-click a layer in the tree or on the canvas for Create frame, Add to frame, Remove from frame, Duplicate, Lock, Hide, Rename and Delete.
* Add: Corner radius for images. The corners keep their size when a frame resizes the image or a template fill swaps the photo.
* Add: Share to Phone in the block editor's SocialFrame panel. Generating or regenerating an image opens the QR code, and the panel can reopen it.
* Fix: Locked layers stay locked after saving and reloading.

= 1.1.0 =
* Security: Post import and template fills only read published posts of public post types that you can read, and never expose password-protected content you cannot edit.
* Security: Exporting to the Media Library now requires the Upload Files capability.
* Security: Preview images get unguessable file names, and deleting a design can no longer remove files outside its own preview folder.
* Add: Template fields. Mark text and image layers to be filled from a post's title, excerpt, content, date, author, featured image, custom fields or terms. Filling always creates a new design and leaves the template unchanged.
* Add: Create graphic link on Posts, Pages and custom post type lists, and Create filled copy in the Import Post panel.
* Add: Assign designs to post types and generate them from a SocialFrame panel in the block editor sidebar. Each post keeps one generated image per design, and Regenerate replaces it in place.
* Add: Custom canvas sizes on the New Design screen.
* Add: REST endpoints `GET /designs/{id}/fields`, `POST /designs/{id}/fill`, `GET /posts/{id}/frames` and `POST /designs/{id}/generate`, new filters on `GET /designs`, and the `socialframe_post_field_values` and `socialframe_frame_post_types` filters.
* Change: Requires WordPress 7.0 or later. Tested up to 7.1.
* Change: Updated the Fabric.js canvas library to version 7. Existing designs render the same.
* Fix: Duplicating a design no longer corrupts text with quotes or line breaks, and keeps custom canvas sizes.
* Fix: Libraries with more than 100 designs or templates now list all of them.
* Fix: Undo and redo work again, and layer names survive a reload.
* Fix: Duplicated layers keep their shape type and template field.
* Fix: Saves run one at a time, so an older autosave can no longer overwrite a newer save. Failed saves now show an error.
* Fix: Saved templates get a thumbnail.
* Fix: Export PNG saves at the format's exact size on high-DPI screens instead of twice the size.
* Fix: Keyboard shortcuts no longer fire while typing or override browser zoom, and the Layers panel works with a keyboard and screen readers.
* Fix: Undo labels and generated design titles are translatable.
* Fix: Uninstalling removes every design and its preview images.

= 1.0.0 =
* Initial release.
* Nine social media format presets.
* Full canvas editor with Fabric.js.
* Text, shapes, media, templates, layers, and properties panels.
* Import Post panel with smart meta detection (images vs text).
* Export PNG with Media Library integration and Share to Phone QR code.
* Theme color and font integration via theme.json.
* Undo / redo, auto-save, and duplicate support.

== Upgrade Notice ==

= 1.1.0 =
Requires WordPress 7.0. Adds template fields, generating designs from the block editor, and security fixes for post import, export and previews.

= 1.0.0 =
Initial release — no upgrade steps required.
