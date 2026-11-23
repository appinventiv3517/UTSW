# MyCare Admin – prototype

The UTSW MyCare 2.0 Admin Portal. All 12 modules from `handoff/admin-portal/BRIEF.md` work end to end on mock data. The Admin and the app are light only. The mobile previews follow the **UTSW MyCare Guest Flow 2** design (the stakeholder update). Planning inputs are `handoff/admin-portal/BRIEF.md` and `handoff/admin-portal/HANDOVER.md`.

**Everything runs on mock data.** Nothing connects to MyCare, Epic/MyChart, Gozio, an email service, a push provider or an analytics source. Every screen says so, and the code has no endpoints or backend URLs. The only credentials are the mock sample accounts below.

## Build

The portal is a React 18 + TypeScript (strict) app built with Vite. `npm run build` typechecks, then writes two single, self-contained files from the same source: `admin-portal.html` (the full portal, published as a claude.ai Artifact) and `dashboard.html` (Dashboard only: opens signed in as the sample Super Admin; every other page, link and user-menu action is locked and says so).

```
cd admin
npm install
npm run build      # typecheck, then admin-portal.html and dashboard.html
npm run dev        # local dev server with hot reload
```

Both files are committed beside the source. `vite-plugin-singlefile` inlines the script and styles; `vite.config.ts` inlines the `mycare-logo/` SVGs unaltered and requests a Material Symbols Rounded subset made of every glyph the code names (`<Icon name="…">`, `icon: '…'`, `glyph: '…'`, the phone app's `ICONS` map and `EXTRA_GLYPHS` comments). At run time the page loads Inter and that icon subset from Google Fonts; everything else is inline.

## What each module does

| Module | Routes | Working flows |
|---|---|---|
| Sign-in and password reset | `login`, `forgot-password`, `reset-<token>`, `signed-out`, `expired`, `denied` | Follows the Admin Login design (no SSO, no MFA): a UTSW Blue brand panel beside one card. **Log in** with email address and password (show/hide password; Log in is enabled once both are filled; one “Invalid credentials. Please try again.” message, whatever was wrong). **Forgot password** → inline check “Enter a valid email address.” → **Link sent** (the same message whether or not an account uses the address). The reset link opens **Create new password** with the four requirements turning green as they're met and a match check, then **Password reset**. A used, unknown or 30-minute-old link shows **Link expired** with Resend reset link. Idle timeout from settings, log out, access denied, and return to the requested page after logging in |
| Dashboard | `dashboard` | Quick create (alert, campaign, notification), four sample KPIs, live emergency alerts, "Right now in the app" (live guest home phone, campaign showing, alerts, layout and indoor-map versions), what's coming up in the next 30 days, and recent activity |
| Feature publishing bar | Layout, Campaigns, Emergency alerts, Quick links, Services and resources, Audience segments | Home Screen is a sidebar group again, one page per feature. Each feature's page has a slim Publishing bar with three batch actions (each button says how many items it moves) – Deploy drafts to demo, Publish demo to production, and Publish drafts directly (skips demo). Each batch lists the items it can move, all ticked; untick any to leave them out. One comment goes into each item's history. Only what the role may do is offered (Marketing: deploy only). Single items keep their full Draft/Demo/Production row, which adds Publish directly |
| Collapsible sidebar | Every page | On screens 1024px and wider, the button left of the logo collapses the sidebar to a 72px icon rail and expands it again; the choice is remembered in this browser. In the rail, each icon has a tooltip, the current section is highlighted, and a section opens as a flyout of its pages (Escape or a click outside closes it). Pages reflow to the wider space through their container queries. Below 1024px the menu button opens the sidebar as a drawer, as before |
| Several at once | every `-new` page (campaigns, alerts, quick links, services and resources cards, audience segments) | One New button. The new-item form is an accordion: one panel per item ("Campaign 1 – title", with a problem count when it has errors), the open panel drives the preview, and **Add more** at the bottom adds another, opened and focused. Remove sits on each panel header. Save N as drafts checks every item first (the first one with problems opens), then saves them all and returns to the list; one item opens its editor as before. Up to 10 at a time |
| Home layout | `home-layout` | Guest Flow 2 module set: Emergency alerts and “Welcome, search, and top searches” are pinned at the top; then Quick links, MyChart sign-in card (guest only), MedBlog, Campaign banner, Services and resources, Announcements and Your saved providers (only on devices with saved providers). Guest and Authenticated tabs: reorder by drag and drop (mouse, touch or pen), with the arrow keys on the handle, or from the handle's move menu (WCAG 2.5.7 alternative to dragging), show or hide, live preview, full lifecycle, change history with rollback. Save draft and Discard sit on the modules card; deploy and publish (or publish directly) from the page's Publishing bar. No per-layout publishing row |
| Campaigns | `home-campaigns`, `-new`, `-:id` | The Guest Flow 2 campaign card: label above the title, title, description, badge icon, button label and destination, audience, schedule (Starts: Instant or Scheduled; separate date and time). No image or facts in the new design. Ended campaigns hide themselves; the Layout row names the live campaign, and the list warns when more than one is live. Preview scrolls to the card |
| Emergency alerts | `home-alerts`, `-new`, `-:id` | Guest Flow 2 levels: **Emergency** (red banner, can’t be dismissed) or **Advisory** (white banner, patients can dismiss it). Category and category icon, title, summary, full alert, where it applies, phone number, display duration, window. Pinned above the hero; emergency before advisory, then newest; the first shows open and the rest fold under “more alerts”. List and filter by level |
| Quick links; Services and resources | `home-quick-links…`, `home-featured-cards…` | Quick links: the four MyChart tiles in a 2 × 2 grid (icon left of a two-line label), position 1–4, “Opens MyChart sign-in first”; the list warns when more than four are on. Services and resources: swipeable cards with a category label (Wayfinding, Video visits, Resources…), title, one line of help, icon and destination |
| Global colors | `content-colors` | Four approved colors with live WCAG checks; saving is blocked until every check passes. Preview of the light app |
| Menu | `content-drawer` | The Guest Flow 2 menu: Updates, Patients and visitors, About UT Southwestern, Follow us (shown as chips) and legal links. Per section: show or hide, reorder, edit, add and remove items (Inbox, Sign in to MyChart and Privacy policy are fixed). Menu preview, with hidden items optionally shown dimmed |
| App entry | `content-app-entry` | Four onboarding slides, EULA (version, text, re-accept), and the sign-in prompt: the Welcome screen (Sign in as a patient or Continue as guest) or only the MyChart sign-in card on the guest home. Preview switches between the first onboarding slide and the Welcome screen |
| Search | `search-query-mappings`, `search-synonyms`, `search-specialties`, `search-zero-results`, `search-ranking` | Editable tables with duplicate checks and a "Try a search" tester that uses unsaved edits. Zero-result queries become a synonym or mapping draft in one step. Ranking weights must total 100. **Top and popular searches** (`search-top`) sets the four Top searches under the Find Care search and the Popular searches on Find Care. Ranking’s sorts follow the design: Best match, Distance, Name A–Z, Featured (always marked) |
| Wayfinding | `wayfinding` | Choose or drop a real JSON file, or use a valid or broken sample. Progress, validation errors and warnings, save as validated, then publish to demo, publish to production, roll back, and history |
| Audiences | `audiences…`, `audiences-rules`, `audiences-targeting` | Segments with a rule builder (all or any) and conflict checks, "used by", every rule with a person tester, and targeting campaigns or alerts (saves a draft on each item) |
| Notifications | `notifications`, `-new`, `-:id` | Create and edit with validation, then schedule or send now (Admin and Super Admin), cancel a scheduled one with a reason, duplicate, delete. Choose the audience segment; every notification goes out as push and Inbox. Lock-screen preview, plus results for sent messages Status is one row (status, when, actions); a Versions card lists every save with View and Restore |
| Analytics | `analytics-*` | Home screen overview (home module click-through share) plus five categories with exactly the brief's metrics. 7, 30 or 90 days with loading and error states, metric tiles (no sparklines), line chart (hover and arrow-key crosshair, data table), and breakdowns. There is no separate analytics overview page |
| Admin management (users) | `users`, `users-new`, `users-:id` | Search and filter by role and status. Create with required, email-format and duplicate checks (simulated invitation). Edit, change role, resend invite, deactivate or reactivate, delete. You can't remove or demote yourself |
| My profile | `profile` | From the user menu (which shows the current role tag). Change your own first and last name (audited). Email, role, status and dates are read only. Change password: current password, then a new one with the same four requirements as Create new password, and a confirmation. Saved to the mock data (hashed) and audited |
| Audit and versioning | `audit`, `audit-history` | Every action with actor, time, environment, comment and a before-and-after table. Every configuration's versions with comparison and rollback where the type supports it |
| Platform operations | `platform-integrations`, `platform-monitoring` | Simulated integration status with "Run check", fetch error and latency charts, and incidents |
| Administrative settings | `admin-settings`, `admin-settings-locations` | Session timeout, default time zone, required publish comment, and the permission matrix. Location-aware facility messages with a location-card preview |

Every configuration editor shares the same lifecycle:
1. **Save draft** (Marketing can then **Request review**).
2. **Deploy to demo**, which creates a numbered version.
3. **Request changes** (a comment is required) or **Publish to production**, which only publishes what is on demo.
4. **Versions and rollback:** every editor's History card opens on **Versions** (each version, when and by whom, its comment, and whether it is on demo or in production). **View** shows what a version changes against production; **Roll back** makes a new version that copies it onto demo and production. Every configuration type supports rollback now, campaigns and alerts included (still pending confirmation). **Change history** lists the events. Notifications keep a version on every save: a draft can restore an older version (as a new version, nothing lost); a sent, scheduled or cancelled one can use an older version as a new draft.

Every publishing panel is one slim row that floats at the bottom of the window while the page scrolls and settles at the end of the page: the stage tags (draft, demo version, production version) and the actions: Save draft, Deploy to demo, Publish to production, and Publish directly (a saved draft straight to production, skipping demo; Admin and Super Admin). Confirmations list the exact changes, and leaving with unsaved edits asks first.

Tables: every table shows 8 rows a page, with numbered pages once it has more than 8. Filters sit behind one Filters button (the count shows how many are applied); the panel holds all of a table's filters and applies them together with Apply, Escape or a click outside discards, and applied filters show as removable chips above the table.

Forms: helper text sits below its field; every date-and-time value is entered as a separate Date and Time input (campaigns, alerts, notifications), and paired controls share one column gap.

Dropdowns: every select uses one dropdown design (`ui/Select.tsx`). The native select stays in the page, hidden, as the source of truth for forms and validation; a button shows the choice and opens a listbox in the top layer, so tables, cards and dialogs never clip it. Table filters are multi-select (checkboxes, an All row that clears, values within one filter combine with OR, filters combine with AND). Form fields stay single-select, since each holds one value. Keyboard: Down, Enter or Space opens; arrows, Home, End and typing move; Enter or Space picks; Escape closes.

Theme: the Admin is light only, and so is the app (Guest Flow 2: “The app UI is light-only, per the brand deck”), so the previews have no Light/Dark toggle.

## Stack decision

React 18 + TypeScript (strict) with Vite, the production-style option from HANDOVER §6.2, which replaced the earlier zero-dependency vanilla build. The output is still one static HTML file with no backend: hash routing, CSS custom properties, and mock services. Class names, element ids and behavior are the same as the vanilla build, so the stylesheets and the Playwright checks carried over unchanged.

## Structure

```
admin/
  package.json, vite.config.ts, tsconfig.json, index.html
  admin-portal.html, dashboard.html (built), README.md
  src/
    main.tsx              entry: loads the mock data, starts session upkeep, renders <App>
    styles/tokens.css     designs/guest tokens (unchanged) + admin layout tokens
    styles/admin.css      components and layouts
    app/                  App (routing, redirects, focus, Dashboard-only mode), router (hash routes, leave guard, useDb),
                          Shell (header, collapsible sidebar, user menu, page heading), session, permissions (one matrix
                          object), nav (IA), types, util, useLoad, assets (logos)
    ui/                   kit (Icon, Btn, Badge, Switch, Segmented, Card, states, Stepper), Select (dropdown), DataTable,
                          forms (Field, Form, validation, change lists), overlays (toasts, dialogs, confirm), Lifecycle
                          (publishing row, history, form dialogs), FeatureBar (Publishing bar), charts, preview (phone frame,
                          preview card, what the app shows)
    services/services.ts  MOCK services: config + lifecycle, users, notifications, wayfinding, zero results, analytics, audit, platform, settings
    mock/seed.ts          MOCK fixtures, sample content from the Guest Flow 2 design
    preview/              PhoneApp.tsx and mobile.css – the Guest Flow 2 phone (alerts, Find Care hero, modules, tab bar, menu,
                          onboarding and Welcome, lock screen), rendered by React into the preview frame's own document
    pages/                Auth, dashboard, analytics, home-layout, collection (campaigns, alerts, quick links, cards, segments),
                          config-pages (colors, menu, app entry, search tables, ranking, locations), notifications, users,
                          wayfinding, admin-pages (audit, history, platform, settings, rules, targeting, zero results), profile, registry
```

The phone preview is an iframe with no scripts of its own (`sandbox="allow-same-origin"`): it holds the app's stylesheet and fonts, and the Admin renders the React phone app into it through a portal, so neither page's CSS reaches the other.

Nothing outside `admin/` is modified.

## Routes

Routes are plain hash names (`#home-layout`, `#home-campaigns-campaign-flu`) because Artifact links keep only `#name` hashes. Settings live at `#admin-settings` because claude.ai reserves `#settings`.

## What is mock or simulated

- **Sign-in and passwords:** email and password against mock accounts. Every active sample account starts with the password `MyCare#2026` (shown on the login page, with links that fill in an account). Passwords you set are kept only as salted SHA-256 hashes in this browser's mock data. Sign-ins and password events go to the audit log (not the Dashboard feed).
- **Password reset email:** no email is sent. After “Link sent”, the page offers the reset link on screen (and a sample expired link). Links are single use and expire after 30 minutes.
- **Publishing, sending, uploading and integration checks:** simulated in the browser.
- **Analytics, monitoring and zero-result counts:** deterministic sample data.
- **Saving:** changes are saved in this browser's `localStorage` (`utsw-admin-mock-v1`, always wrapped in try/catch). Clearing site data restores the seed.
- **Errors:** every page has an error state with retry; the user-menu switch that simulated failures was removed on request, so the mock services don't fail on their own.
- **Roles:** the role comes from the account you log in with (Super Admin, Admin or Marketing). There is no role switcher in the user menu.
- **Wayfinding files:** read in the browser with FileReader and never uploaded anywhere. The JSON schema checked is a placeholder until UTSW shares a real Gozio export.

## Permissions (proposed, pending confirmation)

The matrix lives in one object, `PERMISSIONS` in `src/app/permissions.ts`, and is shown read-only on the settings page. Navigation hides areas a role can't view, and visiting one directly shows access denied. The services check the same matrix. The role switcher (prototype only) keeps the signed-in sample person.

## Verification (Nov. 17, 2026, React build)

Headless Chromium with the pre-installed Playwright, against the built file:
- `npm run build` succeeds: strict typecheck with no errors, about 580 KB per file, 129 icons in the subset (every glyph the vanilla build used, plus `timer_off` on the session-ended page, which the old build missed, and `place`).
- **Route sweep:** 55 routes, covering every page, create page and sample detail page, × 3 roles. No console or page errors, no error or stuck loading states, every control has a name, every rendered icon (Admin and phone preview) is in the subset, and no horizontal overflow.
- **End-to-end flows:** all 50 checks pass, the same suite the vanilla build passed: campaign creation (validation, preview, deploy and publish) through wayfinding bad and good files, the notification lifecycle, users, audit rollback, settings and Marketing permissions.
- **Component suites:** drag and keyboard reordering (20), accordion create (25), Publishing bar (19), dropdowns (28), table filters (19), forms (12), collapsible rail (13), light theme (27), Layout card (6), Dashboard-only build (13), lock-screen and Services previews, and the Guest Flow 2 checks all pass.

### Known issue in the copied mobile design

Campaign tags such as "Flu season" (white on 14% white over the campaign gradient) measure 4.37:1 at the gradient's lightest stop, just under 4.5:1. The rule is copied unchanged from `designs/guest/src.html` (`.camp-tag`), so the preview mirrors it; the fix belongs in `designs/guest`.

## Open questions (HANDOVER §10) – not guessed

1. **Stack:** React + TypeScript with Vite (in use since Nov. 17, 2026). Confirm it matches UTSW's production standards before this becomes production code.
2. **Which prototype the preview mirrors:** `designs/guest` (in use) vs `design/guest-v2`, whose labels differ ("Find my Care" vs "Find my care"; "I'm a patient" vs "Sign in as a patient").
3. **Configurable modules:** the brief names four, but the prototype has nine module ids. Alerts, Welcome and Search are shown as fixed; the six reorderable ones are configurable here. Which does the Admin manage, and do MedBlog and announcements come from the CMS or a website feed?
4. **Services and resources:** the Featured cards type now holds the Guest Flow 2 Services and resources cards. The MedBlog stories stay outside the Admin. Confirm.
5. **Authenticated home:** no design exists. The Authenticated tab uses the personalised homepage modules from the prototype (Your next visits from MyChart, Near you) until the signed-in design is approved.
6. **Alerts:** priority rules for several active alerts, the meaning of "display duration", and whether alerts can be dismissed.
7. **Time zone default:** times show in Central Time (America/Chicago). Confirm, and a selector comes with scheduled content.
8. **Destination types** for campaigns, alerts, quick links, cards and drawer items.
9. **Global colors:** which tokens are editable, the contrast thresholds, and the effect on dark mode.
10. **App entry:** EULA source, versioning and re-acceptance; login prompt types.
11. **Drawer:** which items are fixed or CMS-managed, and whether sections can be reordered.
12. **Search:** the engine, mapping semantics, the source of zero-result queries, and which ranking parameters can change.
13. **Audiences:** attributes, precedence, conflict handling and PHI limits.
14. **Notifications:** push provider, whether delivery types or an approval step are needed (removed from the prototype on request), who can send, cancel and edit rules, allowed video hosts.
15. **Analytics:** data source and exact metric definitions.
16. **Users:** how invitations reach new admins (an email with a set-password link is assumed); deletion vs deactivation; audit retention and before-and-after detail.
17. **Environments:** what "Demo" is (a separate environment or a build), and who can promote to production. Which config types support versioning and rollback (all flags here are assumptions).
18. **Admin device support:** built for desktop (1280 and 1440, usable at 1024). It also works at phone width, but that is not a supported target until confirmed.
19. **Spelling:** the UI uses US English ("Global colors") per UT Southwestern style, while the brief uses UK spelling. The one exception is the app's own label "Personalise My Homepage".
20. **Logo:** `mycare-logo/` is a proposal pending CMPA approval and is used unaltered.
21. **Passwords:** the Login design replaces SSO with email and password. Pending: the final password policy (the design's four rules are used: 8+ characters, an uppercase letter, a number and a special character), reset link lifetime (30 minutes assumed), lockout after failed attempts, password expiry and reuse, and whether MFA is needed for admins.

Also pending: the session timeout (30 minutes is a placeholder) and the final permission matrix.

## Next

- Connect the services to a real backend once an API contract exists. Screens only call the service interfaces in `src/services/services.ts`.
- Back AuthService with the real authentication service and email delivery (reset links, invitations), and replace the proposed permission matrix with the confirmed one.
- Swap in real data sources for analytics, push and the Gozio export schema as UTSW confirms them.


## Guest Flow 2 update

The portal follows the stakeholder-updated guest design (UTSW MyCare Guest Flow 2): tab bar Home, Find Care, Search, Wayfinding, Favorites; a home bar with the Sign in pill and a round menu button; pinned alerts and Find Care hero; the module set and order above; the new campaign card, alert levels, four Quick links, Services and resources cards, MyChart sign-in card, MedBlog story cards, Announcements with a New tag; the new menu; onboarding and Welcome; Top and popular searches; and the design’s sorts. The sample data uses the design’s fictional content. One open point: the design shows each campaign as its own row in the module layout; the portal keeps one Campaign banner slot that shows the live campaign, and ended campaigns hide themselves.