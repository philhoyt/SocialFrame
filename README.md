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
| Import Post | Search any public post type; import title, featured image, content, excerpt, terms, and meta |
| Layers | Reorder, rename, hide, lock |

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
| GET | `/designs` | List designs (`?type=design\|template`) |
| POST | `/designs` | Create a new design |
| GET | `/designs/{id}` | Fetch a single design |
| PUT | `/designs/{id}` | Update title and/or canvas JSON |
| DELETE | `/designs/{id}` | Delete a design |
| POST | `/designs/{id}/export` | Export as PNG, save to Media Library |
| POST | `/designs/{id}/duplicate` | Duplicate a design or instantiate a template |
| GET | `/templates` | List bundled and user-saved templates |
| GET | `/post-import` | Search posts across all public post types |
| GET | `/post-import/{id}` | Fetch importable data for a single post |

---

## License

GPL-2.0-or-later — see [https://www.gnu.org/licenses/gpl-2.0.html](https://www.gnu.org/licenses/gpl-2.0.html)
