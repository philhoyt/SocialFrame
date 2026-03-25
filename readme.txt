=== SocialFrame ===
Contributors:      philhoyt
Tags:              social media, graphics, editor, canvas, design
Requires at least: 6.5
Tested up to:      6.8
Stable tag:        1.0.0
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
* Elements — add shapes (rectangle, rounded rectangle, circle, triangle, line)
* Media — insert images from the WordPress Media Library
* Import Post — search all public post types and import title, featured image, content, excerpt, taxonomy terms, and meta fields directly onto the canvas
* Layers — reorder, rename, hide, and lock objects

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

Any user with the edit_posts capability can access SocialFrame and use all editor features.

== Screenshots ==

1. The SocialFrame editor showing the canvas, sidebars, and header toolbar.
2. The Import Post panel — search and import content from any post type.
3. The Share to Phone modal with QR code after exporting a PNG.
4. The admin designs list built with WordPress DataViews.

== Changelog ==

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

= 1.0.0 =
Initial release — no upgrade steps required.
