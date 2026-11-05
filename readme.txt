=== SocialFrame ===
Contributors:      philhoyt
Tags:              social media, graphics, editor, canvas, design
Requires at least: 7.0
Tested up to:      7.1
Stable tag:        1.3.2
Requires PHP:      8.1
License:           GPL-2.0-or-later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html

A social media graphic editor inside wp-admin that fills templates from your posts and exports PNGs to the Media Library

== Description ==

SocialFrame adds a canvas editor to wp-admin for making social media graphics. It reads the active theme's theme.json for colors and fonts, imports content from any public post onto the canvas, and exports full-size PNGs to the Media Library.

The editor has zoom, pan, fit-to-screen and keyboard shortcuts, undo and redo with a labeled history, and an autosave that runs shortly after each change. Export saves the PNG to the Media Library and shows a QR code so you can download the image on your phone.

The left sidebar has six panels:

* Templates: six bundled starter templates, plus any design you save as a template.
* Text: adds text at five size presets, from Huge to Small.
* Elements: rectangles, rounded rectangles, circles, triangles and lines, plus text and image layers already bound to a post's title, excerpt, content, date, author or featured image.
* Media: inserts images from the Media Library.
* Import Post: searches every public post type and places a post's title, featured image, content, excerpt, terms and meta fields on the canvas.
* Layers: a layer tree with drag and drop into and out of frames, multi-select, a right-click menu, rename, hide and lock.

Frames lay layers out with a direction, gap, padding and alignment, so a long title or a tall photo pushes what follows instead of overlapping it. Frames nest, and the artboard itself can lay out the whole card.

**Template fields**

Mark a text or image layer as a template field (post title, featured image, a custom field, a taxonomy and so on), or add a ready-bound layer from the Elements panel. Save the design. Then fill it from any published post, either from the Import Post panel in the editor or from the Create graphic link on the Posts, Pages and custom post type lists. Each fill creates a new design and leaves the template as it was. A replacement image keeps its layer's size and is cropped to fit.

**Generating from the post editor**

Assign a design with template fields to one or more post types. Posts of those types get a SocialFrame panel in the block editor sidebar. Generate renders the design with that post's title, excerpt, featured image and other fields and saves it to the Media Library. Regenerate replaces the image in place, and Edit in SocialFrame opens the generated design for changes by hand.

**Formats**

* Instagram Post (1080 x 1080)
* Instagram Portrait (1080 x 1350)
* Instagram Story (1080 x 1920)
* Facebook Post (1200 x 630)
* Twitter / X Post (1200 x 675)
* LinkedIn Post (1200 x 627)
* Pinterest Pin (1000 x 1500)
* YouTube Thumbnail (1920 x 1080)
* YouTube Short (1080 x 1920)

Custom sizes can be entered on the New Design screen.

== Installation ==

1. Upload the `socialframe` folder to `/wp-content/plugins/`.
2. Activate the plugin through the Plugins menu.
3. Open SocialFrame in the admin menu.
4. Click New Design, choose a format, and start adding layers.

If you install from the source repository instead of a release zip, build the JavaScript first:

    npm install
    npm run build

Updates are delivered from GitHub releases through the bundled update checker, so they appear on the Plugins screen like any other plugin update.

== Frequently Asked Questions ==

= Do my theme colors and fonts appear in the editor? =

Yes. SocialFrame reads the merged theme.json settings at runtime, so the active theme's palette shows up as color swatches and its font families appear in the font selector. A classic theme without a theme.json gets the WordPress default palette and no theme fonts.

= Where are exported images saved? =

Exported PNGs are saved as attachments in the Media Library and linked back to the design. The export modal shows a QR code you can scan with a phone to download the image.

= Can I reuse a design as a template? =

Yes. Click Save as Template in the editor toolbar. The design appears in the Templates panel for any new design.

= What user role is required? =

Any user with the edit_posts capability (Contributor and above) can open SocialFrame, see every design, and create, edit, export and duplicate designs. Exporting also needs upload_files. Designs are a shared workspace. You can always delete your own designs; deleting someone else's requires delete_others_posts (Editor and above).

Generating a post's image from the SocialFrame panel in the post editor needs upload_files and permission to edit that post. A role that edits only a custom post type, without edit_posts, can generate images for those posts but cannot open the rest of SocialFrame. The socialframe_can_generate filter can narrow this further.

= How do I make a graphic for every post from one template? =

Select a text or image layer, open Template field in the properties panel, and choose a source such as Post title or Featured image. Or add a ready-bound layer from the Template fields group in the Elements panel. Save the design. Then click Create graphic under any published post in the post list and pick that design. A new, filled design opens in the editor.

= Can I generate the image while writing a post? =

Yes. Open a design with template fields, click an empty part of the canvas, and tick the post types under Post types. Posts of those types get a SocialFrame panel in the block editor sidebar with a Generate button for each assigned design. The post's unsaved title, excerpt and featured image are used; other fields come from the last saved version. The image is saved to the Media Library, and Regenerate replaces it.

