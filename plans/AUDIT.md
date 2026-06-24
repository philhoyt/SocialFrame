# SocialFrame — Audit Report

**Date:** 2026-06-11
**WordPress latest stable:** 7.0
**Scanned:** 15 PHP files · 0 blocks · 41 JS/JSX files
**Branch:** `audit/2026-06-11`

> ⚠️ **Scope note (added 2026-06-11):** This audit ran on the `feat/collage-layouts`-based branch, which predated the `auto-preview` merge on `main`. After the fixes, the branch was rebased onto `main` — collage was dropped (still parked on `feat/collage-layouts`) and auto-preview was picked up. The auto-preview surface (`includes/REST/PreviewController.php`, `socialframe_preview_path` meta, `format_design()` preview fallback, and the JS preview-send path) was **scanned separately on 2026-06-11** — see the PreviewController scan below. Result: clean except one low-severity item (PRV-01).

## Summary

| Severity | Count | Open |
|----------|-------|------|
| Critical | 0     | 0    |
| Warning  | 6     | 1    |
| Info     | 5     | 0    |

_Resolved 2026-06-11: ACL-01, SEC-02, ARCH-01, STD-01, DEP-02, DEP-01. PRV-01 added from the PreviewController scan (2026-06-11)._
_Resolved 2026-06-24: TST-01, TST-02, INF-01, PRV-01. Only DEP-03 (fabric 6 → 7) remains open — intentionally deferred to its own branch because the v7 origin-default change re-renders saved designs and requires manual visual QA._

Baseline: `npm run build` passes (bundle-size warnings only). `phpcs` reports **0 errors / 0 warnings** across all 15 PHP files. No XSS, SQL injection, missing-nonce, hardcoded-secret, or debug-code findings.

---

## Status

| ID | Issue | Status |
|----|-------|--------|
| ACL-01 | REST endpoints check generic `edit_posts`, not per-post capability | ✅ Fixed |
| SEC-02 | Export writes base64 to `.png` without verifying it is a real image | ✅ Fixed |
| STD-01 | WP minimum version inconsistent across phpcs.xml / header / project.md | ✅ Fixed |
| DEP-01 | `@wordpress/dataviews` 3 major versions behind (13 → 16) | ✅ Fixed (visual QA pending) |
| DEP-02 | `@wordpress/scripts` 2 major versions behind (30 → 32) | ✅ Fixed |
| DEP-03 | `fabric` 1 major version behind (6 → 7) | open (deferred — see note) |
| TST-01 | No test suite (PHPUnit or JS) | ✅ Fixed |
| TST-02 | Security-sensitive REST controllers untested | ✅ Fixed |
| ARCH-01 | Export uses raw `file_put_contents` instead of WP_Filesystem | ✅ Fixed |
| INF-01 | Post-import exposes any published post's public meta to `edit_posts` users | ✅ Fixed |
| PRV-01 | Preview write does not explicitly verify PNG type (low risk; resize_png guards) | ✅ Fixed |

---

## Critical

None found. Output escaping, input sanitization, nonce verification, SQL safety, and secrets handling are all clean (see *Already Fixed / Clean*).

---

## Warnings

### [ACL-01] REST endpoints authorize on generic `edit_posts`, not the specific post — ✅ Fixed (2026-06-11)

> **Resolution (shared-workspace, gated):** Listing, reading, editing, exporting, and duplicating remain open at `edit_posts` (collaborative shared workspace). Deletion is now gated per-post via a new `require_delete_graphic` permission callback (`AbstractController.php:57`) that checks `current_user_can( 'delete_post', $id )` — owners delete their own designs, deleting another user's requires `delete_others_posts` (Editor+). `format_design()` now returns a `canDelete` flag (`AbstractController.php`), the DELETE route uses the new callback (`DesignsController.php:108`), and the admin UI hides the delete action for ineligible designs via `isEligible` plus surfaces failures with a `.catch` (`AdminApp.jsx`). Model documented in `readme.txt` FAQ and `.claude/rules/project.md`. Original finding below.

