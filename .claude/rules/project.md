---
paths:
  - "**/*.php"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.scss"
  - "**/*.css"
  - "**/block.json"
  - "**/composer.json"
  - "**/package.json"
---
# Project: SocialFrame

- Slug: `socialframe`
- Text domain: `socialframe`
- PHP minimum: 8.1
- WP minimum: 6.6
- Distribution: GitHub releases via Plugin Update Checker (bundled in `lib/`). Releases are cut by pushing a `v*` tag, which runs `.github/workflows/release.yml` (build → plugin zip → GitHub release). Update checks point at `github.com/philhoyt/SocialFrame` and use release assets.
- Main file: `socialframe.php`
- Version constant: `SOCIALFRAME_VERSION`

## Access model

Designs are a **shared workspace**: any user with `edit_posts` can list, view, create, edit, export, and duplicate every design. Deletion is the one gated action — it uses the `delete_post` meta capability (`require_delete_graphic` in `AbstractController`), so owners can delete their own designs and deleting another user's design requires `delete_others_posts` (Editor+). `format_design()` exposes a `canDelete` flag so the admin UI hides the delete action accordingly.

## Testing

- **PHP (integration):** `composer test` (or `npm run test:php`) runs PHPUnit against the real WordPress test suite. First-time setup: `bin/install-wp-tests.sh socialframe_tests root '' localhost latest` (needs a running local MySQL and `svn`). Tests live in `tests/phpunit/`, extend `WP_UnitTestCase` / the shared `RestTestCase`, and dispatch real REST requests. Runs on PHP 8.5 with PHPUnit 9.6 + `yoast/phpunit-polyfills`.
- **JS (unit):** `npm run test:js` runs `wp-scripts test-unit-js` (Jest). Store tests live in `src/editor/store/test/`.
- Tests and `bin/` are excluded from the plugin zip via the `files` whitelist in `package.json`; phpcs scans production code only (`includes/`, `socialframe.php`, `uninstall.php`).
