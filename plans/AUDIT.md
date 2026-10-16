# SocialFrame — Audit Report

**Date:** 2026-10-16
**WordPress latest stable:** 7.1.3 (no RC/beta in the API response)
**Scanned:** 17 PHP files (+8 test files) · 0 blocks · 49 JS/JSX/CSS files under `src/`
**Branch:** `audit/2026-10-16`
**Scan mode:** single session (17 PHP files, no blocks)

> Supersedes the 2026-06-11 / 2026-06-24 report (still in git history). Every item from that report stays fixed except DEP-03 (fabric 6 → 7), which is now part of DEP-01 below.

## Summary

| Severity | Count | Open |
|----------|-------|------|
| Critical | 1 | 0 |
| Warning  | 13 | 1 (DEP-01: fabric 7 only) |
| Info     | 8 | 1 (TST-03) |

**Baseline**
- `npm run build` passes, with webpack bundle-size warnings only.
- `phpcs` (WPCS 3.4.1, upgraded from 3.3.0 for this audit) reports 0 issues.
- `wp-scripts lint-js` and `lint-style` are clean.
- Jest passes 18 of 18 tests. PHPUnit was not run during the audit; it passes 41 of 41 after the fixes.

**Verification**
- Every Critical and Warning finding was re-read and then checked by a separate read-only agent that tried to refute it.
- The Codex second-model review did not run. Codex refused the model, returning `"status":400` for `gpt-6.1-sol` on a ChatGPT account. `codex doctor` also reports that 0.163.0 is available (installed: 0.162.1).

---

## Status

| ID | Issue | Status |
|----|-------|--------|
| SEC-01 | Preview cleanup deletes an unvalidated path from user-writable meta | ✅ Fixed |
| SEC-02 | Post-import reads any published post (non-public CPTs, password-protected) | ✅ Fixed |
| SEC-03 | Export lets users without `upload_files` add media | ✅ Fixed |
| ARC-01 | Duplicate corrupts or erases Fabric JSON (missing `wp_slash`) | ✅ Fixed |
| ARC-02 | Uninstall leaves preview PNGs and trashed designs behind | ✅ Fixed |
| ARC-03 | Design/template lists silently capped at 100 | ✅ Fixed |
| ADM-01 | `core/notices` used with no renderer and no declared dependency | ✅ Fixed |
| ADM-02 | Manual save and autosave swallow errors | ✅ Fixed |
| A11Y-01 | Global keyboard shortcuts hijack inputs and browser zoom | ✅ Fixed |
| A11Y-02 | Layers panel: nested interactive, glyph-named buttons, hidden focus | ✅ Fixed |
| A11Y-03 | Toggle buttons don't expose state or a clear name | ✅ Fixed |
| STD-01 | Untranslated, concatenated user-facing strings | ✅ Fixed |
| PRF-01 | List endpoints return full Fabric JSON plus N+1 attachment lookups | ✅ Fixed |
| DEP-01 | Several `@wordpress/*` packages and `fabric` are majors behind | ⚠️ Partly fixed — fabric 7 deferred |
| STD-02 | `Tested up to: 6.9` (stable is 7.1) | ✅ Fixed |
| PRV-01 | Previews served from a predictable public URL | ✅ Fixed |
| ARC-04 | Duplicate drops custom width/height; templates drop custom size | ✅ Fixed |
| ARC-05 | Preview write uses raw `file_put_contents` | Won't fix (matches core) |
| TST-01 | No CI running lint/tests on PRs | ✅ Fixed |
| TST-02 | Duplicate test does not cover escaped JSON | ✅ Fixed |
| TST-03 | No component tests or E2E for the editor | open |
| INF-01 | Release workflow pins Node 20 | ✅ Fixed |

---

## Critical

### [SEC-01] Preview cleanup can delete arbitrary files (path traversal via post meta) — ✅ Fixed (2026-10-16)

> **Resolution:**
> - `PreviewController::preview_rel_path()` builds the path from the post ID. The preview write, the delete cleanup and `format_design()`'s preview URL all use it, and the meta now only flags that a preview exists.
> - All seven `socialframe_*` meta keys are registered with `auth_callback => '__return_false'`, so Custom Fields and `add-meta` can no longer add or edit them.
> - Regression tests are in `PreviewControllerTest` (tampered-path delete, tampered-path URL, Author meta caps).
> - Before the fix, the tampered-path test really deleted a sentinel file outside uploads, which confirms the bug in practice.

