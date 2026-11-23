# UTSW MyCare Admin – auto-layout Figma import

`admin-autolayout.json` holds two flows from the Admin portal, every screen and every pop-up:

- **Login & forgot password** (16 screens): log in (empty, filled, invalid credentials, password shown), forgot password (empty, filled, invalid email, link sent), create new password (empty, requirements in progress, passwords don't match, ready, password reset), link expired, logged out, session ended.
- **Admin management** (25 screens): all users (list, filters panel, role filter open, filtered, no matches, user menu), create user (empty, errors, filled, leave without creating), user details (active, invited, deactivated, your own account, unsaved changes, changes saved), pop-ups (change role, resend invitation, deactivate, deactivate with reason missing, reactivate, delete, leave without saving), and the view-only Admin role list and details.

## Import

1. In the Figma desktop app: **Plugins → Development → Import plugin from manifest…** and pick `manifest.json` in this folder.
2. Run **UTSW MyCare Admin – Auto-layout screens**, choose `admin-autolayout.json`, keep both flows checked, and select **Build screens**.
3. Each flow lands on its own page (`Admin – Login & forgot password`, `Admin – Admin management`), four screens a row. Icons are components on `Admin – Components`. Running it again replaces the screens with the same names.

Fonts: Inter (Regular, Semi Bold, Bold, Extra Bold). The plugin stops with a message if Inter isn't available.

## How it's built

- **Every frame is an auto-layout frame**, with its direction, padding, spacing, alignment and Hug, Fill or Fixed sizing on each axis. Empty boxes (a blank text field, a backdrop) are fixed-size auto-layout frames.
- **Absolute layers are kept to things that float in the browser too.** These are:
  - the show/hide password buttons and the search icon inside their fields;
  - the filter count badge;
  - the filter panel, role list, user menu and toast;
  - dialogs and their backdrops.
  All of them sit inside an auto-layout parent.
- **Text is editable Inter text**, with per-word weight, color and underline. One-line labels that would wrap if Figma measures Inter a hair wider are switched to hug their text. The plugin reports how many.
- **Icons are instances** of Material Symbols Rounded (weight 500) components, colored per use.
- Prototype-only notes (the simulated-account panel and the mock-data flag) are left out.

## Checks

The export is produced by `admin/figma-plugin/tools/export-al.js` from the live portal, and every screen is checked in two ways:

1. Its auto layout is laid out again with Figma's rules, and every layer must land within 1 px of the browser (2 px for text). If any screen fails, nothing is written.
2. The plugin is run against a stand-in for the Figma API. Every frame's direction, padding, spacing, alignment, sizing and absolute position is read back and compared with the JSON.

To export again: `node admin/figma-plugin/tools/export-al.js` with `OUT=admin/figma-autolayout/admin-autolayout.json`. The script needs Playwright.
