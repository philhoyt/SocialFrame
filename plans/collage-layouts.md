# Plan: Collage Layouts

**Date:** 2026-05-19
**Plugin:** socialframe v1.0.0
**Semver impact:** minor → next version: 1.1.0
**Status:** complete

## Idea

Let users instantly drop a multi-zone photo collage onto the artboard by choosing a preset layout. Each layout divides the artboard into named rectangular zones. Clicking a zone opens the WordPress Media Library; selecting an image fills that zone (scaled to cover, clipped to the rect boundary). Zones already filled with an image work like any other canvas object — they can be moved, scaled, and deleted. Double-clicking a filled zone reopens the media picker to swap the image.

## Scope

### In Scope
- 5 preset layouts: 50/50 horizontal, 50/50 vertical, Big Left + 2 Stacked Right, 2 Stacked Left + Big Right, 3 Equal Columns
- Each layout inserts placeholder Rect zones that tile the full artboard with no gap
- Clicking a placeholder zone (or double-clicking a filled zone) opens `wp.media()` to pick an image
- Picked image fills the zone: scaled to cover, clipped to the zone rect boundary, replaces the placeholder
- Zone fill is its own undo/redo step; layout insertion is a single undo/redo step
- New "Collage" tab in the left icon nav panel

### Out of Scope
- Custom gap/gutter between zones
- Dragging to resize zone boundaries
- Saving custom layouts as presets
- Zone labels or numbering overlays
- Any backend/PHP changes — purely a frontend canvas feature

### Acceptance Criteria
- [ ] Inserting any of the 5 presets places placeholder rects that exactly tile the artboard with no overlap or gap
- [ ] Clicking a placeholder zone opens the WP Media Library picker
- [ ] Selecting an image fills the zone (cover-scaled, clipped), and the placeholder disappears
- [ ] Double-clicking a filled zone reopens the picker and replaces the image
- [ ] Each zone fill is independently undoable and redoable
- [ ] The entire layout insertion is undoable as a single step (all placeholders removed at once)

## WordPress Surface Area

**PHP / Server**
- None — this is a purely client-side canvas feature

**JavaScript / CSS**
- New `addCollageLayout(layoutKey)` function in `useFabricCanvas.js` — creates placeholder Rects for each zone, registers a single combined undo/redo step
- New `fillCollageZone(zoneRect, imageUrl)` function in `useFabricCanvas.js` — loads image via `fabric.Image.fromURL()`, computes cover scale, creates absolute-positioned `clipPath` Rect, removes placeholder, adds image, registers undo/redo
- `mouse:dblclick` event handler in `useFabricCanvas.js` — detects clicks on objects with `isCollageZone: true` or `collageZoneId` property, opens `wp.media()`, calls `fillCollageZone`
- New `CollagePanel.jsx` in `src/editor/components/ContentPanel/` — 5 preset buttons with SVG layout previews, calls `fabric.addCollageLayout(key)` via `useFabric()` context
- `CollagePanel.css` — styling for the preset grid
- `IconNav/index.jsx` — add `IconCollage` SVG and `collage` entry to `PANELS` array
- `ContentPanel/index.jsx` — add `collage: CollagePanel` to `PANEL_MAP`
- `useFabricCanvas.js` — export `addCollageLayout` and `fillCollageZone` via the returned context object

**New dependencies:** none

## Layout Definitions

```
Layout key   | Zones (x%, y%, w%, h%)
-------------|------------------------------------
split-h      | left (0,0,50,100) + right (50,0,50,100)
split-v      | top (0,0,100,50) + bottom (0,50,100,50)
big-left     | main (0,0,50,100) + top-right (50,0,50,50) + bottom-right (50,50,50,50)
big-right    | top-left (0,0,50,50) + bottom-left (0,50,50,50) + main (50,0,50,100)
thirds       | left (0,0,33.3,100) + center (33.3,0,33.3,100) + right (66.6,0,33.4,100)
```

Zones are defined as fractions of artboard width/height and converted to pixel coordinates on insert.

## Zone Fill Technique

```
1. Receive zoneRect (a Fabric Rect with isCollageZone:true)
2. Load image via fabric.Image.fromURL()
3. Compute cover scale: max(zoneW/imgW, zoneH/imgH)
4. Create clipPath Rect at same canvas position as zone, absolutePositioned:true
5. Set image: left=zone.left+zoneW/2, top=zone.top+zoneH/2, originX/Y=center,
   scaleX=scaleY=coverScale, clipPath=clipRect, collageZoneId=zone.collageZoneId
6. Remove zone placeholder, add image, setActiveObject(image), renderAll()
7. Push history: undo removes image + restores zone; redo removes zone + adds image
```

## Tasks

### JavaScript: Canvas API
- [ ] Add `COLLAGE_LAYOUTS` constant object (5 layout definitions as zone arrays) near the top of `useFabricCanvas.js`
- [ ] Add `addCollageLayout(layoutKey)` function: reads artboard dimensions, creates `fabric.Rect` for each zone with `isCollageZone:true`, `collageZoneId`, fill colour `#e8e8e8`, adds all to canvas, registers single undo/redo history step
- [ ] Add `fillCollageZone(zoneRect, imageUrl)` function: loads image, computes cover scale, creates absolute clipPath Rect, sets image properties, removes placeholder, adds image, registers undo/redo history step
- [ ] Wire `mouse:dblclick` in the existing canvas event setup block: if `target.isCollageZone` → open media picker and call `fillCollageZone`; if `target.collageZoneId` and target is an image → open media picker and call `fillCollageZone` with same zone dimensions from target
- [ ] Export `addCollageLayout` in the returned context object from `useFabricCanvas.js`

### JavaScript: UI
- [ ] Create `src/editor/components/ContentPanel/CollagePanel.jsx` — grid of 5 preset buttons, each with a small SVG diagram of the layout, calls `fabric.addCollageLayout(key)` on click
- [ ] Create `src/editor/components/ContentPanel/CollagePanel.css` — button grid styles
- [ ] Add `IconCollage` SVG component and `{ id: 'collage', icon: <IconCollage />, label: __('Collage', 'socialframe') }` to `PANELS` array in `IconNav/index.jsx`
- [ ] Add `import { CollagePanel } from './CollagePanel'` and `collage: CollagePanel` to `PANEL_MAP` in `ContentPanel/index.jsx`

### Build Verification
- [ ] Run `npm run build` — must pass with no errors
- [ ] Run `npm run lint:js` — must pass with no warnings

## Notes

- `wp.media()` is already available because `EditorPage.php` calls `wp_enqueue_media()`. No new PHP required.
- Zone rects should use `selectable: false, evented: true` initially so users cannot accidentally drag them before filling. After fill, the image is selectable like any other canvas object.
- The `thirds` layout uses `1/3` fractions — floating point. The rightmost zone should use `width = artboardW - left` to avoid a 1-pixel gap from rounding.
- On undo of a layout, remove all zone Rects with `collageLayoutId === layoutId`. Each layout insert should stamp a unique `collageLayoutId` (e.g. `Date.now()`) on all its zone rects so they can be identified as a group.
- Tests: no automated tests exist for canvas operations — flagged as TST-01 in the audit. Manual testing is the acceptance gate for this feature.