**File:** `includes/REST/PreviewController.php:134-141`, `includes/Meta/GraphicMeta.php:128-138`
**Code:**
```php
$rel_path = get_post_meta( $post_id, 'socialframe_preview_path', true );
$abs_path = wp_upload_dir()['basedir'] . '/' . $rel_path;
if ( file_exists( $abs_path ) ) { wp_delete_file( $abs_path ); }
```
**Issue:**
- `socialframe_preview_path` is not underscore-prefixed. It is registered with `sanitize_text_field`, which keeps `../`, and it has no `auth_callback`. For unprotected meta, WordPress then defaults `auth_callback` to allow.
- Core's `wp_ajax_add_meta` checks only three things: the generic `add-meta` nonce (any post edit screen with Custom Fields provides it), `edit_post`, and `add_post_meta`.
- That means an **Author** can create a design through REST, then add `socialframe_preview_path = ../../wp-config.php` to it through `admin-ajax.php?action=add-meta`.
- When the Author then deletes their own design (which `require_delete_graphic` allows), `before_delete_post` unlinks a file outside uploads. Deleting `wp-config.php` sends the site back to the install screen.
- Traced in core source (`ajax-actions.php`, `post.php::add_meta`, `wp_delete_file`). Not yet reproduced on a live site.

**Fix:** Do both of these:
1. Never trust the stored path. Rebuild it from the ID (`'socialframe/previews/sf-' . $post_id . '-preview.png'`), or check that `realpath()` of the resolved path starts with `realpath( $basedir . '/socialframe/previews/' )`.
2. Protect the key. Rename it to `_socialframe_preview_path` with a migration, or register it with `'auth_callback' => '__return_false'`. Give the other `socialframe_*` keys the same treatment so no meta can be edited through Custom Fields.

---

## Warnings

### [SEC-02] Post-import exposes non-public and password-protected posts

> **✅ Fixed (2026-10-16):** The by-ID route now requires a public, REST-visible post type and `read_post`, and hides password-protected posts from users who can't edit them. Covered by 4 tests.
**File:** `includes/REST/PostImportController.php:116-122`
**Code:** `if ( ! $post || 'publish' !== $post->post_status ) { … 404 }`
**Issue:**
- The search endpoint limits results to public, `show_in_rest` post types (`:274-286`). The by-ID endpoint does not.
- Any `edit_posts` user, including a Contributor, can fetch rendered content and public meta for any published post by ID. That covers non-public CPTs from other plugins and password-protected posts.
- `post_password_required()` is never checked.

**Fix:** Return 404 unless both checks pass:
- `in_array( $post->post_type, $this->get_public_post_types(), true )`
- `current_user_can( 'read_post', $post_id )`

Also return 404 (or omit content and excerpt) when `post_password_required( $post )` is true and the user can't `edit_post` it.

### [SEC-03] Export bypasses `upload_files`

> **✅ Fixed (2026-10-16):** Added a `require_upload_files` permission callback, and the editor hides Export PNG when `canUpload` is false. Covered by a Contributor 403 test.
**File:** `includes/REST/ExportController.php:38`, `:104-126`
**Issue:**
- The route requires only `edit_posts`, yet it writes to uploads and creates a Media Library attachment.
- Contributors don't have `upload_files`. The PNG type check limits what they can upload, but not whether they can.

**Fix:** Use a permission callback that requires `edit_posts && upload_files`. Hide the Export button in the editor when the user lacks it (pass a `canUpload` flag in `socialFrameConfig`).

### [ARC-01] Duplicating a design erases or corrupts its content — ✅ Fixed (2026-10-16)

> **Resolution:**
> - `DuplicateController` now passes the copied meta through `wp_slash()`.
> - Regression test `test_duplicate_preserves_escaped_json` covers quotes, `\n` and non-ASCII text. It failed before the fix and passes after.

**File:** `includes/REST/DuplicateController.php:78-83`
**Code:** `update_post_meta( $new_post_id, $key, $value );`
**Issue:**
- `update_metadata()` runs `wp_unslash()` on the value, and the copy is not slashed first (the create and update paths at `DesignsController.php:192,238` do slash).
- A `\"` inside the JSON makes it invalid, and that is common: it appears in any quoted font family such as `"\"Inter\", sans-serif"` and in any text containing a quote. `sanitize_fabric_json()` then stores `''`, so the duplicate is blank.
- `\n` becomes `n`, and `é` becomes `u00e9`, which corrupts multi-line and non-ASCII text.
- This also breaks template-to-design instantiation.
- Reproduced with PHP `stripslashes()`.