**File:** `includes/REST/AbstractController.php:52` (`require_edit_posts`), consumed by:
- `includes/REST/DesignsController.php:91,107` — `update_design` / `delete_design`
- `includes/REST/ExportController.php:38` — `handle_export` (writes a file + creates an attachment)
- `includes/REST/DuplicateController.php:38` — `handle_duplicate`

**Issue:** Every write/delete route uses `current_user_can( 'edit_posts' )` only. It never checks `current_user_can( 'edit_post', $id )` for the targeted design. Any user with `edit_posts` — including a **Contributor**, who cannot even publish — can read, update, delete, export, and duplicate *any* user's design, including an administrator's. This is broken access control / IDOR for the design objects.

The `readme.txt` (FAQ, line 80) documents an intentional shared-workspace model ("Any user with the `edit_posts` capability can access SocialFrame and use all editor features"), so this may be by design. But destructive cross-user actions (delete/overwrite another user's design by a lower-privilege role) are rarely the intent.

**Fix:** Decide the access model explicitly. If designs are per-user, add a per-post check in `get_graphic_post()` and the export/duplicate handlers:
```php
if ( ! current_user_can( 'edit_post', $post->ID ) ) {
    return new WP_Error( 'forbidden', __( 'You cannot edit this design.', 'socialframe' ), [ 'status' => 403 ] );
}
```
If the shared workspace is intentional, consider gating create/delete behind a stronger capability (e.g. `publish_posts` or a custom `manage_socialframe` cap) and document the decision in `project.md`.

### [SEC-02] Export writes decoded base64 to a `.png` without verifying it is an image — ✅ Fixed (2026-06-11)

> **Resolution:** `handle_export` now validates the decoded bytes with `getimagesizefromstring()` and rejects anything that is not `IMAGETYPE_PNG` before writing. The write itself moved from raw `file_put_contents()` to `wp_upload_bits()` (which also resolves ARCH-01 — see below), so WordPress now handles the path, unique filename, and extension validation. `ExportController.php:76-118`. Original finding below.

**File:** `includes/REST/ExportController.php:73-96`
**Code:** `base64_decode()` → `file_put_contents( $filepath, $binary )` with a hardcoded `.png` name.
**Issue:** On the non-thumbnail path the decoded bytes are written directly to the uploads directory with no check that they are a valid PNG (only base64 *decodability* is validated; the thumbnail path happens to validate via `imagecreatefromstring`). A user with `edit_posts` could store arbitrary bytes as a `.png`. Risk is limited (forced `.png` extension and `image/png` mime, not executable), but it bypasses the normal `wp_handle_upload` / `wp_check_filetype` safeguards.
**Fix:** Validate before writing — e.g. `if ( false === getimagesizefromstring( $binary ) ) { return new WP_Error(...); }` — or route the bytes through `wp_upload_bits()` so core handles filename/mime validation.

### [STD-01] WordPress minimum-version is inconsistent across files — ✅ Fixed (2026-06-11)

> **Resolution:** Standardized on **6.6** (the value already advertised in the plugin header and `readme.txt`). Bumped `phpcs.xml` (`minimum_supported_wp_version`) and `.claude/rules/project.md` from 6.5 to 6.6. All four sources now agree. Original finding below.

**Files:** `phpcs.xml:38` (`minimum_supported_wp_version` = `6.5`) vs. `socialframe.php:7` & `readme.txt:4` (`Requires at least: 6.6`) vs. `.claude/rules/project.md` (`WP minimum: 6.5`).
**Issue:** Three sources disagree (6.5 vs 6.6). PHPCS will check against 6.5 while the plugin advertises 6.6 as the floor.
**Fix:** Pick one floor and align all three. (`Tested up to: 6.9` is valid against stable 7.0 — within one major — so no change needed there.)

### [DEP-01] `@wordpress/dataviews` is 3 major versions behind — ✅ Fixed (2026-06-11, visual QA pending)

> **Resolution:** Bumped 13.1.0 → 16.0.0 (bundled, so the version is pinned here — not a WP runtime external). Verified against the v16 type defs that every prop `AdminApp.jsx` uses is intact: View (`type/perPage/page/search/fields/filters/sort/titleField/mediaField/layout`), Field (`getValue/render/enableSorting/enableHiding/enableGlobalSearch/elements/filterBy/type`), and Action (`isPrimary/isEligible/supportsBulk/callback`). `filterSortAndPaginate(data, view, fields)` signature unchanged. React churn nets out (v15→React 19, v16→React 18). **One breaking change touched the code:** the `isDestructive` action prop was removed with no replacement, so it was dropped from the Delete action (the `window.confirm()` still conveys intent; only the red menu styling is lost). `style.css` is still at the same path. `lint:js` + `build` pass. Committed on `chore/dataviews-16`.
>
> **⚠️ Manual visual QA still needed** (can't verify headlessly): the v14 card-layout migration to `@wordpress/ui` shifts grid spacing/typography, and the design-tokens stylesheet is no longer embedded. Load the SocialFrame admin list in wp-admin and confirm the grid thumbnails, spacing, and the (now un-tinted) Delete action look right. `wp-components` styles are already enqueued as a dependency, which should supply the base tokens.

**File:** `package.json` — declared `^13.1.0`, installed `13.1.0`, latest `16.0.0`. Used only in `src/admin/AdminApp.jsx` + the `build-style/style.css` import.
**Issue:** Low–moderate, self-contained. React churn cancels out (v15→React 19, v16→React 18, so 16.0.0 is back on React 18, compatible with `@wordpress/element`). v14 migrated card layout to `@wordpress/ui` (minor visual shifts in the grid) and stopped embedding the design-tokens stylesheet (must be included explicitly). Infinite-scroll API change is N/A (uses pagination). No custom CSS targets DataViews internals (verified), so that breakage doesn't apply.
**Fix:** Bump to 16, add the design-tokens stylesheet, verify the `view`/`fields`/`actions` props against the 16 API, and eyeball the admin grid.

### [DEP-02] `@wordpress/scripts` is 2 major versions behind — ✅ Fixed (2026-06-11)

> **Resolution:** Bumped `@wordpress/scripts` 30.27.0 → 32.4.0 (ESLint 9.39.4). Replaced `.eslintrc.js` with `eslint.config.js` (flat config) extending the wp-scripts default + browser globals. The upgrade's stricter `eslint-plugin-import` rules surfaced undeclared imports, so the `@wordpress/*` packages actually used in `src/` (`api-fetch`, `components`, `data`, `element`, `i18n`) plus `globals` were declared in `devDependencies` (externalized at build — no bundle impact). One genuine `no-unused-vars` fixed (optional catch binding in `useAutoSave.js`). The custom `webpack.config.js` and `.stylelintrc.json` needed no changes. Verified: `lint:js`, `lint:css`, `build` all pass; asset dependency extraction still emits the correct `wp-*` handles. Committed on `chore/wp-scripts-32`. Original finding below.

**File:** `package.json` — declared `^30.0.0`, installed `30.27.0`, latest `32.4.0`.
**Issue:** v32 bundles ESLint **v10** (up from v8) and `lint-js` defaults to flat config (`eslint.config.*`). The legacy `.eslintrc.js` this project uses still works as a *deprecated fallback*, so the build won't break immediately, but it should migrate to flat config. v31 also expanded `lint-js` to cover `.cjs/.mjs/.cts/.mts`, which may surface new lint errors. The custom `webpack.config.js` and `.stylelintrc.json` should be re-verified against v32. Node 22 already satisfies the v32 minimum. Not urgent — the current `.eslintrc.js` + ESLint 8.57.1 pairing is correct for wp-scripts 30.
**Fix:** When upgrading to wp-scripts 32, migrate `.eslintrc.js` to `eslint.config.js` (flat config) extending `@wordpress/eslint-plugin`, in the same PR as the bump.

### [DEP-03] `fabric` is 1 major version behind — open (deferred 2026-06-24)

> **Deferred (2026-06-24):** Reviewed the fabric v7 changelog against this codebase. The v7 payoff here is thin — text-positioning/line-height bug fixes, library-internal security hardening (text char-cache prototype-pollution + `Text.ts` ReDoS regexes), and optional multi-touch gestures — none of which this app currently depends on. The cost is the breaking `originX/originY` default flip (`left/top` → `center/center`), which shifts every object and re-renders **all already-saved designs** until normalized, plus a text-position fix that can move saved text. Because the upgrade can't be verified headlessly (it needs manual visual QA against real saved designs), it was split out of this round and parked for a dedicated branch. The remaining four open findings (TST-01, TST-02, INF-01, PRV-01) were resolved without it.

**File:** `package.json` — declared `^6.0.0`, installed `6.9.1`, latest `7.4.0`.
**Issue:** Highest-risk upgrade. fabric is the core editor dependency (`useFabricCanvas.js`, `fabricHelpers.js`, `ShadowSection.jsx`). v7 breaking changes that hit this codebase:
- **`originX`/`originY` default flips from `left`/`top` → `center`/`center`.** The code never sets an explicit origin (0 hits), so every object relies on the v6 default — under v7 all objects shift by half their size, **and every design already saved as fabric JSON re-renders misaligned** (stored-data impact).
- **Text positioning fix (BREAKING)** — saved text objects can shift on reload.
- Node 20 min: non-issue (Node 22). `getPointer→getScenePoint`, `fireRightClick`, SVG-parser/request-util removals: not used here.
**Fix:** Pin `originX:'left'`/`originY:'top'` (globally or per-factory), add a normalization step so v6-era JSON renders identically, and do manual visual QA against real saved designs. Own branch; do not bundle with DEP-01/02.

---

## Info

### [TST-01] No test suite — ✅ Fixed (2026-06-24)

> **Resolution:** Stood up both harnesses. **PHPUnit** runs against the real WordPress test suite (no Docker): `bin/install-wp-tests.sh` installs WP core + the test library against the local MySQL, `tests/bootstrap.php` loads the plugin, and `phpunit.xml.dist` wires the `tests/phpunit` suite. Runs on PHP 8.5 with PHPUnit 9.6 + `yoast/phpunit-polyfills`. **Jest** uses `wp-scripts test-unit-js` (added `jest-environment-jsdom`) covering the editor store. Scripts: `composer test`, `npm run test:php`, `npm run test:js`. 37 PHP tests / 74 assertions and 18 JS tests all green.

### [TST-02] Security-sensitive REST logic is untested — ✅ Fixed (2026-06-24)

> **Resolution:** Added integration tests dispatching real REST requests through `rest_get_server()->dispatch()` for every `socialframe/v1` route, covering exactly the regression-into-vulnerability paths:
> - **Delete capability gating (ACL-01):** owner can delete own; a different non-editor user gets 403; an editor (`delete_others_posts`) can delete another's; `canDelete` flag matches caps. (`DesignsControllerTest`)
> - **Export image validation (SEC-02):** valid PNG creates the attachment; non-image bytes and a valid JPEG are both rejected 400. (`ExportControllerTest`)
> - **Preview PNG guard (PRV-01):** valid PNG written; small valid JPEG and garbage rejected 400; delete-cleanup hook removes the file. (`PreviewControllerTest`)
> - **Fabric-JSON sanitize round-trip + dimension clamping** (`GraphicMetaTest`), **duplicate semantics** (`DuplicateControllerTest`), and **post-import meta exposure + filter** (`PostImportControllerTest`).

### [ARCH-01] Export uses raw `file_put_contents` — ✅ Fixed (2026-06-11)

> **Resolution:** Replaced with `wp_upload_bits()` as part of the SEC-02 fix. `ExportController.php:88-101`.

**Recommendation:** `ExportController.php:96` writes via `file_put_contents` (phpcs-ignored). Functional, but `wp_upload_bits()` or the `WP_Filesystem` API is more portable across hosts with restricted filesystem access and pairs naturally with the SEC-02 validation fix.

### [INF-01] Post-import exposes any published post's public meta — ✅ Fixed (2026-06-24)

> **Resolution:** Added a `socialframe_import_post_meta` filter (`PostImportController::get_post_data`) so site owners can unset specific keys or return `[]` to expose no meta at all. The default behavior is unchanged (public, non-underscore scalar meta of already-published posts — protected meta was and remains skipped), which the audit deemed acceptable; the filter turns it into an explicit, documented extension point rather than a fixed exposure. Covered by `PostImportControllerTest` (public-meta-only assertion + filter-removes-key assertion).

**Recommendation:** `PostImportController::get_post_data` returns content, excerpt, terms, and all non-underscore meta of any published post to any `edit_posts` user. Published content is already public, and underscore-prefixed (protected) meta is correctly skipped — so this is acceptable. Just be aware that any public custom field becomes readable through this endpoint.

### [PRV-01] Preview write does not explicitly verify PNG type — ✅ Fixed (2026-06-24)

> **Resolution:** Added an explicit `getimagesizefromstring()` / `IMAGETYPE_PNG` guard in `handle_preview` before `resize_png()`, mirroring the SEC-02 fix in `ExportController` — so the sub-400px early-return path can no longer write a valid non-PNG image (e.g. a small JPEG) under a `.png` name. Both controllers' guards now `@`-suppress the read-error notice `getimagesizefromstring()` emits on malformed/truncated input (handled explicitly, phpcs-ignored) to keep the debug log clean. Covered by `PreviewControllerTest::test_preview_rejects_small_jpeg`.

**File:** `includes/REST/PreviewController.php:78-98`
**Recommendation:** `handle_preview` decodes the base64 `imageData` and writes it to `socialframe/previews/sf-{id}-preview.png` — the same class of gap SEC-02 closed in `ExportController`, but materially lower risk here: the bytes always pass through `resize_png()` → `imagecreatefromstring()`, which rejects anything that is not a decodable image, so arbitrary/non-image bytes cannot be written. The only edge case is a *valid* sub-400px non-PNG image (e.g. JPEG), which hits `resize_png()`'s `$orig_w <= $max_width` early-return and is written verbatim into a `.png` file. The editor only ever sends its own PNG canvas export, so real-world exposure is negligible. Optional hardening for consistency with SEC-02: add a `getimagesizefromstring()`/`IMAGETYPE_PNG` guard, or make `resize_png()` always re-encode via `imagepng()` rather than returning the original bytes.

#### PreviewController scan — clean (2026-06-11)

Scanned separately after the rebase brought auto-preview into scope. No Critical/Warning findings. Verified clean:
- **Path traversal:** write path built from an `(int)`-cast `$id` (route-constrained to `\d+`) — safe.
- **Access model:** `require_edit_posts` on preview generation is consistent with the gated shared-workspace decision (only delete is gated; ACL-01).
- **Meta:** `socialframe_preview_path` is `show_in_rest => false` with a `sanitize_callback`, written only with a server-computed value.
- **Cleanup:** `before_delete_post` hook removes the preview file (validates post type, uses `wp_delete_file`) — no orphaned files.
- **i18n / escaping / nonce / SQL / debug code:** all clean; WPCS-clean (phpcs 16/16). JS preview-send uses nonce-protected `apiFetch`, fire-and-forget.

---

## Quick Wins

All quick wins resolved as of 2026-06-24.

---

## Already Fixed / Clean

- **Security — output escaping:** All PHP `echo` output is wrapped (`esc_html__`, `esc_url`, `wp_json_encode`); JSX auto-escapes and no `dangerouslySetInnerHTML` is used anywhere in `src/`.
- **Security — SQL injection:** No `$wpdb` usage; all queries go through `get_posts()` / `WP_Query`. No string-interpolated SQL, no direct table names.
- **Security — input sanitization:** `$_GET['id']` is run through `absint()`; REST args declare `type`/`enum`/`sanitize_callback`; meta has `sanitize_callback` on every key.
- **Security — nonce / REST auth:** REST nonce is delivered via `wp_add_inline_script` (not `wp_localize_script`) and consumed through `apiFetch.createNonceMiddleware`. No `permission_callback => '__return_true'` on any route.
- **Security — capability checks:** Every admin render callback re-checks `current_user_can( 'edit_posts' )` (`AdminPage.php:67,77`, `EditorPage.php:50`). (Granularity caveat tracked separately as ACL-01.)
- **Security — secrets & debug code:** No hardcoded keys/tokens. No `var_dump`/`print_r`/`error_log`/`dd`/`dump`. No `console.log` in `src/`.
- **Coding standards:** `phpcs` (WordPress ruleset) passes 15/15 files with zero issues. All files have an `ABSPATH`/`WP_UNINSTALL_PLUGIN` guard. No closing `?>` tags. All user-facing strings use `__()`/`esc_html__()` with the `socialframe` text domain.
- **Architecture:** CPT and post meta register on `init`. The `WP_Query` in `PostImportController` iterates `$query->posts` directly (no global loop), so `wp_reset_postdata()` is correctly unnecessary. No `query_posts()`. No direct HTTP via cURL/`file_get_contents` (the one `file_get_contents` reads bundled local template JSON, not a URL).
- **Blocks (Section D):** N/A — no `block.json` in the project; the UI is a custom React/Fabric.js app, not Gutenberg blocks.
- **Admin UI:** React mounted via `@wordpress/element` `createRoot` (not the `react` package). REST nonce wiring follows best practice. No `admin-ajax` handlers (all REST), so AJAX-specific checks are N/A.
- **Tooling:** phpcs 3.13.5 + WPCS 3.x installed; wp-scripts 30.27.0 installed; ESLint 8.57.1 with `.eslintrc.js` is the correct pairing for wp-scripts 30. `qrcode` (1.5.4) is current. No abandoned composer dev dependencies.
- **Version headers:** `Stable tag` (1.0.0) matches the plugin version; `Tested up to: 6.9` is valid against stable 7.0.

---

## Revision Log

| Date | Changes |
|------|---------|
| 2026-06-24 | Re-checked 5 open findings: 0 fixed, 5 still open, 0 deployment tasks. DEP-03 (fabric still ^6.0.0), TST-01/TST-02 (no test suite), INF-01 (post-import meta unchanged), PRV-01 (no explicit PNG guard) all unchanged. `npm run build` passes (bundle-size warnings only). Quick wins from prior round all confirmed fixed. |
| 2026-06-24 | Fixed 4 of the 5 open findings on `audit/2026-06-24`. **TST-01:** added PHPUnit (WP test suite + local MySQL, `bin/install-wp-tests.sh`, `phpunit.xml.dist`, `tests/bootstrap.php`) and Jest (`wp-scripts test-unit-js`). **TST-02:** 37 PHP integration tests across all REST controllers + meta, focused on the capability/validation paths; 18 Jest tests for the store. **INF-01:** added `socialframe_import_post_meta` filter. **PRV-01:** added an `IMAGETYPE_PNG` guard to the preview write (and hardened the matching ExportController guard against notice noise). **DEP-03** deferred (fabric v7 needs manual visual QA). phpcs 16/16, build, and full test suite all green. Info open count → 0; only DEP-03 (Warning) remains open. |
