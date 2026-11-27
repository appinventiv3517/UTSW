# UTSW MyCare – Home Screen Motion · Android

Engineering handoff for every animation in the guest **Home** flow: screen changes, the tab bar, Home’s first appearance, scroll-linked motion, alerts, sheets, the menu, the search sheet, pull to refresh, the campaign card, toasts, press feedback, and the **at a facility** Home with the live 3D map. Taken from the Nov 25 prototype (`design/guest-v2/guest-flow.html`); every duration, delay, curve and distance is the value the prototype runs. Units are **dp** (CSS px map 1:1 at a 390-wide phone).

Target: Jetpack Compose (Material 3). Companion doc: `android-splash-onboarding-motion.md` (same tokens).

---

## 1. Tokens

```kotlin
object MyCareEasing {
    val Settle   = CubicBezierEasing(0.32f, 0.72f, 0f, 1f)   // anything that travels: screens, sheets, pills, entrances
    val Out      = CubicBezierEasing(0.2f, 0f, 0f, 1f)       // selection fills, small reveals
    val Standard = CubicBezierEasing(0.4f, 0f, 0.2f, 1f)     // expand/collapse, color, shadows
    val InOut    = CubicBezierEasing(0.42f, 0f, 0.58f, 1f)   // slow ambient loops
    val In       = CubicBezierEasing(0.42f, 0f, 1f, 1f)      // things leaving (fade out)
    val InOutCubic = Easing { t -> if (t < .5f) 4 * t * t * t else 1 - (-2 * t + 2).pow(3) / 2 } // 3D map tweens
}
object MyCareDuration { const val Fast = 150; const val Base = 200; const val Slow = 300 }
```

**One rule for travel:** nothing overshoots or bounces. Movement uses `Settle`; fades use `Standard`, `Out` or `In`.

**Reduced motion** (`ANIMATOR_DURATION_SCALE == 0`, see the splash doc): no transitions or entrances (content appears in place), no scroll-linked transforms, no ambient loops (aurora, campaign glow, ring, sheen, map pulse), sheets and the menu appear without scaling. Color and state changes stay, but instant.

---

## 2. Screen changes

| Change | Outgoing screen | Incoming screen | App bar |
|---|---|---|---|
| **Push** (open MedBlog, Locations, a place page, MyChart from a tile) | alpha 1→0, **200 ms** `Out`-ish (CSS ease-out) | alpha 0→1, scale **0.94→1**, **420 ms** `Settle` | Title alpha 0→1 **420 ms** `Settle`; back arrow alpha 0→1 **300 ms** |
| **Pop** (back) | same 200 ms fade | same 420 ms scale-in | Title fade 420 ms |
| **Tab switch** | same 200 ms fade | same 420 ms scale-in; the tab’s saved scroll position is restored | Title fade 420 ms |

- Both screens are on screen together for the first 200 ms (outgoing on top, fading). No horizontal slide.
- Re-tapping the current tab with a stack pops to its root (pop transition); on its root it does nothing.
- Predictive back (Android 14+): drive the same scale (1→0.94) and alpha from the back-gesture progress; commit runs the rest.

```kotlin
val screenEnter = fadeIn(tween(420, easing = MyCareEasing.Settle)) +
                  scaleIn(tween(420, easing = MyCareEasing.Settle), initialScale = .94f)
val screenExit  = fadeOut(tween(200, easing = LinearOutSlowInEasing))
// NavHost(enterTransition = { screenEnter }, exitTransition = { screenExit },
//         popEnterTransition = { screenEnter }, popExitTransition = { screenExit })
```

---

## 3. Tab bar (Home · Find Care · MyChart · Favorites)

| Element | Motion |
|---|---|
| Selection pill | One 56 × 32 dp pill (`#D6E4F0`, 1 dp inner line Blue @ 10%) **slides** to the selected tab: x/width **460 ms** `Settle`. Hidden on first frame, then fades in once placed. |
| Icon | Outline → filled cross-fade **200 ms** `Standard`. |
| Label | Weight 500 → 600, color `text2` → `blue` (instant). |
| Favorites badge | Count change: old number slides out (up when increasing) while the new one slides in from below, **440 ms** `Settle` (`AnimatedContent` with `slideInVertically`). First badge appearance: scale **0.82→1**, **320 ms** `Settle`. |