**Fix:** `update_post_meta( $new_post_id, $key, wp_slash( $value ) );`. Add a test with escaped content (see TST-02).

### [ARC-02] Uninstall leaves files and some posts behind

> **✅ Fixed (2026-10-16):** Uninstall now deletes designs in every status and the `socialframe/previews` directory. Covered by `UninstallTest`.
**File:** `uninstall.php:16-32`
**Issue:**
- Plugin hooks aren't loaded during uninstall, so `PreviewController::delete_preview_file` never runs. `uploads/socialframe/previews/*.png` and the directory remain.
- `post_status => 'any'` skips posts in `trash` and `auto-draft`.

**Fix:**
- Query with `'post_status' => array_keys( get_post_stati() )`.
- After deleting posts, remove the `socialframe/previews` directory with `WP_Filesystem` and `rmdir( $dir, true )`.
- Decide and document whether exported Media Library attachments stay (keeping them is reasonable).

### [ARC-03] Lists silently truncate at 100 items

> **✅ Fixed (2026-10-16):** `GET /designs` takes `page`/`per_page` and returns `X-WP-Total`/`X-WP-TotalPages`. The admin grid and Templates panel use a shared `fetchAllPages()` with unit tests. `/templates` now lists only bundled templates; user templates come from `/designs?type=template`.
**File:** `includes/REST/DesignsController.php:139`, `includes/REST/TemplatesController.php:124`; consumer `src/admin/AdminApp.jsx:206`
**Issue:** The REST list returns at most 100 posts and the admin paginates client-side. Design #101 and older never appear in All Designs. The UI gives no hint.
**Fix:** Add `page`/`per_page` args and `X-WP-Total` headers, then switch DataViews to server-side pagination. As a stopgap, at least raise the cap and show a notice when it is hit.

### [ADM-01] Editor notices never display, and the `core/notices` dependency is undeclared

> **✅ Fixed (2026-10-16):** The notices store is now imported from `@wordpress/notices`, so `wp-notices` appears in the asset dependencies, and the editor renders a `SnackbarList`.
**File:** `src/editor/components/Header/index.jsx:21-22`
**Issue:**
- `useDispatch( 'core/notices' )` passes a string store name, so dependency extraction can't add `wp-notices`. `build/editor/index.asset.php` lists no `wp-notices`.
- Nothing in `src/` renders a `SnackbarList` or `NoticeList`, so "Export failed" and "Saved as template" are never shown.
- If no other admin script registers the store, the destructuring throws and the header crashes. That happens on older WP; newer WP may load the store through the command palette. Not tested live.

**Fix:**
- Import it with `import { store as noticesStore } from '@wordpress/notices'`. This adds the dependency and makes the import explicit.
- Render `<SnackbarList>` (or `NoticeList`) in `EditorInner`, fed from `useSelect( noticesStore )`.

### [ADM-02] Save failures are invisible

> **✅ Fixed (2026-10-16):** Manual save, autosave (under a fixed notice id) and duplicate now report failures.
**File:** `src/editor/components/Header/index.jsx:71-72`, `src/editor/hooks/useAutoSave.js:40-41`
**Issue:**
- Both catch blocks are empty. A failed manual save looks the same as a successful one, apart from the dirty flag. The comment says "Errors surface via notices if needed", but no notice is created.
- Also, `handleDuplicate` in `src/admin/AdminApp.jsx:54-57` has no `.catch`.

**Fix:** After ADM-01, call `createErrorNotice()` on manual-save failure, and on autosave failure show it once rather than on every retry. Add a `.catch` → `setError` to duplicate.

### [A11Y-01] Global shortcuts hijack text editing and browser zoom

> **✅ Fixed (2026-10-16):** Shortcuts skip inputs, selects and dialogs, compare keys case-insensitively, and zoom moved to unmodified + / - / 0. `resolveShortcut()` is unit-tested.
**File:** `src/editor/hooks/useKeyboardShortcuts.js:20-73`
**Issue:**
- Undo, redo, duplicate and zoom are handled document-wide before any focus check. Ctrl/Cmd+Z in the title field undoes the canvas, not the text.
- Ctrl/Cmd `+` `-` `0` override browser zoom (WCAG 1.4.4).
- Backspace/Delete deletes the selected canvas object whenever focus isn't in an INPUT, TEXTAREA or contentEditable element, for example on a `<select>`, a button, or inside a modal.
- The redo check compares `e.key === 'z'` while Shift is held. Many browsers report `'Z'` there, so Ctrl+Shift+Z redo fails.

