# UTSW MyCare – Home Screen Motion · iOS

Engineering handoff for every animation in the guest **Home** flow: screen changes, the tab bar, Home’s first appearance, scroll-linked motion, alerts, sheets, the menu, the search sheet, pull to refresh, the campaign card, toasts, press feedback, and the **at a facility** Home with the live 3D map. Taken from the Nov 25 prototype (`design/guest-v2/guest-flow.html`); every duration, delay, curve and distance is the value the prototype runs. Units are **points** (CSS px map 1:1 at a 390-wide iPhone).

Target: SwiftUI, iOS 16+ (iOS 17 APIs noted where they help). Companion doc: `ios-splash-onboarding-motion.md` (same tokens).

---

## 1. Tokens

```swift
extension Animation {
    static func settle(_ ms: Double) -> Animation   { .timingCurve(0.32, 0.72, 0, 1, duration: ms / 1000) } // anything that travels
    static func out(_ ms: Double) -> Animation      { .timingCurve(0.2, 0, 0, 1, duration: ms / 1000) }     // small reveals
    static func standard(_ ms: Double) -> Animation { .timingCurve(0.4, 0, 0.2, 1, duration: ms / 1000) }   // expand/collapse, color
    static func exitIn(_ ms: Double) -> Animation   { .timingCurve(0.42, 0, 1, 1, duration: ms / 1000) }    // things leaving
}
/// 3D map tweens: cubic in-out
func easeInOutCubic(_ t: Double) -> Double { t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2 }
enum Dur { static let fast = 150.0, base = 200.0, slow = 300.0 }
```

**One rule for travel:** nothing overshoots or bounces (no springs with bounce). Movement uses `settle`; fades use `standard`, `out` or `exitIn`.

**Reduce Motion** (`@Environment(\.accessibilityReduceMotion)`): no transitions or entrances (content appears in place, or a plain 200 ms cross-fade), no scroll-linked transforms, no ambient loops (aurora, campaign glow, ring, sheen, map pulse), sheets and the menu appear without scaling.

---

## 2. Screen changes

| Change | Outgoing screen | Incoming screen | Navigation bar |
|---|---|---|---|
| **Push** (MedBlog, Locations, a place page, MyChart from a tile) | opacity 1→0, **200 ms** ease-out | opacity 0→1, scale **0.94→1**, **420 ms** `settle` | Title opacity 0→1 **420 ms** `settle`; back chevron opacity 0→1 **300 ms** |
| **Pop** (back) | same 200 ms fade | same 420 ms scale-in | Title fade 420 ms |
| **Tab switch** | same 200 ms fade | same 420 ms scale-in; the tab’s saved scroll position is restored | Title fade 420 ms |

- This replaces the default iOS horizontal push. Keep the **interactive edge-swipe back**: drive the same values from the gesture (incoming scale 0.94→1, outgoing alpha 1→0) and finish with the remaining time on release; cancel reverses.
- Re-tapping the current tab pops to its root; on its root it scrolls to top (standard iOS behavior, `settle(420)`).

```swift
extension AnyTransition {
    static var myCareScreen: AnyTransition {
        .asymmetric(insertion: .scale(scale: 0.94).combined(with: .opacity).animation(.settle(420)),
                    removal: .opacity.animation(.easeOut(duration: 0.2)))
    }
}
```

With `NavigationStack`, implement it as a custom `UINavigationControllerDelegate` animator (UIKit) or a custom container that switches screens with `.transition(.myCareScreen)` and `.id(route)`.

---

## 3. Tab bar (Home · Find Care · MyChart · Favorites)

| Element | Motion |
|---|---|
| Selection pill | One 56 × 32 pt capsule (`#D6E4F0`, 1 pt inner line Blue @ 10%) **slides** to the selected tab: `matchedGeometryEffect`, **460 ms** `settle`. |
| Icon | Outline → filled cross-fade **200 ms** `standard` (`symbolEffect` is not needed; swap the two vector assets with opacity). |
| Label | Weight medium → semibold, color `text2` → `blue` (instant). |
| Favorites badge | Count change: `.contentTransition(.numericText(countsDown: false))` with `settle(440)` (iOS 17), or slide old/new numbers vertically. First badge appearance: scale **0.82→1**, **320 ms** `settle`. |

