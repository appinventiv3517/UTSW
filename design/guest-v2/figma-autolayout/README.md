# UTSW MyCare Guest – auto-layout Figma import

`guest-autolayout.json` holds 29 screens of the patient (guest) app from `../guest-flow.html` – the Nov 25 version – including every pop-up, on two pages:

- **Splash and onboarding** (5): splash, onboarding slides 1–4.
- **Home** (24): guest home; with alerts; all alerts shown; pop-ups (alert details, the menu, the menu at full length down to the Follow us brand icons and legal links, search with no recent searches yet, search with recent searches, search results); home before a visit; home at a facility – why you’re here, and each answer (an appointment, visiting someone, lab or imaging, pharmacy, I need care, just looking around / guest nearby, not now) and the Floor 2 map; place pages (café menu, lab prices); Locations; MedBlog; the MyChart tab’s sign-in page.

What this version shows: the tab bar Home, Find Care, MyChart, Favorites (MyChart opens MyChart sign-in); six quick links; Recent searches in the search sheet in place of Top searches; “Clinician” wording; Follow us as round brand icons. Wayfinding and directions screens are left out by default (`ALL=1` adds them).

Scrolling screens are exported at their full height (390 wide); screens with a pop-up are one phone tall (390 × 844), except the full-length menu, which grows to show every item.

## Import

1. In the Figma desktop app: **Plugins → Development → Import plugin from manifest…** and pick `manifest.json` in this folder.
2. Run **UTSW MyCare Guest – Auto-layout screens**, choose `guest-autolayout.json`, keep the flows checked, and select **Build screens**.
3. Each flow lands on its own page (`Guest – Home`, …), six screens a row. Running it again replaces screens with the same names.

Fonts: Inter (Regular, Medium, Semi Bold, Bold, Extra Bold). The plugin stops with a message if Inter isn’t available.

## How it’s built

- **Every frame is an auto-layout frame**, with direction, padding, spacing, alignment and Hug, Fill or Fixed sizing on each axis.
- **Absolute layers are kept to things that float in the app too**: the tab bar, sheets and their backdrops, the menu drawer, the search layer, labels and controls over the 3D map, notification dots, and touch targets pulled into padding with negative margins (a section’s “See all”). Each sits inside an auto-layout parent.
- **Text is editable Inter text** with per-word weight and color.
- **Text is measured the way Figma measures it**: the export lays out Inter without optical sizes (Figma’s Inter has none), and the plugin measures every one-line label in Figma – one that would wrap hugs its text instead.
- **CSS line tricks become real strokes**: dividers and rings the app draws with 1 px box-shadows are strokes in Figma (a shadow on an unfilled frame would be cast by its letters and blur the text). Only filled frames keep soft shadows.
- **Icons, the logo and the app icon are vectors** (the app’s Material Symbols Rounded paths, colors resolved).
- **The live 3D map is an image fill** of the sample map at 2× resolution, in a fixed frame, with its labels and controls as layers on top.
- **Layer order follows the app’s stacking (z-index)**: backgrounds and highlight pills sit under the content they belong to (the onboarding stage, the tab bar’s selected pill).

## Checks

`tools/export-guest.js` drives the prototype in Chromium, turns each phone screen into a box tree (`tools/al-walk.js`) and infers auto layout from it (`tools/al-convert.js`). Every screen is laid out again with Figma’s auto-layout rules and every layer must land within 1 px of the browser (2 px for text; centered text is compared by its center). If any screen fails, nothing is written. This export: 39 of 39 screens passed.

To export again: `THREE=<three.min.js r128> node design/guest-v2/figma-autolayout/tools/export-guest.js` (needs Playwright; `CHROME=` for a custom Chromium, `SHOTS=<dir>` to save a browser screenshot of each screen).
