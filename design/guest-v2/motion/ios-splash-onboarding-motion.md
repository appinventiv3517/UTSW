# UTSW MyCare – Splash and Onboarding Motion · iOS

Engineering handoff for the guest app’s launch animation and the four onboarding slides, taken from the Nov 25 prototype (`design/guest-v2/guest-flow.html`, jumps **Splash** and **Onboarding**). Every duration, delay, curve and distance below is the value the prototype runs. Units are **points** (the prototype’s CSS px map 1:1 to pt at a 390-wide iPhone).

Target: SwiftUI, iOS 16+ (notes for iOS 17 `PhaseAnimator`/`keyframeAnimator` where they simplify things). A static **Launch Screen** storyboard hands off to the animated SwiftUI splash.

---

## 1. Shared tokens

### Colors

| Token | Light | Dark | Used for |
|---|---|---|---|
| `brand` | `#004278` | `#004278` (unchanged) | Splash background, onboarding stage |
| `onBlue` | `#FFFFFF` | `#FFFFFF` | Splash bar fill, Skip, logo |
| `onBlueFill` | `#FFFFFF` @ 12% | same | Splash bar track |
| `ringStroke` | `#FFFFFF` @ 40% | same | Splash rings (2 pt inner stroke) |
| `glow` | `#00A9E0` @ 36% | same | Splash glow |
| `bg` | `#F7F8FA` | `#0D1620` | Onboarding background under the stage |
| `surface` | `#FFFFFF` | `#16222E` | Scene cards, pills, chips |
| `text` | `#333333` | `#E6EDF3` | Scene text |
| `text2` | `#5B6770` | `#A6B4C0` | Onboarding body copy |
| `titleBlue` | `#004278` | `#8CC0EA` | Onboarding title |
| `ctl` | `#004278` | `#2D6CA6` | Primary button, active dot |
| `borderStrong` | `#7A8690` | `#7D8E9E` | Inactive dots (at 45% opacity) |
| `cyan` | `#00A9E0` | same | Route line, aurora |
| `magenta` | `#E0004D` | same | Heart, destination pin |
| `pastel` | `#D1DDE6` | same | Map grid, floor-plan rooms |
| `greenInk` | `#2C6E1B` | `#8FD97E` | Elevator badge |

Put these in the asset catalog as color sets with Any/Dark appearances.

### Timing curves

```swift
extension Animation {
    /// iOS sheet-style settle (0.32, 0.72, 0, 1): fast start, long settle. Most entrances and the exits.
    static func settle(_ ms: Double) -> Animation { .timingCurve(0.32, 0.72, 0, 1, duration: ms / 1000) }
    /// Emphasized decelerate (0.2, 0, 0, 1). Glow, rings.
    static func out(_ ms: Double) -> Animation { .timingCurve(0.2, 0, 0, 1, duration: ms / 1000) }
    /// Standard (0.4, 0, 0.2, 1). Progress bar.
    static func standard(_ ms: Double) -> Animation { .timingCurve(0.4, 0, 0.2, 1, duration: ms / 1000) }
}
```

### Reduce Motion

Read `@Environment(\.accessibilityReduceMotion)`. When on: no splash choreography (logo shown still for **700 ms**, then cut to onboarding), no parallax, no entrances, no pin drops; the route shows already drawn; Next changes page without a slide; exits are instant (or a plain 200 ms cross-fade).

---

## 2. Splash

### 2.1 Launch Screen (static)

`LaunchScreen.storyboard` (or `UILaunchScreen` in Info.plist): background color `brand` (`#004278`) and **nothing else**. iOS shows it until the first frame. The animated splash below starts on the same blue with its icon transparent, so the hand-off is invisible. Do not put the logo in the launch screen: it would pop when the animation starts.

### 2.2 Animated splash – layers

All centered unless noted. Background `brand`, `ignoresSafeArea()`; status bar light content.