Custom tab bar (floating, rounded): the system `TabView` bar can’t show the sliding pill.

---

## 4. Home – first appearance

Runs once per launch, when Home first shows (after onboarding or the splash).

| Element | From → To | Duration | Delay | Curve |
|---|---|---|---|---|
| Find Care heading block | opacity 0→1, offset y +20→0 | 760 | 80 | `settle` |
| Search field | same | 760 | 170 | `settle` |
| Alert banner(s) | opacity 0→1, offset y −12→0 | 640 | 520 | `settle` |
| Each module **on screen** | opacity 0→1, offset y +32→0 | 720 | **120 + n × 55** (n = order on screen, capped at 7) | `settle` |
| Quick link tiles | as modules, plus **+24 ms for the right column** and **+12 ms per row** | 720 | module delay + offset | `settle` |

After a push the base delay is 200 ms instead of 120. Modules below the fold use the scroll-linked motion in §5 instead.

---

## 5. Scroll-linked motion (Home)

Values are computed from the scroll position every frame. `vh` = visible height of the scroll view.

### 5.1 Modules entering from below

```
p = clamp((vh − top − d·vh·0.3) / (vh·0.34), 0, 1)     // top = module's minY in the scroll view; d = tile offset (0 for modules)
e = 1 − (1 − p)³
opacity = e · (1 − 0.7·x)     offsetY = (1 − e)·64 + 24·x     scale = (0.94 + 0.06·e) · (1 − 0.05·x)
```

### 5.2 Modules leaving at the top

```
x = smoothstep( clamp((edge − top) / max(96, min(moduleHeight, vh·0.6)), 0, 1) )   // edge = 0 on Home
```

### 5.3 Section headings

The heading rises out of a mask: `e2 = clamp((e − 0.25)/0.75, 0, 1)`; mask off the bottom `(1 − e2)` of the heading and offset it down by the same fraction of its height.

### 5.4 Hero parallax and the navigation bar

| Element | Rule (y = content offset clamped 0…320) |
|---|---|
| Find Care heading block | offset y = **0.35·y**; opacity = **max(0, 1 − y/220)** |
| Aurora light | offset y = **0.5·y** |
| Campaign shapes | shape 1 offset y = −0.12 × (card center − screen middle); shape 2 = +0.08 × the same |
| Bar | shadow `0 8 24 #001E3C @ 20%` when y > 4, **300 ms** `standard` |

```swift
// iOS 17: per-module effect, evaluated on the render thread, no state updates per frame
ModuleView(module)
    .visualEffect { content, proxy in
        let f = proxy.frame(in: .scrollView), vh = proxy.bounds(of: .scrollView)?.height ?? 844
        let p = min(max((vh - f.minY) / (vh * 0.34), 0), 1), e = 1 - pow(1 - p, 3)
        var x = min(max((0 - f.minY) / max(96, min(f.height, vh * 0.6)), 0), 1); x = x * x * (3 - 2 * x)
        return content
            .opacity(e * (1 - 0.7 * x))
            .scaleEffect((0.94 + 0.06 * e) * (1 - 0.05 * x))
            .offset(y: (1 - e) * 64 + 24 * x)
    }
```

On iOS 16, read the offset with a `GeometryReader` preference in the scroll content and apply the same math.

---

## 6. Ambient loops

| Element | Loop | Duration | Curve |
|---|---|---|---|
| Hero aurora (three radial lights) | offset (−3%, 2%) rot 0° ↔ (4%, −3%) rot 10°, autoreversing | **22 s** | easeInOut |
| Campaign glow | offset (−6%, −4%) rot 0° ↔ (6%, 4%) rot 14°, autoreversing | **14 s** | easeInOut |
| Campaign badge ring (2 pt dashed, white @ 38%) | rotate 360° | **18 s** | linear |
| Campaign icon | rock: 0° → −10° (y −2) → 0° → 8° (y −1) → 0° | **3.2 s** | easeInOut (`keyframeAnimator`, iOS 17) |
| Campaign sheen (45% wide light band, skew −12°) | sweeps −120% → 330% of card width in the first 38%, then rests | **6.5 s**, first after 1.2 s | `settle` |
| Campaign button shimmer (cyan @ 18%) | −100% → 100% in the first 30%, then rests | **6.5 s**, first after 1.9 s | `settle` |

