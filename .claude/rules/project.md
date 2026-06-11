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
- Distribution: GitHub (no release workflow)
- Main file: `socialframe.php`
- Version constant: `SOCIALFRAME_VERSION`

## Access model

Designs are a **shared workspace**: any user with `edit_posts` can list, view, create, edit, export, and duplicate every design. Deletion is the one gated action — it uses the `delete_post` meta capability (`require_delete_graphic` in `AbstractController`), so owners can delete their own designs and deleting another user's design requires `delete_others_posts` (Editor+). `format_design()` exposes a `canDelete` flag so the admin UI hides the delete action accordingly.