| # | Layer | Size and shape | Notes |
|---|---|---|---|
| 1 | Glow | `RadialGradient` `glow` → clear at 70% of radius; radius = 28% of a frame 160% of the screen | Blurred light behind the icon |
| 2–4 | Rings ×3 | 112 × 112 pt, `RoundedRectangle(cornerRadius: 28, style: .continuous)`, **2 pt inner stroke** (`strokeBorder`) `ringStroke` | Same shape as the icon tile |
| 5 | App icon | 112 × 112 pt, continuous corner 26 pt, shadow y 24 radius 24 (CSS blur 48), black-blue `#000A1E` @ 40% | The MyCare app icon artwork, unaltered (PDF/SVG asset, preserve vector data) |
| 6 | Wordmark | Reversed “UTSW MyCare” logo, **240 pt wide**, vertically centered (its 40 pt height straddles the center) | Unaltered vector asset |
| 7 | Progress bar | 64 × 4 pt capsule, **72 pt above the bottom edge**, track `onBlueFill`, fill `onBlue` | Grows from the leading edge |

### 2.3 Timeline (t = 0 when the splash view appears)

| Layer | Start (ms) | Duration | From → To | Curve |
|---|---|---|---|---|
| Glow | 0 | 2400 (keyframes) | 0–840: opacity 0→1, scale 0.5→1 · 840–1248: hold · 1248–1680: opacity →0, scale →1.15 · then gone | `out` per segment |
| Ring 1 | 0 | 1700 | opacity 0.9→0, scale 1→3.4 | `out` |
| Ring 2 | 200 | 1700 | same | `out` |
| Ring 3 | 420 | 1700 | same | `out` |
| Icon in | 0 | 760 | opacity 0→1, scale 0.4→1, rotation −10°→0° | `settle` |
| Icon out | 1150 | 640 | offset x 0→**−88.5 pt**, scale 1→**0.232**; opacity holds 1 until 60% (1534 ms) then →0 by 1790 ms; shadow fades out | `settle` |
| Wordmark | 1420 | 640 | opacity 0→1, offset x +16→0 pt | `settle` |
| Progress bar | 0 | 2200 | width fraction 0→1 (leading anchor) | `standard` |
| Exit (whole splash) | **2500** (or on tap) | 520 | opacity 1→0, scale 1→1.08 | `settle` |

- Rings are invisible before their delay (opacity 0), then start at 0.9.
- **Why −88.5 pt and 0.232:** the icon flies into the icon tile inside the 240 pt logo. The logo’s left edge is 120 pt left of center and its icon tile starts 31.5 pt in, so the move is −120 + 31.5 = **−88.5 pt**; the tile is 26 pt square, so the scale is 26 / 112 = **0.232**. These match the prototype; if the production logo artwork or width differs, recompute both so the icon lands exactly on the tile.
- The splash sits in a `ZStack` **above onboarding**, which is already built underneath; the exit reveals it.
- **Tap anywhere** skips to the exit. VoiceOver: post `UIAccessibility.post(notification: .announcement, argument: "UTSW MyCare is opening")` once; the splash layers are `accessibilityHidden(true)`.
- Total: 2500 ms + 520 ms exit = **3.02 s**.
- Haptics: none.

### 2.4 SwiftUI sketch