Stop loops when the card leaves the screen (`onDisappear` inside a `LazyVStack`) and when the app is in the background.

---

## 7. Alerts

| Interaction | Motion |
|---|---|
| Expand an alert | Body appears with `.transition(.opacity.combined(with: .move(edge: .top)))` inside a height change, **200 ms** `standard`; chevron rotates 0° ↔ 180° in **200 ms**. |
| “1 more alert” / “Hide other alerts” | Stacked alerts expand/collapse, **200 ms** `standard`; arrow rotates 180°. |
| Read full alert | Opens the **alert details sheet** (§8). |
| Dismiss (advisories) | The card fades and scales to 0.94 in **240 ms** `exitIn`, then its space closes in **320 ms** `settle`. |

---

## 8. Sheets (alert details, location, other sheets)

| Part | Open | Close |
|---|---|---|
| Dimming (`#001E38` @ 48%) | opacity 0→1, **400 ms** `standard` | reverse |
| Sheet | opacity 0→1 **240 ms** ease-out + scale 0.94→1 **420 ms** `settle` | reverse; total **460 ms** |
| Screen behind | steps back into a card (scale toward the middle, 16 pt top corners, dark backdrop `#08131D`), **500 ms** `settle` | returns in 500 ms |

The “screen steps back” look is what iOS page sheets do: `.sheet` with `.presentationDetents` gives the system version (use the system sheet if you prefer platform-native motion; it is close to this spec).

---

## 9. Menu (top-right button)

| Part | Motion |
|---|---|
| Dimming | opacity 0→1, **400 ms** `standard` |
| Panel (right side, 86% ≤ 336 pt wide, leading corners 24 pt) | opacity 0→1 **240 ms** ease-out + scale 0.94→1 **420 ms** `settle` |
| Contents | Section labels, cards and chips: opacity 0→1, offset y +12→0, **440 ms** `settle`, delay **140 + i × 40 ms** (first 10) |
| Close | reverse, **460 ms**; also closes on a swipe toward the right edge |

---

## 10. Search sheet (tap the Find Care search field)

| Part | Motion |
|---|---|
| Open | Full-screen layer: opacity 0→1, scale 0.94→1, **420 ms** `settle`; keyboard focus after 80 ms (`@FocusState`). |
| Contents | Labels, Recent searches chips, cards and buttons: opacity 0→1, offset y +12→0, **440 ms** `settle`, delay **160 + i × 30 ms** (first 12) |
| Close | opacity 1→0, scale 1→0.94, **240 ms** `exitIn` |

---

## 11. Pull to refresh (Home only)

| Phase | Behavior |
|---|---|
| Pull | Content follows at **0.5 ×** finger distance, max **72 pt**. A 24 pt ring indicator follows (starts 48 pt above). Its arc draws 0 → 86% as the pull reaches 56 pt and it rotates **3° per pt** pulled. |
| Armed (≥ 56 pt) | Indicator fills `ctl` with a white ring (**200 ms**). Haptic: `UIImpactFeedbackGenerator(style: .light)` once. |
| Release, armed | Indicator settles at 16 pt, content at 56 pt (**200 ms**); ring spins **800 ms/turn** for ~1 s; then both return (**360 ms** / **420 ms** `settle`) and the toast “Home is up to date” shows. |
| Release, not armed | Both return in **200 ms**. |

`.refreshable` gives the system spinner; for this design build a custom indicator from the scroll offset (iOS 17 `onScrollGeometryChange` / iOS 16 preference key).

---

## 12. Toasts

| Part | Motion |
|---|---|
| In | opacity 0→1 **240 ms** `standard` + offset y +16→0 **420 ms** `settle`; 16 pt above the tab bar |
| Stay | **2.6 s**, or **5 s** with Undo |
| Undo timer | 2 pt hairline shrinks from full width to 0 over **5 s**, linear |
| Out | reverse |

