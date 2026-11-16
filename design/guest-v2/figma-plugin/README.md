# MyCare screens import (Figma plugin)

Builds the guest prototype's screens in Figma as native layers: light and dark, one section per page, empty states included.

1. Figma desktop app → open the UTSW-MyCare file → the page you want the screens on.
2. Menu → Plugins → Development → **Import plugin from manifest…** → pick `manifest.json` in this folder.
3. Menu → Plugins → Development → **MyCare screens import**.
4. Choose `mycare-screens.json`, click **Build screens** (about a minute).

Re-running replaces screens with the same name. To refresh after prototype changes:
`cd ../figma-export && node capture.js && node gen.js` (rewrites `mycare-screens.json`).