```swift
struct AnimatedSplash: View {
    var onFinished: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var glowOpacity = 0.0, glowScale = 0.5
    @State private var rings: [Double] = [0, 0, 0]          // progress 0…1 per ring
    @State private var iconIn = 0.0, iconOut = 0.0, iconOutOpacity = 1.0
    @State private var word = 0.0, bar = 0.0
    @State private var exiting = false

    var body: some View {
        ZStack {
            Color("brand").ignoresSafeArea()
            RadialGradient(colors: [Color(hex: 0x00A9E0).opacity(0.36), .clear], center: .center,
                           startRadius: 0, endRadius: UIScreen.main.bounds.width * 1.6 * 0.28 / 0.7)
                .scaleEffect(glowScale).opacity(glowOpacity)
                .frame(width: UIScreen.main.bounds.width * 1.6, height: UIScreen.main.bounds.height * 1.6)
            ForEach(0..<3, id: \.self) { i in
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .strokeBorder(.white.opacity(0.4), lineWidth: 2)
                    .frame(width: 112, height: 112)
                    .scaleEffect(1 + 2.4 * rings[i])
                    .opacity(rings[i] == 0 ? 0 : 0.9 * (1 - rings[i]))
            }
            Image("AppIconArtwork").resizable()
                .frame(width: 112, height: 112)
                .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
                .shadow(color: Color(hex: 0x000A1E).opacity(0.4 * (1 - iconOut)), radius: 24, y: 24)
                .rotationEffect(.degrees(-10 * (1 - iconIn)))
                .scaleEffect((0.4 + 0.6 * iconIn) * (1 - 0.768 * iconOut))
                .offset(x: -88.5 * iconOut)
                .opacity(iconIn * iconOutOpacity)
            Image("LogoReversed").resizable().scaledToFit().frame(width: 240)
                .offset(x: 16 * (1 - word)).opacity(word)
                .accessibilityLabel("UTSW MyCare")
            VStack { Spacer()
                Capsule().fill(.white.opacity(0.12)).frame(width: 64, height: 4)
                    .overlay(alignment: .leading) { Capsule().fill(.white).frame(width: 64 * bar, height: 4) }
                    .padding(.bottom, 72)
            }.ignoresSafeArea()
        }
        .scaleEffect(exiting ? 1.08 : 1).opacity(exiting ? 0 : 1)
        .contentShape(Rectangle()).onTapGesture { exit() }
        .task { await play() }
    }

    private func play() async {
        UIAccessibility.post(notification: .announcement, argument: "UTSW MyCare is opening")
        if reduceMotion { iconIn = 1; word = 0; try? await Task.sleep(for: .milliseconds(700)); onFinished(); return }
        withAnimation(.out(840)) { glowOpacity = 1; glowScale = 1 }
        withAnimation(.out(432).delay(1.248)) { glowOpacity = 0; glowScale = 1.15 }
        for (i, d) in [0.0, 0.2, 0.42].enumerated() { withAnimation(.out(1700).delay(d)) { rings[i] = 1 } }
        withAnimation(.settle(760)) { iconIn = 1 }
        withAnimation(.settle(640).delay(1.15)) { iconOut = 1 }
        withAnimation(.linear(duration: 0.256).delay(1.534)) { iconOutOpacity = 0 }
        withAnimation(.settle(640).delay(1.42)) { word = 1 }
        withAnimation(.standard(2200)) { bar = 1 }
        try? await Task.sleep(for: .milliseconds(2500))
        exit()
    }

    private func exit() {
        guard !exiting else { return }
        if reduceMotion { onFinished(); return }
        withAnimation(.settle(520)) { exiting = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.52) { onFinished() }
    }
}
```

> Note: a ring’s first frame jumps from 0 to 0.9 opacity at its delay. With the delayed `withAnimation` above, set the ring’s starting state just before its animation, or use iOS 17 `keyframeAnimator` per ring for an exact match. `keyframeAnimator` is also the cleanest way to run the glow’s four-segment keyframes.

---

## 3. Onboarding

### 3.1 Layout (390 × 844 reference)