**Fix:**
- Skip every shortcut when focus is in an editable field or a select, or inside `.components-modal__frame`.
- Better still, scope the handler to the canvas area or bind it with `useKeyboardShortcut` from `@wordpress/compose`.
- Drop the zoom overrides or move them to unmodified keys.
- Compare `e.key.toLowerCase()`.

### [A11Y-02] Layers panel keyboard and screen-reader problems

> **✅ Fixed (2026-10-16):** The layers panel is now a plain list with a real select button per row (F2 renames, and focus returns afterwards). Buttons are labelled, the rename input is labelled, and actions show on `:focus-within` with a focus ring.
**File:** `src/editor/components/ContentPanel/LayersPanel.jsx:84-216`, `ContentPanel.css:403-414`
**Issue:**
- `role="option"` rows contain buttons, which is nested interactive content.
- Every row has `tabIndex={0}`, so there is no roving tabindex.
- Lock/hide/move/duplicate/delete buttons get their accessible name from glyphs ("🔓", "↑", "✕"). `title` is ignored when there is content.
- The rename `<input>` has no label, and rename is reachable only by double-click.
- The action buttons are `opacity: 0` unless the row is hovered or selected, so keyboard focus lands on invisible buttons in rows that aren't selected.

**Fix:**
- Use a plain list (or `role="grid"`) instead of listbox/option.
- Give each icon button an `aria-label` (or use `<Button icon label>`) and wrap the glyphs in `aria-hidden`.
- Label the input.
- Add F2/Enter to rename.
- Add `.socialframe-layers__item:focus-within .socialframe-layers__actions { opacity: 1; }`.

### [A11Y-03] Toggle buttons don't expose state or a clear name

> **✅ Fixed (2026-10-16):** B/I/U have labels, and all class-styled toggles plus the admin filter tabs expose `aria-pressed`.
**File:** `src/editor/components/PropertiesPanel/TextProperties.jsx:126-180`, `PropertiesPanel/FlipSection.jsx:17-44`, `src/admin/AdminApp.jsx:230-243`
**Issue:**
- The Bold/Italic/Underline buttons are announced as "B", "I", "U" and don't expose `aria-pressed`.
- The flip toggles and the Designs/Templates filter tabs show their active state only through a CSS class.

**Fix:**
- Add `aria-label={ __( 'Bold', 'socialframe' ) }` and `aria-pressed` to each B/I/U button.
- Add `aria-pressed` to the flip toggles.
- Use `aria-pressed`, or a `TabPanel`, for the filter tabs.

### [STD-01] Untranslated or concatenated user-facing strings

> **✅ Fixed (2026-10-16):** History labels are wrapped in `__()`, Undo/Redo tooltips use `sprintf`, and the generated titles are translatable patterns with translator comments.
**File:**
- `includes/REST/DuplicateController.php:64`: `' (Copy)'`
- `includes/REST/ExportController.php:118`: `' Thumbnail'` / `' Export'`
- `src/editor/utils/exportHelpers.js:69`: `' Template'`
- history labels like `'Bold'`, `'Italic'` and `'Flip horizontal'` (`TextProperties.jsx:140,160,175`, `FlipSection.jsx:25,39`, and similar `updateSelected` calls), shown as `Undo ${label}` at `Header/index.jsx:162-176`

**Fix:**
- Use `sprintf( __( '%s (Copy)', 'socialframe' ), $title )` and the matching patterns elsewhere, with translator comments.
- Wrap history labels in `__()` at the call site.
- Build "Undo %s" with `sprintf` instead of concatenating.

### [PRF-01] List endpoints are heavier than needed

> **✅ Fixed (2026-10-16):** List items omit `fabricJson`, and exported attachments are primed with `_prime_post_caches()`.
**File:** `includes/REST/AbstractController.php:117-138` (used by `DesignsController::get_designs`), `TemplatesController.php:138-151`
**Issue:**
- Every list item includes the full `fabricJson`, which the admin grid never uses: up to 100 full canvases per page load.
- Each item calls `wp_get_attachment_url()`, but `get_posts()` doesn't prime the attachment posts, so this is N+1.

**Fix:**
- Add a `context` arg (or a separate `format_design_summary()`) that leaves `fabricJson` out of list responses. The editor fetches the single design anyway.
- Prime with `_prime_post_caches( array_filter( $image_ids ) )` before mapping.

### [DEP-01] Outdated dependencies