---

## 13. Press feedback

| Control | Pressed scale | Press | Release |
|---|---|---|---|
| Quick link tiles, cards | **0.97** | 120 ms | 320 ms `settle` |
| Buttons | **0.98** | 150 ms `standard` | 150 ms |
| Find Care search field | **0.98** | 150 ms | 150 ms |
| Sign in pill | **0.96** | 150 ms | 150 ms |
| Icon buttons (menu, close) | **0.94** | 150 ms | 150 ms |

```swift
struct PressScale: ButtonStyle {
    var scale: CGFloat = 0.97
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1)
            .animation(configuration.isPressed ? .standard(120) : .settle(320), value: configuration.isPressed)
    }
}
```

---

## 14. Home at a facility (geolocation) – 3D map and guest nearby

| Element | Motion |
|---|---|
| Map first appearance | Map view opacity 0→1, **480 ms** `out` |
| Camera | Eases toward its target every frame (exponential smoothing): `f = 1 − 0.0025^(dt/1s)`; for **2.4 s** after a change, faster: `f = 1 − 0.12^(dt/1s)`. Angles take the shortest way round. |
| Floor change (7 / 2 / 1) | Elevator effect: the old floor moves **60 units** down (going up) or up (going down) while the new floor arrives from the other side, both **650 ms** `easeInOutCubic`. Other buildings / campus: cross-fade (480 ms). |
| Department zones | Light walls grow from 1% to full height, **900 ms** `easeInOutCubic`. |
| “You are here” | Pulse ring scale 1 → 1.9, opacity 0.45 → 0, every **1.6 s**; route arrows flow continuously. |
| Drag | Horizontal pan turns the map **0.008 rad per pt**; vertical pans keep scrolling Home (`simultaneousGesture` with direction lock). |
| Room labels | Follow their 3D anchor every frame (SceneKit/RealityKit `projectPoint`). |
| Why you’re here → answer | Home updates; changed modules settle in as in §4 (720 ms, staggered); the “Here for: … · Change” bar appears in place. |

Run the map in SceneKit (`SCNView`) or RealityKit with `preferredFramesPerSecond = 60` (120 on ProMotion when on screen). With Reduce Motion the camera jumps to its target, floors swap instantly, and pulses and arrows stop.

---

## 15. Accessibility

- Every animation respects Reduce Motion (§1).
- Screen changes move VoiceOver focus to the new title (`AccessibilityFocusState`); tab changes announce the tab.
- Sheets and the menu are modal (`accessibilityAddTraits(.isModal)`) and return focus to the control that opened them.
- Alerts expose expanded/collapsed with `accessibilityValue`.
- Toasts post an announcement; Undo stays reachable for 5 s.
- At rest, scroll-linked content is fully opaque and in place; nothing stays hidden.

## 16. Acceptance checklist

- [ ] Push, pop and tab switch use one transition (fade out 200 ms, scale-in 0.94→1 over 420 ms); edge-swipe back still works interactively.
- [ ] Tab pill slides in 460 ms; icons swap to filled; the Favorites badge rolls its number.
- [ ] First Home: heading, search, alerts and on-screen modules rise in with the listed delays; tiles stagger by column and row.
- [ ] Scrolling: modules rise in and recede reversibly; hero heading drifts and fades; aurora moves at half speed.
- [ ] Alerts expand/collapse in 200 ms; dismissed advisories close their gap.
- [ ] Sheets and the menu scale in from 0.94 with a 400 ms dimming; the screen behind steps back for sheets.
- [ ] Search sheet zooms in (420 ms) and out (240 ms); its chips stagger in.
- [ ] Pull to refresh arms at 56 pt, spins, then shows “Home is up to date”.
- [ ] Campaign card loops run at the listed periods and stop off screen.
- [ ] Facility Home: map fades in, floors change like an elevator, pan turns the map, pulses loop.
- [ ] Reduce Motion on: everything appears in place and nothing loops.
- [ ] Smooth at 120 Hz on ProMotion devices.