```kotlin
val indicatorX by animateDpAsState(tabCenter(selected) - 28.dp, tween(460, easing = MyCareEasing.Settle))
```

---

## 4. Home – first appearance

Runs once per launch, when Home first shows (after onboarding or the splash).

| Element | From → To | Duration | Delay | Curve |
|---|---|---|---|---|
| Find Care heading block | alpha 0→1, translationY +20→0 | 760 | 80 | `Settle` |
| Search field | same | 760 | 170 | `Settle` |
| Alert banner(s) | alpha 0→1, translationY −12→0 | 640 | 520 | `Settle` |
| Each module **on screen** (Quick links header, tiles, MyChart card, MedBlog, campaign…) | alpha 0→1, translationY +32→0 | 720 | **120 + n × 55** (n = order on screen, capped at 7) | `Settle` |
| Quick link tiles (inside the module) | as modules, plus **+24 ms for the right column** and **+12 ms per row** | 720 | module delay + offset | `Settle` |

After a push the base delay is 200 ms instead of 120. Modules below the fold do **not** animate here; they use the scroll-linked motion in §5.

---

## 5. Scroll-linked motion (Home)

All values are computed every frame from the scroll position (no timers). `vh` = visible height of the scroll area.

### 5.1 Modules entering from below

For a module whose top is `top` px below the viewport top:

```
p = clamp((vh − top − d·vh·0.3) / (vh·0.34), 0, 1)     // d = tile offset (0 for whole modules)
e = 1 − (1 − p)³                                         // ease-out cubic
alpha = e · (1 − 0.7·x)     translationY = (1 − e)·64 + 24·x     scale = (0.94 + 0.06·e) · (1 − 0.05·x)
```

### 5.2 Modules leaving at the top

```
x = smoothstep( clamp((edge − top) / max(96, min(moduleHeight, vh·0.6)), 0, 1) )   // edge = sticky header height (0 on Home)
```

The module recedes (shrinks 5%, drops 24 dp, fades to 30%) as it passes the top edge, and comes back when you scroll back.

### 5.3 Section headings (modules that arrive by scrolling)

The heading rises out of a mask: with `e2 = clamp((e − 0.25)/0.75, 0, 1)`, clip the bottom `k = (1 − e2)·100%` and translate the text down by the same `k%` of its height.

### 5.4 Hero parallax and the app bar

| Element | Rule (y = scroll offset clamped 0…320) |
|---|---|
| Find Care heading block | translationY = **0.35·y**; alpha = **max(0, 1 − y/220)** |
| Aurora light behind the hero | translationY = **0.5·y** |
| Campaign card shapes | shape 1 translationY = −0.12 × (card center offset from screen middle); shape 2 = +0.08 × the same |
| App bar | shadow `0 8 24 #001E3C @ 20%` appears when y > 4, **300 ms** `Standard` |

```kotlin
val y by remember { derivedStateOf { listState.firstVisibleItemScrollOffset /* or ScrollState.value */ } }
Modifier.graphicsLayer {
    val yy = y.coerceIn(0, 320).toFloat()
    translationY = yy * .35f; alpha = (1f - yy / 220f).coerceAtLeast(0f)
}
```

For §5.1–5.2 write a `Modifier.scrollReveal(listState, index)` that reads the item’s offset from `listState.layoutInfo.visibleItemsInfo` inside `graphicsLayer {}` (reads in the draw phase only, so no recomposition per frame).

---

## 6. Ambient loops

| Element | Loop | Duration | Curve |
|---|---|---|---|
| Hero aurora (three radial lights) | translate (−3%, 2%) rot 0° ↔ (4%, −3%) rot 10°, reversing | **22 s** | `InOut` |
| Campaign glow | translate (−6%, −4%) rot 0° ↔ (6%, 4%) rot 14°, reversing | **14 s** | `InOut` |
| Campaign badge ring (2 dp dashed, white @ 38%) | rotate 360° | **18 s** | linear |
| Campaign icon | rock: 0° → −10° (y −2) → 0° → 8° (y −1) → 0° | **3.2 s** | `InOut` |
| Campaign sheen (45% wide light band, skew −12°) | sweeps −120% → 330% of card width during the first 38%, then rests | **6.5 s**, first after 1.2 s | `Settle` |
| Campaign button shimmer (cyan @ 18%) | −100% → 100% during the first 30%, then rests | **6.5 s**, first after 1.9 s | `Settle` |