| Region | Spec |
|---|---|
| Background | `bg`, full screen, below the status bar |
| Stage | `brand` panel, top **440 pt**, bottom corners 24 pt (continuous), clipped; holds the aurora and each slide’s scene |
| Aurora | Two radial gradients inside the stage, in a frame inset −30%: `cyan` @ 34% at (76%, 30%) radius 36%×30%, and `#7BAFD4` @ 20% at (18%, 78%) radius 30%×26% |
| Top bar | 56 pt: reversed logo 188 pt wide (16 pt from the leading edge), **Skip** text button trailing (17 pt semibold white is fine; prototype 16, min target 44 × 44) |
| Pager | Horizontal paging scroll, one page per slide, full width |
| Art area | 384 pt tall; scene canvas **296 × 320 pt** centered (max width = screen − 32) |
| Copy | Padding 32 top, 24 sides; title 28/36 bold `titleBlue`, tracking −0.28, centered; 12 pt gap; body 16/24 `text2`, max width 320, centered |
| Footer | Padding 16 top, 24 sides, 40 bottom (plus home-indicator inset); 24 pt gap between dots and button |
| Dots | 4 dots, 8 pt gap; inactive 8 × 8 `borderStrong` @ 45%; active **24 × 8** capsule `ctl` @ 100% |
| Button | Full width, 48 pt tall, capsule, `ctl` fill, white label “Next” + `arrow.forward` (20 pt); on slide 4 the label reads **“Get started”** |

### 3.2 Scenes – layers, position, depth and order

Positions are inside the 296 × 320 scene canvas (leading, top). **z** = parallax depth; **d** = entrance order. Use `.position`/`.offset` in a fixed-size `ZStack(alignment: .topLeading)`.

**Slide 1 – Find the right doctor**

| Layer | Position, size | z | d |
|---|---|---|---|
| Search pill “Knee pain doctor” (magnifyingglass) | 24, 8 · 248 wide | 1.6 | 0 |
| Back card “Rafael Santos, M.D.” (avatar RS, one line) at 90% opacity | 36, 252 · 224 wide | 0.5 | 3 |
| Main card “Avery Morgan, M.D.”, Orthopaedic Surgery, “Accepting new patients” tag, two placeholder lines (92%, 64%) | 12, 72 · 272 wide | 1.0 | 1 |
| Heart bubble (48 pt circle, `heart.fill` `magenta`) | 244, 52 | 2.2 | 2 |

**Slide 2 – Your health in one place**

| Layer | Position | z | d |
|---|---|---|---|
| Sign-in card (lock well, two 32 pt fields, 32 pt blue capsule) | 60, 44 · 176 wide | 1.0 | 0 |
| Chip “Visits” (calendar) | 0, 16 | 1.8 | 1 |
| Chip “Messages” (chat) | 168, 100 | 2.2 | 2 |
| Chip “Results” (labs) | 0, 196 | 1.6 | 3 |
| Chip “Bills” (credit card) | 176, 256 | 2.0 | 4 |

**Slide 3 – Find a location near you**

| Layer | Position | z | d |
|---|---|---|---|
| Map tile (tint, 40 pt pastel grid, two white roads at −8° and 12°), radius 24 | 8, 8 · 280 × 232 | 0.6 | 0 |
| Pin `magenta` (inside the map) | 56, 40 | – | 2 |
| Pin `ctl` | 182, 60 | – | 3 |
| Pin `ctl` | 120, 150 | – | 4 |
| Card “Lakeview Primary Care · 2.1 mi · Open until 5 p.m.” | 24, 212 · 248 wide | 1.6 | 5 |

**Slide 4 – Get there, step by step**

| Layer | Position | z | d |
|---|---|---|---|
| Floor plan (`#F2F5F8`, four pastel rooms, blue “you are here” dot at 28, 188), radius 24 | 8, 48 · 280 × 216 | 0.6 | 0 |
| Route line `M36 196 V120 H150 V68 H236`, 6 pt `cyan`, round caps and joins | inside the plan | – | – |
| Destination pin `magenta` | 218, 30 (inside the plan) | – | 6 |
| Pill “Take the elevator to Level 7” (48 pt `greenInk` elevator badge) | 12, 0 · 272 wide | 1.8 | 1 |
| Card “Lakeview Transplant Clinic · 125 ft · Arrive 4:25 p.m.” | 32, 248 · 232 wide | 1.4 | 3 |