> **⚠️ Partly fixed (2026-10-16):**
> - `@wordpress/scripts` is now 36. Unit tests moved to Vitest, as scripts 36 requires.
> - The `@wordpress/*` runtime packages are on their latest versions.
> - `@wordpress/dataviews` is now 17.3, the newest release whose externals core registers. 18 and later need `wp-kebab-case`, which no WP release ships.
> - DataViews 17 needs `wp-theme` (WP 7.0+), so **Requires at least is now 7.0**.
> - `fabric` 7 is still deferred because of its origin-default change.
**File:** `package.json:31-41`

| Package | Installed | Latest |
|---|---|---|
| `@wordpress/components` | 32.4.0 | 42.0.0 |
| `@wordpress/dataviews` | 13.1.0 | 20.0.0 |
| `@wordpress/element` | 6.42.0 | 9.0.0 |
| `@wordpress/scripts` | 32.4.0 | 36.1.0 |
| `fabric` | 6.9.1 | 7.4.0 |

Nothing in npm or Packagist is deprecated or abandoned.

**Issue:**
- `components` and `element` are externals at runtime, so their lag mostly affects the build and tests.
- `@wordpress/dataviews` is **bundled**. Its asset depends on `wp-private-apis`, which pairs a 13.x DataViews with WP 7.1's core components. This is the riskiest drift.
- `fabric` 7 is still deferred (the old DEP-03): its origin default changed, and saved designs need visual QA.

**Fix:** Run `/wp-compat` against 7.1 and update `@wordpress/scripts` and `dataviews` first, then QA the admin grid. Keep `fabric` 7 on its own branch.

---

## Info

### [STD-02] `Tested up to` is behind stable

> **✅ Fixed (2026-10-16):** `Tested up to: 7.1`. PHPUnit passes against WP 7.1.3.
**Recommendation:** `socialframe.php:8` and `readme.txt:5` say 6.9, while stable is 7.1.3. Header rules allow this, since it is not more than one major behind. Bump both to `7.1` after a test pass on 7.1.

### [PRV-01] Previews live at a guessable public URL

> **✅ Fixed (2026-10-16):** Preview filenames now carry a validated random token stored in protected meta. Legacy previews are removed when a preview is regenerated, and the directory has an `index.php`.
**Recommendation:** `PreviewController.php:102` writes `uploads/socialframe/previews/sf-{id}-preview.png`, which anyone who guesses IDs can fetch even though the CPT is non-public. Low risk, because exports already go to the public Media Library. Consider adding a random suffix stored in meta (combine this with the SEC-01 fix), or a `.htaccess` deny where supported.

### [ARC-04] Custom dimensions are lost on duplicate and on save-as-template

> **✅ Fixed (2026-10-16):** Duplicate copies the width and height, and save-as-template sends the artboard size (`getArtboardSize()`).
**Recommendation:** `DuplicateController.php:76` copies only JSON and format. `exportHelpers.js:59-74` sends no `width`/`height`. The result is `format: 'custom'` with 0×0, and the editor recovers the size from the artboard rect only when JSON exists. Copy `socialframe_width`/`socialframe_height`, and pass them from `saveAsTemplate`.

### [ARC-05] Raw `file_put_contents` for previews

> **Won't fix (2026-10-16):** Core's own `wp_upload_bits()` writes to uploads with `file_put_contents`. `WP_Filesystem` can need FTP credentials, which a REST request cannot provide. The code comment explains this.
**Recommendation:** `PreviewController.php:108-109` suppresses the phpcs rule. Use `WP_Filesystem` (`$wp_filesystem->put_contents`) for consistency with the old ARCH-01 fix and with non-direct filesystem hosts.

### [TST-01] No CI on pull requests

> **✅ Fixed (2026-10-16):** `.github/workflows/ci.yml` runs ESLint, Stylelint, Vitest and the build, plus phpcs and PHPUnit on PHP 8.1 and 8.5. The Composer platform is pinned to 8.1.
**Recommendation:** `.github/workflows/` has only `release.yml`. Add a PR workflow that runs phpcs, `lint-js`, `lint-style`, Jest, and PHPUnit (see `/wp-ci`).

### [TST-02] Duplicate test misses the escaping case

> **✅ Fixed (2026-10-16):** Added tests for escaped JSON, the SEC-01 traversal, the SEC-02 type, read and password checks, the SEC-03 Contributor case, pagination, PRV-01 and uninstall. PHPUnit now runs 53 tests.
**Recommendation:** `tests/phpunit/DuplicateControllerTest.php:28-33` uses `{"objects":[1]}`, which has no escapes, so ARC-01 slipped through. Add a fixture containing `\"`, `\n` and non-ASCII text. Also add tests for SEC-01 (traversal path ignored) and SEC-02 (non-public or protected post → 404).

