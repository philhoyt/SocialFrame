# Plan: Auto Preview on Save

**Date:** 2026-05-19
**Plugin:** socialframe v1.0.0
**Semver impact:** minor → next version: 1.1.0
**Status:** in progress

## Idea

When a user saves a design in the editor (via auto-save or the manual Save button), automatically generate and store a 400px-wide preview thumbnail — without requiring an explicit Export PNG. This preview populates the thumbnail in the admin listing grid for every design, not just ones that have been exported.

## Scope

### In Scope
- New REST endpoint `POST /designs/:id/preview` that accepts a base64 PNG, resizes it to 400px wide, writes it to the uploads directory at a fixed per-design path (so overwrites are idempotent), and stores the relative path in `socialframe_preview_path` post meta.
- `format_design()` updated to fall back to the derived preview URL when no full export attachment exists (`socialframe_image_id === 0`).
- `socialframe_preview_path` meta key registered in `GraphicMeta`.
- Preview file cleaned up when a design post is deleted (hook on `before_delete_post`).
- JS sends the preview after each successful auto-save, fire-and-forget (no error surfacing to the user).
- Manual Save button also triggers a preview send.
- `resize_png()` moved from `private` in `ExportController` to `protected` in `AbstractController` so `PreviewController` can inherit it.

### Out of Scope
- Storing the preview as a Media Library attachment (this would pollute the library with files the user didn't create).
- Preview for template designs (same code path, will work automatically, but not separately tested).
- Regenerating previews for existing designs that have never been opened after this feature ships.
- A UI control to manually refresh the preview.
- Per-design preview width setting.

### Acceptance Criteria
- [ ] A new design with no export shows a thumbnail in the admin grid within 2 seconds of first save.
- [ ] The preview updates after subsequent saves reflect changes to the canvas.
- [ ] After a design is deleted, the preview PNG file no longer exists on disk.
- [ ] A design that has been exported continues to show the export image as its thumbnail (export takes precedence over preview in `thumbnailUrl`).
- [ ] Preview generation failure does not surface an error to the user and does not block saving.

## WordPress Surface Area

**PHP / Server**
- New class `SocialFrame\REST\PreviewController` — `POST /designs/:id/preview`
- New post meta key `socialframe_preview_path` (string, relative path from uploads basedir)
- `resize_png()` promoted from `private ExportController` → `protected AbstractController`
- New `before_delete_post` action hook in `PreviewController` or `Plugin` to clean up file
- No new capabilities; inherits `require_edit_posts()` from `AbstractController`

**Admin UI**
- No UI changes; `thumbnailUrl` fallback in `format_design()` means the existing grid renders the preview automatically

**JavaScript / CSS**
- New helper `sendPreview( toDataURL, designId, apiFetch )` in `exportHelpers.js`
- `useAutoSave` gains an optional third parameter `toDataURL`; calls `sendPreview` after a successful PUT
- `Header/index.jsx` passes `fabric.toDataURL` as the third arg to `useAutoSave`

**No new npm or Composer dependencies required.**

## Tasks

### PHP Backend
- [ ] Promote `resize_png()` from `private` in `ExportController` to `protected` in `AbstractController` (copy the method body, update both files)
- [ ] Register `socialframe_preview_path` meta in `GraphicMeta::register_meta()` — type `string`, sanitize with `sanitize_text_field`
- [ ] Create `includes/REST/PreviewController.php` — `POST /designs/:id/preview` endpoint:
  - Validates post exists and is `socialframe_graphic`
  - Decodes base64 PNG from `imageData` param
  - Calls `$this->resize_png()` at 400px
  - Ensures `{uploads_basedir}/socialframe/previews/` directory exists (`wp_mkdir_p`)
  - Writes to `socialframe/previews/sf-{id}-preview.png` (fixed filename, overwrites)
  - Updates `socialframe_preview_path` meta with the relative path
  - Returns `{ previewUrl: string }`
- [ ] Register `PreviewController` in `Plugin::boot()`
- [ ] Add `before_delete_post` hook (in `PreviewController::register()`) that reads `socialframe_preview_path`, resolves to absolute path, and calls `wp_delete_file()`
- [ ] Update `AbstractController::format_design()` to build `thumbnailUrl` from preview path as fallback when `socialframe_image_id === 0`:
  ```php
  $preview_path = get_post_meta( $post->ID, 'socialframe_preview_path', true );
  $preview_url  = $preview_path
      ? wp_upload_dir()['baseurl'] . '/' . $preview_path
      : '';
  'thumbnailUrl' => $image_id
      ? wp_get_attachment_url( $image_id )
      : $preview_url,
  ```

### JavaScript
- [ ] Add `sendPreview( toDataURL, designId, apiFetch )` to `exportHelpers.js` — calls the preview endpoint fire-and-forget (returns the promise but callers don't need to await it)
- [ ] Update `useAutoSave` signature: add optional `toDataURL` third parameter; after a successful `PUT`, if `toDataURL` is provided, call `sendPreview` (catch and swallow errors)
- [ ] Update `Header/index.jsx`: pass `fabric?.toDataURL` as third arg to `useAutoSave`
- [ ] Update `handleSave` in `Header/index.jsx`: after the PUT succeeds, call `sendPreview` (fire-and-forget)

### Build & Verification
- [ ] `npm run build` — confirm passes, no new bundle regressions
- [ ] `npm run lint:js` — confirm clean
- [ ] Manual test: create a new design, make a change, wait 2 seconds, go back to admin listing, confirm thumbnail appears

## Notes

**Fixed filename vs. timestamped filename:** The export controller uses a timestamped filename (`socialframe-{id}-{time}.png`) to avoid browser caching. The preview uses a fixed filename (`sf-{id}-preview.png`) so each save overwrites the same file with no orphan cleanup needed beyond deleting on post-delete. Browser caching is not a concern here since the admin listing always fetches thumbnails fresh via the REST response.

**Why not a Media Library attachment:** Creating an attachment per save would add noise to `Media > Library` that the user never explicitly created, and would require an orphan-cleanup strategy. A plain file in uploads avoids both problems.

**Export takes precedence:** When `socialframe_image_id > 0`, `thumbnailUrl` still uses the full-resolution export attachment URL. This preserves existing behavior for users who have already exported.

**`toDataURL` quality:** The preview endpoint receives the full-resolution PNG and resizes server-side using the same GD `resize_png()` already in `ExportController`. No changes are needed to how Fabric.js generates the data URL on the client side.

**`DuplicateController` note:** The comment on line 86 of `DuplicateController.php` — "socialframe_image_id intentionally not copied — new design has no export yet" — remains accurate and correct. `socialframe_preview_path` should also NOT be copied on duplicate, for the same reason. No change needed there; the meta key is simply omitted from the duplicate copy list.