= What happens on uninstall? =

Uninstalling deletes every design and template and their preview images. Exported PNGs in the Media Library are kept.

== Screenshots ==

1. The editor with the canvas, side panels and header toolbar.
2. The Import Post panel searching across post types.
3. The Share to Phone modal with a QR code after exporting a PNG.
4. The designs list in wp-admin.

== Changelog ==

= 1.3.2 =
* Fixed update checks failing with a missing class: the update checker's Markdown and readme parsers now ship with the plugin.
* Tested against WordPress 7.1 and rebuilt with the current block editor toolchain.

= 1.3.1 =
* Fixed dashboard updates failing with "PCLZIP_ERR_BAD_FORMAT" because the plugin downloaded the release's readme.txt instead of its zip. Sites on 1.3.0 or older need to install this version once by uploading the zip; later updates work from the dashboard.

= 1.3.0 =
* Added generating from the block editor for anyone who can edit the post and upload files, including roles that edit only a custom post type and lack edit_posts. Edit in SocialFrame is hidden from users who cannot open the design editor. The socialframe_can_generate filter narrows who may generate.
* Added a Template fields group to the Elements panel with post title, excerpt, content, date and author text and a featured image placeholder, already bound to their fields.
* Fixed Regenerate adding a new Media Library item instead of replacing the existing one when another user created it.
* Fixed PHP 8.1 deprecation notices from the hidden editor page.

= 1.2.0 =
* Added frames: lay layers out with a direction, padding, gap and alignment, nest frames for rows, and let the artboard lay out the card. Framed images are shown whole at their own aspect ratio. Text set to shrink fits its frame, then is shortened with an ellipsis in exports.
* Added an always-visible Layers column (a drawer on narrow screens) with frames nested as a tree. Drag layers to reorder them or move them into and out of frames, Shift- or Cmd-click to select several, and right-click a layer for Create frame, Add to frame, Remove from frame, Duplicate, Lock, Hide, Rename and Delete.
* Added corner radius for images. Corners keep their size when a frame resizes the image or a template fill swaps the photo.
* Added Share to Phone to the block editor's SocialFrame panel. Generating or regenerating opens the QR code, and the panel can reopen it.
* Fixed locked layers unlocking after a save and reload.

= 1.1.0 =
* Security: post import and template fills now read only published posts of public post types that you can read, and never expose password-protected content you cannot edit.
* Security: exporting to the Media Library now requires the upload_files capability.
* Security: preview images get unguessable file names, and deleting a design can no longer remove files outside its own preview folder.
* Added template fields. Mark text and image layers to be filled from a post's title, excerpt, content, date, author, featured image, custom fields or terms. Filling creates a new design and leaves the template unchanged.
* Added a Create graphic link to the Posts, Pages and custom post type lists, and Create filled copy to the Import Post panel.
* Added assigning designs to post types and generating them from a SocialFrame panel in the block editor sidebar. Each post keeps one generated image per design, and Regenerate replaces it in place.
* Added custom canvas sizes on the New Design screen.
* Added REST endpoints `GET /designs/{id}/fields`, `POST /designs/{id}/fill`, `GET /posts/{id}/frames` and `POST /designs/{id}/generate`, new filters on `GET /designs`, and the `socialframe_post_field_values` and `socialframe_frame_post_types` filters.
* Changed the minimum WordPress version to 7.0. Tested up to 7.1.
* Updated the Fabric.js canvas library to version 7. Existing designs render the same.
* Fixed duplicating a design corrupting text with quotes or line breaks and losing custom canvas sizes.
* Fixed libraries with more than 100 designs or templates listing only the first 100.
* Fixed undo and redo, and layer names now survive a reload.
* Fixed duplicated layers losing their shape type and template field.
* Fixed an older autosave overwriting a newer save; saves now run one at a time and failed saves show an error.
* Fixed saved templates missing a thumbnail.
* Fixed Export PNG saving at twice the format's size on high-DPI screens.
* Fixed keyboard shortcuts firing while typing or overriding browser zoom, and made the Layers panel work with a keyboard and screen readers.
* Fixed undo labels and generated design titles not being translatable.
* Fixed uninstall leaving designs and preview images behind.

= 1.0.0 =
* Initial release.
* Nine social media format presets.
* Canvas editor built on Fabric.js.
* Text, shapes, media, templates, layers and properties panels.
* Import Post panel that tells image meta fields from text ones.
* Export PNG to the Media Library with a Share to Phone QR code.
* Theme color and font integration via theme.json.
* Undo, redo, autosave and duplicate.

== Upgrade Notice ==

= 1.1.0 =
Requires WordPress 7.0. Adds template fields, generating designs from the block editor, and security fixes for post import, export and previews.

= 1.0.0 =
Initial release. No upgrade steps required.