Cards: `surface`, continuous radius 16, shadow y 16 radius 20 `#001428` @ 28%. Pills: capsule, shadow y 12 radius 16 @ 24%. Chips: 12 pt bold, 32 pt icon well, shadow y 10 radius 12 @ 22%. Use the app’s Material Symbols Rounded assets for the icons so they match Android and the design (SF Symbols names above are only reading aids).

### 3.3 Motion

| Behavior | Spec |
|---|---|
| **Intro (first slide only, on appear)** | Every layer with a `d`: opacity 0→1, offset y +24→0 pt, scale 0.94→1 · **760 ms** `settle` · delay **d × 90 + 80 ms** |
| **Pin drop** (first time a slide lands) | opacity 0→1, offset y −40→0 pt · **640 ms** `settle` · delay **d × 90 + 120 ms**. Pins stay hidden until their slide first settles. |
| **Route draw** (slide 4, first time) | `trim(from: 0, to: progress)` 0→1 · **1400 ms** `settle` · delay **500 ms**. Afterwards it stays drawn. |
| “Seen” | 1900 ms after a slide first settles, its pins and route are marked done and never replay. |
| **Swipe parallax** (continuous, follows the finger) | For each slide, `off = (pageMinX − scrollX) / pageWidth` in −1…1. Each scene layer: offset x = **off × z × 56 pt**. Pins inherit their map. |
| Copy on swipe | offset x = **off × 48 pt**; opacity = **max(0, 1 − |off| × 1.4)** |
| Paging | Snap one page at a time. **Next** animates to the next page with `settle(450)`. |
| Dots | Width 8↔24 pt **360 ms** `settle`; color and opacity **200 ms**. The active dot follows the nearest page while dragging. |
| Button label | Swaps to “Get started” on slide 4 (no animation; announce the new slide). |
| Aurora | Repeats forever, autoreversing: offset (−3%, 2%) rotation 0° → (4%, −3%) rotation 10°, **22 s** `easeInOut`. |
| **Finish** (Skip or Get started) | Whole onboarding: opacity 1→0, scale 1→1.04 · **420 ms** `settle`, then show Home (Home runs its own fade-in). Save `onboarded = true` (`@AppStorage`). |
| Edge swipe | Swiping back on slide 1 does nothing (no navigation stack yet). |

### 3.4 SwiftUI sketch

```swift
struct Onboarding: View {
    var onDone: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @AppStorage("onboarded") private var onboarded = false
    @State private var page: Int? = 0
    @State private var seen: Set<Int> = []
    @State private var exiting = false

    var body: some View {
        ZStack(alignment: .top) {
            Color("bg").ignoresSafeArea()
            Stage(animateAurora: !reduceMotion).frame(height: 440)
            VStack(spacing: 0) {
                TopBar(onSkip: finish)
                GeometryReader { outer in
                    ScrollView(.horizontal) {
                        LazyHStack(spacing: 0) {
                            ForEach(0..<4, id: \.self) { i in
                                GeometryReader { g in
                                    let off = reduceMotion ? 0 : g.frame(in: .scrollView).minX / outer.size.width
                                    Slide(index: i, offset: off,
                                          intro: i == 0 && !reduceMotion,
                                          landed: page == i,
                                          seen: seen.contains(i) || reduceMotion)
                                }
                                .frame(width: outer.size.width)
                                .id(i)
                            }
                        }
                        .scrollTargetLayout()
                    }
                    .scrollTargetBehavior(.paging)            // iOS 17; on iOS 16 use TabView(.page) + a preference for the offset
                    .scrollPosition(id: $page)
                    .scrollIndicators(.hidden)
                }
                Footer(active: page ?? 0, count: 4,
                       label: page == 3 ? "Get started" : "Next",
                       onNext: next)
            }
        }
        .scaleEffect(exiting ? 1.04 : 1).opacity(exiting ? 0 : 1)
        .onChange(of: page) { _, p in
            guard let p, !seen.contains(p) else { return }
            UIAccessibility.post(notification: .announcement, argument: "\(Slides[p].title). Slide \(p + 1) of 4.")
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.9) { seen.insert(p) }
        }
    }

    private func next() {
        let p = page ?? 0
        if p == 3 { finish(); return }
        if reduceMotion { page = p + 1 } else { withAnimation(.settle(450)) { page = p + 1 } }
    }

    private func finish() {
        onboarded = true
        if reduceMotion { onDone(); return }
        withAnimation(.settle(420)) { exiting = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.42) { onDone() }
    }
}

/// One scene layer: parallax from the scroll offset plus the one-time entrance.
struct SceneLayer<Content: View>: View {
    let z: Double, d: Int, offset: Double, intro: Bool
    @ViewBuilder var content: Content
    @State private var t: Double

    init(z: Double, d: Int, offset: Double, intro: Bool, @ViewBuilder content: () -> Content) {
        self.z = z; self.d = d; self.offset = offset; self.intro = intro
        self.content = content(); _t = State(initialValue: intro ? 0 : 1)
    }
    var body: some View {
        content
            .offset(x: offset * z * 56, y: 24 * (1 - t))
            .scaleEffect(0.94 + 0.06 * t)
            .opacity(t)
            .onAppear {
                guard intro else { return }
                withAnimation(.settle(760).delay(Double(d) * 0.09 + 0.08)) { t = 1 }
            }
    }
}
```