### [TST-03] No editor component tests or E2E
**Recommendation:** Jest covers only the store reducer and selectors. A Playwright smoke test (create → edit → save → duplicate → export) would have caught ARC-01 and ADM-01.

### [INF-01] Release workflow pins Node 20

> **✅ Fixed (2026-10-16):** The release workflow now uses Node 24 LTS with checkout/setup-node v7.
**Recommendation:** `.github/workflows/release.yml` uses `node-version: '20'`. Node 20 reached end-of-life in April 2026. Move to the current LTS, checked live with `/wp-versions`.

---

## Quick Wins

1. ✅ **SEC-01:** stop trusting `socialframe_preview_path`. Rebuild the path from the post ID in `delete_preview_file()` and protect the meta keys. This takes a few lines and closes a file-deletion bug that Authors can trigger.
2. ✅ **ARC-01:** wrap the duplicate copy in `wp_slash()`. It is a one-line fix for silent data loss, plus a regression test.
3. **SEC-02 / SEC-03:** add the post-type, `read_post` and password checks to post-import, and require `upload_files` for export.

---

## Already Fixed / Clean

- **Security:**
  - All PHP output is escaped, and no JSX uses `dangerouslySetInnerHTML`.
  - Input is sanitized: `absint` on `$_GET['id']`, and typed or enum REST args.
  - The REST nonce goes through `wp_add_inline_script` and the `apiFetch` middleware.
  - No `__return_true` permission callbacks, no `$wpdb` or raw SQL, no secrets, and no debug code (one deliberate `console.warn` on a JSON load failure).
- **Coding standards:** phpcs (WPCS 3.4.1) is clean, every file has an ABSPATH or `WP_UNINSTALL_PLUGIN` guard, no closing `?>`, and text domain usage is consistent.
- **Architecture:** the CPT and meta register on `init`, every meta key has a `sanitize_callback`, there is no `query_posts`, and no direct HTTP calls.
- **Blocks (D):** N/A, since the project has no `block.json`.
- **Admin UI (E):**
  - React mounts through `@wordpress/element`.
  - Assets are gated by `$hook`.
  - Render callbacks re-check `current_user_can`.
  - There are no admin-ajax handlers.
  - The `__experimental*` component check is N/A because none are imported.
- **Performance:** assets are enqueued only on the plugin's own screens, nothing heavy runs on `init`, and no transients go uninvalidated.
- **Privacy (I):** no personal data is stored beyond core post authorship, so no exporter or eraser is needed (PRV-01 is about exposure, not collection).
- **Tooling:**
  - `eslint.config.js` is a flat config, which suits wp-scripts 32.
  - `.gitignore` does not ignore `*.md`.
  - Composer packages are all maintained.
- **Note:** `plans/` is tracked in git in this repo. The audit template assumes it is gitignored, so this report will show up as a diff.
- **Prior report:** ACL-01, SEC-02 (export PNG check), ARCH-01, STD-01, DEP-01, DEP-02, TST-01, TST-02, INF-01 and PRV-01 from 2026-06 are still fixed.

---

## Revision Log

| Date | Changes |
|------|---------|
| 2026-10-16 | Worked through the rest of the audit: fixed SEC-02/03, ARC-02/03/04, ADM-01/02, A11Y-01/02/03, STD-01/02, PRF-01, PRV-01, TST-01/02 and INF-01. Upgraded DEP-01 apart from fabric. Closed ARC-05 as won't fix. Raised Requires at least to 7.0 for DataViews 17. Open: fabric 7 (DEP-01) and E2E tests (TST-03). Checks: PHPUnit 53/53, Vitest 24/24, phpcs, ESLint and Stylelint clean, build passes. |
| 2026-10-16 | Fixed SEC-01 and ARC-01 (plus the escaped-JSON part of TST-02) with 4 regression tests. Each test was shown to fail without its fix. PHPUnit passes 41/41 and phpcs is clean. |
| 2026-10-16 | Full re-audit on `audit/2026-10-16`. Upgraded WPCS 3.3.0 → 3.4.1 (with phpcsutils 1.2.3, phpcsextra 1.5.1, phpcs 3.13.6). Found 1 Critical, 13 Warning and 8 Info. |