Use one `rememberInfiniteTransition()` per card; pause when the card is off screen (`LocalLifecycleOwner` + visibility) to save battery.

---

## 7. Alerts

| Interaction | Motion |
|---|---|
| Expand an alert (tap its header) | Body height 0 ↔ content, **200 ms** `Standard` (`AnimatedVisibility(expandVertically + fadeIn)`); chevron rotates 0° ↔ 180° in **200 ms**. |
| “1 more alert” / “Hide other alerts” | The stacked alerts expand/collapse, **200 ms** `Standard`; the arrow rotates 180°. |
| Read full alert | Opens the **alert details sheet** (§8). |
| Dismiss (advisories) | The card fades and scales to 0.94 in **240 ms** `In`, then its space closes in **320 ms** `Settle` (height → 0, top margin −12). |

---

## 8. Sheets (alert details, location, other bottom sheets)

| Part | Open | Close |
|---|---|---|
| Scrim (`#001E38` @ 48%) | alpha 0→1, **400 ms** `Standard` | reverse |
| Sheet | alpha 0→1 **240 ms** ease-out + scale 0.94→1 **420 ms** `Settle` (pivot center) | reverse; total **460 ms** |
| Screen behind | **steps back into a card**: app bar, content and tab bar scale toward the middle with rounded top corners (16 dp) over a dark backdrop (`#08131D`), **500 ms** `Settle` | returns in 500 ms |

Sheets keep the tall/short heights from the design; content inside does not animate.

---

## 9. Menu (top-right button)

| Part | Motion |
|---|---|
| Scrim | alpha 0→1, **400 ms** `Standard` |
| Panel (right side, 86% ≤ 336 dp wide, left corners 24 dp) | alpha 0→1 **240 ms** ease-out + scale 0.94→1 **420 ms** `Settle` |
| Contents | Section labels, cards and chips rise in: alpha 0→1, translationY +12→0, **440 ms** `Settle`, delay **140 + i × 40 ms** (first 10 items) |
| Close | reverse, **460 ms** |

---

## 10. Search sheet (tap the Find Care search field)

| Part | Motion |
|---|---|
| Open | Full-screen layer: alpha 0→1, scale 0.94→1, **420 ms** `Settle`. Keyboard focus goes to the field after 80 ms. |
| Contents | Labels, chips (Recent searches), cards and buttons rise in: alpha 0→1, translationY +12→0, **440 ms** `Settle`, delay **160 + i × 30 ms** (first 12) |
| Close | alpha 1→0, scale 1→0.94, **240 ms** `In` |

---

## 11. Pull to refresh (Home only, at the top)

| Phase | Behavior |
|---|---|
| Pull | Content moves down by **0.5 × finger distance**, max **72 dp**. A 24 dp ring indicator follows (starts 48 dp above, hidden). The ring’s arc draws from 0 to 86% as the pull reaches 56 dp, and the ring rotates **3° per dp** pulled. |
| Armed (≥ 56 dp) | Indicator fills `ctl` with a white ring (color change **200 ms**). Haptic: `HapticFeedbackConstants.CONFIRM` (API 30+) or `VIRTUAL_KEY` once. |
| Release, armed | Indicator settles at 16 dp, content at 56 dp (**200 ms**); ring spins **800 ms/turn** linear for ~1 s. Then indicator returns (**360 ms** `Settle`), content returns (**420 ms** `Settle`), toast “Home is up to date”. |
| Release, not armed | Both return in **200 ms**. |

Use `PullToRefreshBox` with a custom indicator to match.

---

## 12. Toasts