Route: draw `Path` from `M36 196 V120 H150 V68 H236` in the 280 × 216 plan space, `.trim(from: 0, to: drawn)`, `.stroke(Color("cyan"), style: StrokeStyle(lineWidth: 6, lineCap: .round, lineJoin: .round))`; when slide 4 first lands, `withAnimation(.settle(1400).delay(0.5)) { drawn = 1 }`.

Dots: `Capsule().frame(width: active ? 24 : 8, height: 8)` with `.animation(.settle(360), value: active)` and the color/opacity on `.animation(.easeInOut(duration: 0.2), value: active)`.

---

## 4. Accessibility

- Splash: layers hidden from VoiceOver; one “UTSW MyCare is opening” announcement. Any tap skips it.
- Onboarding: each page is an accessibility element group labelled “Slide N of 4”; when the page settles, announce “*Title*. Slide N of 4.” Initial focus on slide 1’s title (`@AccessibilityFocusState`).
- Scene art is decorative (`accessibilityHidden(true)`); the title and body carry the message.
- Support the VoiceOver adjustable action (swipe up/down) on the pager to change slides.
- Skip and Next/Get started are always reachable; targets at least 44 × 44 pt.
- Dynamic Type: title and body scale; keep the art area at 384 pt and let the copy scroll within its slot if needed (footer stays pinned).
- After finishing: announce “Home. You’re exploring as a guest. Sign in any time from the top of Home.”

## 5. Acceptance checklist

- [ ] Launch screen → animated splash shows no flash or color change (both `#004278`).
- [ ] Icon flies into the logo’s icon tile and the wordmark lands with no visible jump at ~1.8 s.
- [ ] Splash exits at 2.5 s (3.02 s with the exit), or immediately on tap.
- [ ] First slide’s layers rise in one after another (90 ms apart).
- [ ] Dragging moves layers at different speeds (z) and fades the copy; release snaps one page.
- [ ] Pins drop and the route draws only the first time their slide lands.
- [ ] Slide 4 says “Get started”; Skip and Get started both fade the flow out (420 ms) to Home.
- [ ] With Reduce Motion on: still splash for 700 ms, no parallax or entrances, route already drawn, instant paging and exit.
- [ ] Dark appearance: stage and splash stay `#004278`; background, cards and text switch to the dark tokens.
- [ ] 120 Hz ProMotion devices run every animation smoothly (no `Timer`-driven frames; use SwiftUI animations or `CADisplayLink`).
