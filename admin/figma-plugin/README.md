# UTSW MyCare Admin – Screens (Figma plugin)

A Figma plugin that draws every UTSW MyCare Admin portal screen into a Figma file as **editable layers**, including every **empty state** and the **error states**. The screens are captured from the built portal (`admin/admin-portal.html`) on its mock data, so they match the published prototype exactly.

## Install and run

1. In the Figma desktop app: **Plugins → Development → Import plugin from manifest…** and pick `admin/figma-plugin/manifest.json`.
2. Open a design file and run **Plugins → Development → UTSW MyCare Admin – Screens**.
3. Tick the screens you want (sections can be ticked as a whole; **Only empty states** picks the empty and error states), then **Create screens**.

Each section goes on its own page (`Admin – Home Screen`, `Admin – Empty states`, …), one row of 1440 px frames per page; untick **One page per section** to put everything on one page with a row per section. Each frame is named `Section / Screen` and stores its portal route in plugin data (`route`).

## What you get

- **Frames** for every box in the UI with its fills, linear gradients, borders (per side), corner radii, drop and inner shadows, opacity and clipping. Frames are named from the HTML (for example `section.card`, `Button / Save draft`, `h1 Campaigns`).
- **Text layers** in Inter with the portal's size, weight, line height, letter spacing, color, alignment, case and underline. Form fields show their value or placeholder.
- **Images** for the Material Symbols icons (3×, transparent) and the mobile preview phone screen (2×); **vectors** for the UTSW MyCare logos.
- No auto layout: positions are absolute, exactly as rendered at 1440 px wide.

Fonts: the plugin uses **Inter** (Regular, Medium, Semi Bold, Bold, Extra Bold), which Figma includes. Small line-wrap differences are possible because Figma's Inter may be a different version from the web font.

## Screens (83)

| Section | Screens |
|---|---|
| Sign in | Sign in, multi-factor check, signed out |
| Dashboard | Dashboard, dashboard with the sidebar collapsed |
| Analytics and reporting | Home screen overview, Adoption and engagement, Search, Content, Care and wayfinding, Notifications |
| Admin management | All users, Create user, user details (active and invited), My profile |
| Home Screen | Layout (Guest, Authenticated); Campaigns, new, detail, draft; Emergency alerts, new, emergency, advisory; Quick links, new, detail; Services and resources, new, detail |
| Content and navigation | Global colors, Menu, App entry (Welcome and Onboarding previews) |
| Search configuration | Top and popular searches, Query mappings, Synonyms, Specialty mapping, Zero-result queries, Ranking |
| Audience management | Audience segments, new, detail, Segment rules, Targeting |
| Notifications | All notifications, Create, sent, scheduled |
| Wayfinding | Wayfinding files |
| Audit and versioning | Audit logs, Configuration history |
| Platform operations | Integration status, Operational monitoring |
| Administrative settings | Approved settings, Location-aware configuration |
| **Empty states** | No campaigns, alerts, quick links, services and resources, audience segments, notifications; no top or popular searches, query mappings, synonyms, specialty mappings, zero-result searches, facilities; Layout with no modules (preview: no modules visible); preview with no quick links or resource cards; History with no versions and no changes; Analytics with no sent notifications and no data for the range; Dashboard with nothing scheduled or live; a table and the users list with no matches; Access denied; Page not found |
| **Error states** | A list and the dashboard that couldn't load (simulated service error) |

## Updating the screens

The screen data is inlined in `ui.html`. After changing the portal, rebuild it and capture again:

```sh
(cd admin && npm run build)                       # React + TypeScript build → admin/admin-portal.html
node admin/figma-plugin/tools/capture.js          # all screens → admin/figma-plugin/ui.html
node admin/figma-plugin/tools/capture.js campaign  # only screens whose id contains "campaign" → ui.partial.html
```

Needs Node and Playwright with Chromium, and network access for the Inter and Material Symbols fonts. The screen list, and the data changes that produce each empty state, are at the top of `tools/capture.js`; `tools/serialize.js` turns the rendered page into the layer tree.

## Files

| File | What it is |
|---|---|
| `manifest.json` | Plugin manifest (Figma Design, dynamic page access, no network access) |
| `code.js` | Main code: builds frames, text, images and vectors from the layer tree |
| `ui.html` | Plugin window: the screen picker with the captured screens and images inlined (generated) |
| `ui.template.html` | Source of `ui.html` |
| `tools/capture.js`, `tools/serialize.js` | Capture tools |