| Part | Motion |
|---|---|
| In | alpha 0→1 **240 ms** `Standard` + translationY +16→0 **420 ms** `Settle`; sits 16 dp above the tab bar |
| Stay | **2.6 s**, or **5 s** with an Undo action |
| Undo timer | 2 dp hairline along the bottom shrinks from full width to 0 over **5 s**, linear |
| Out | reverse |

---

## 13. Press feedback

| Control | Pressed scale | Press | Release |
|---|---|---|---|
| Quick link tiles, cards (`press`) | **0.97** | 120 ms | 320 ms `Settle` |
| Buttons | **0.98** | 150 ms `Standard` | 150 ms |
| Find Care search field | **0.98** | 150 ms | 150 ms |
| Sign in pill (app bar) | **0.96** | 150 ms | 150 ms |
| Icon buttons (menu, close) | **0.94** | 150 ms | 150 ms |

Keep the Material ripple off for these (the design uses scale, not ripple); keep a visible focus ring for keyboard/switch access.

---

## 14. Home at a facility (geolocation) – 3D map and guest nearby

| Element | Motion |
|---|---|
| Map first appearance | Canvas alpha 0→1, **480 ms** `Out` |
| Camera | Eases toward its target every frame (exponential smoothing): `f = 1 − 0.0025^(dt/1s)`; during the first **2.4 s** after a change it moves faster: `f = 1 − 0.12^(dt/1s)`. Angles take the shortest way round. |
| Floor change (7 / 2 / 1 control) | Elevator effect: the old floor moves **60 units** down (going up) or up (going down) while the new floor arrives from the opposite side, both **650 ms** `InOutCubic`. Different buildings or the campus view cross-fade (map fade-in 480 ms). |
| Department zones | Their light walls grow from 1% to full height, **900 ms** `InOutCubic`. |
| “You are here” | Pulse ring: scale 1 → 1.9, alpha 0.45 → 0, every **1.6 s**. Route arrows flow continuously. |
| Drag | Horizontal drag turns the map: **0.008 rad per dp**. Vertical swipes keep scrolling Home. |
| Labels | Room callouts follow their 3D anchor every frame (no animation of their own). |
| Why you’re here → answer | Home re-renders: changed modules use the settle-in of §4 (720 ms, staggered). The “Here for: … · Change” bar appears in place. |
| Guest nearby, Doctors open today, Facilities | Scroll-linked like other modules (§5). |

With reduced motion the camera jumps to its target, floors swap instantly, and pulses and flowing arrows stop.

---

## 15. Accessibility

- Every animation respects reduced motion as described in §1.
- Screen changes move focus to the new screen’s title; tab changes announce the tab name.
- Sheets and the menu trap focus while open and return it to the control that opened them.
- The alert expand/collapse updates `stateDescription` (“expanded/collapsed”).
- Toasts are announced politely; the Undo action stays reachable for 5 s.
- Scroll-linked effects never hide content permanently: at rest, everything on screen is fully opaque and in place.

## 16. Acceptance checklist

- [ ] Push, pop and tab switch use the same transition (fade out 200 ms, scale-in 0.94→1 over 420 ms) with no horizontal slide.
- [ ] Tab pill slides between tabs in 460 ms; icons swap to filled; the Favorites badge rolls its number.
- [ ] First Home: heading, search, alerts and on-screen modules rise in with the listed delays; tiles stagger by column and row.
- [ ] Scrolling: modules rise in from below and recede at the top, reversibly; hero heading drifts and fades; aurora moves at half speed.
- [ ] Alerts expand/collapse in 200 ms with rotating chevrons; dismissed advisories close their gap.
- [ ] Sheets and the menu scale in from 0.94 with a 400 ms scrim; the screen behind steps back into a card for sheets.
- [ ] Search sheet zooms in (420 ms) and out (240 ms); its chips stagger in.
- [ ] Pull to refresh arms at 56 dp, spins, and shows “Home is up to date”.
- [ ] Campaign card: glow, ring, rocking icon, sheen and button shimmer loop at the listed periods and stop off screen.
- [ ] Facility Home: map fades in, floors change like an elevator, drag turns the map, pulses loop.
- [ ] With animations removed, everything appears instantly and nothing loops.
