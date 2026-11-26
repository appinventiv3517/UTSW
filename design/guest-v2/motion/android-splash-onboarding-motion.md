# UTSW MyCare – Splash and Onboarding Motion · Android

Engineering handoff for the guest app’s launch animation and the four onboarding slides, taken from the Nov 25 prototype (`design/guest-v2/guest-flow.html`, jumps **Splash** and **Onboarding**). Every duration, delay, curve and distance below is the value the prototype runs. Units are **dp** (the prototype’s CSS px map 1:1 to dp at a 390-wide phone).

Target: Jetpack Compose (Material 3), `minSdk 24`, with the **AndroidX SplashScreen** library (`androidx.core:core-splashscreen`) for the system launch window.

---

## 1. Shared tokens

### Colors

| Token | Light | Dark | Used for |
|---|---|---|---|
| `brand` | `#004278` | `#004278` (unchanged) | Splash background, onboarding stage |
| `onBlue` | `#FFFFFF` | `#FFFFFF` | Splash bar fill, Skip, logo |
| `onBlueFill` | `#FFFFFF` @ 12% | same | Splash bar track |
| `ringStroke` | `#FFFFFF` @ 40% | same | Splash rings (2 dp inner stroke) |
| `glow` | `#00A9E0` @ 36% | same | Splash glow |
| `bg` | `#F7F8FA` | `#0D1620` | Onboarding background under the stage |
| `surface` | `#FFFFFF` | `#16222E` | Scene cards, pills, chips |
| `text` | `#333333` | `#E6EDF3` | Scene text |
| `text2` | `#5B6770` | `#A6B4C0` | Onboarding body copy |
| `titleBlue` | `#004278` | `#8CC0EA` | Onboarding title |
| `ctl` | `#004278` | `#2D6CA6` | Primary button, active dot |
| `borderStrong` | `#7A8690` | `#7D8E9E` | Inactive dots (at 45% alpha) |
| `cyan` | `#00A9E0` | same | Route line, aurora |
| `magenta` | `#E0004D` | same | Heart, destination pin |
| `pastel` | `#D1DDE6` | same | Map grid, floor-plan rooms |
| `greenInk` | `#2C6E1B` | `#8FD97E` | Elevator badge |

### Easing curves

```kotlin
object MyCareEasing {
    /** iOS-style “ease out quint”: fast start, long settle. Most entrances and the exits. */
    val Settle = CubicBezierEasing(0.32f, 0.72f, 0f, 1f)
    /** Emphasized decelerate. Glow, rings. */
    val Out = CubicBezierEasing(0.2f, 0f, 0f, 1f)
    /** Standard. Progress bar, color changes. */
    val Standard = CubicBezierEasing(0.4f, 0f, 0.2f, 1f)
    /** Aurora drift (CSS ease-in-out). */
    val InOut = CubicBezierEasing(0.42f, 0f, 0.58f, 1f)
}
```

### Reduced motion

Treat **“Remove animations”** (Settings › Accessibility) as reduced motion:

```kotlin
@Composable
fun rememberReducedMotion(): Boolean {
    val ctx = LocalContext.current
    return remember {
        Settings.Global.getFloat(ctx.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
}
```

With reduced motion: no splash choreography (logo shown still for **700 ms**, then cut to onboarding), no parallax, no entrances, no pin drops; the route shows already drawn; Next jumps pages without a slide; exits are instant.

---

## 2. Splash

### 2.1 System launch window (Android 12+ and the compat library)

The system splash can only show a static icon, so it is a **hand-off**, not the animation:

- `windowSplashScreenBackground` = `#004278`
- `windowSplashScreenAnimatedIcon` = the MyCare app icon (adaptive icon foreground, unaltered artwork)
- `postSplashScreenTheme` = the app theme
- Keep it on screen only until the first Compose frame: `installSplashScreen().setKeepOnScreenCondition { !firstFrameDrawn }`.
- Skip the system exit animation (`setOnExitAnimationListener { it.remove() }`): the in-app splash below starts on the **same blue**, so the hand-off is invisible.

> The system window shows the icon at its own size (the platform’s 240 dp icon box with a 160 dp mask). The in-app splash then starts its icon at **scale 0.4 and transparent**, so there is no visible size jump.

### 2.2 In-app animated splash – layers

All centered on screen unless noted. Background `brand`, full bleed (draw behind system bars; status and nav bar icons light).

| # | Layer | Size and shape | Notes |
|---|---|---|---|
| 1 | Glow | Radial gradient, center `glow` → transparent at 70% of radius; radius = 28% of a box 160% the screen size (inset −30%) | Blurred light behind the icon |
| 2–4 | Rings ×3 | 112 × 112 dp, corner 28 dp, **2 dp inner stroke** `ringStroke`, no fill | Same shape as the icon tile |
| 5 | App icon | 112 × 112 dp, corner 26 dp, shadow y 24, blur 48, `#000A1E` @ 40% | The MyCare app icon artwork, unaltered |
| 6 | Wordmark | Reversed “UTSW MyCare” logo, **240 dp wide**, vertically centered (its 40 dp height straddles the center) | Unaltered SVG → VectorDrawable |
| 7 | Progress bar | 64 × 4 dp pill, **72 dp above the bottom**, track `onBlueFill`, fill `onBlue` | Grows from the left |

### 2.3 Timeline (t = 0 when the in-app splash first draws)

| Layer | Start | Duration | From → To | Easing |
|---|---|---|---|---|
| Glow | 0 | 2400 (keyframes) | 0–840 ms: alpha 0→1, scale 0.5→1 · 840–1248: hold · 1248–1680: alpha →0, scale →1.15 · then gone | `Out` per segment |
| Ring 1 | 0 | 1700 | alpha 0.9→0, scale 1→3.4 | `Out` |
| Ring 2 | 200 | 1700 | same | `Out` |
| Ring 3 | 420 | 1700 | same | `Out` |
| Icon in | 0 | 760 | alpha 0→1, scale 0.4→1, rotation −10°→0° | `Settle` |
| Icon out | 1150 | 640 | translationX 0→**−88.5 dp**, scale 1→**0.232**; alpha holds 1 until 60% (1534 ms) then →0 at 1790 ms; shadow fades out | `Settle` |
| Wordmark | 1420 | 640 | alpha 0→1, translationX +16→0 dp | `Settle` |
| Progress bar | 0 | 2200 | scaleX 0→1, pivot left | `Standard` |
| Exit (whole splash) | **2500** (or on tap) | 520 | alpha 1→0, scale 1→1.08 | `Settle` |

- Rings are invisible before their delay (alpha 0), then start at 0.9.
- **Why −88.5 dp and 0.232:** the icon flies into the icon tile inside the 240 dp logo. The logo’s left edge is 120 dp left of center and its icon tile starts 31.5 dp in, so the move is −120 + 31.5 = **−88.5 dp**; the tile is 26 dp square, so the scale is 26 / 112 = **0.232**. These match the prototype; if the production logo artwork or width differs, recompute both from the tile’s position so the icon lands exactly on it.
- The splash sits **on top of onboarding**, which is already composed underneath; the exit reveals it.
- **Tap anywhere** skips to the exit. TalkBack: the splash announces “UTSW MyCare is opening” once (polite live region) and is otherwise hidden from accessibility.
- Total: 2500 ms + 520 ms exit = **3.02 s**.

### 2.4 Compose sketch

```kotlin
@Composable
fun AnimatedSplash(onFinished: () -> Unit) {
    val reduced = rememberReducedMotion()
    val glowA = remember { Animatable(0f) }; val glowS = remember { Animatable(.5f) }
    val rings = List(3) { remember { Animatable(0f) } }       // progress 0..1 per ring
    val iconIn = remember { Animatable(0f) }; val iconOut = remember { Animatable(0f) }
    val word = remember { Animatable(0f) }; val bar = remember { Animatable(0f) }
    val exit = remember { Animatable(0f) }
    var exiting by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        if (reduced) { iconIn.snapTo(1f); delay(700); onFinished(); return@LaunchedEffect }
        launch { glowA.animateTo(1f, tween(840, easing = MyCareEasing.Out)) }
        launch { glowS.animateTo(1f, tween(840, easing = MyCareEasing.Out))
                 delay(408)
                 launch { glowA.animateTo(0f, tween(432, easing = MyCareEasing.Out)) }
                 glowS.animateTo(1.15f, tween(432, easing = MyCareEasing.Out)) }
        listOf(0, 200, 420).forEachIndexed { i, d ->
            launch { delay(d.toLong()); rings[i].animateTo(1f, tween(1700, easing = MyCareEasing.Out)) } }
        launch { iconIn.animateTo(1f, tween(760, easing = MyCareEasing.Settle)) }
        launch { delay(1150); iconOut.animateTo(1f, tween(640, easing = MyCareEasing.Settle)) }
        launch { delay(1420); word.animateTo(1f, tween(640, easing = MyCareEasing.Settle)) }
        launch { bar.animateTo(1f, tween(2200, easing = MyCareEasing.Standard)) }
        delay(2500); exiting = true
    }
    LaunchedEffect(exiting) {
        if (!exiting) return@LaunchedEffect
        exit.animateTo(1f, tween(520, easing = MyCareEasing.Settle)); onFinished()
    }

    Box(
        Modifier.fillMaxSize()
            .graphicsLayer { alpha = 1f - exit.value; val s = 1f + .08f * exit.value; scaleX = s; scaleY = s }
            .background(Color(0xFF004278))
            .clickable(interactionSource = null, indication = null) { exiting = true }
            .semantics { liveRegion = LiveRegionMode.Polite; contentDescription = "UTSW MyCare is opening" },
        contentAlignment = Alignment.Center
    ) {
        Glow(Modifier.graphicsLayer { alpha = glowA.value; scaleX = glowS.value; scaleY = glowS.value })
        rings.forEach { p ->
            val v = p.value
            Box(Modifier.size(112.dp).graphicsLayer {
                    alpha = if (v == 0f) 0f else .9f * (1f - v); val s = 1f + 2.4f * v; scaleX = s; scaleY = s }
                .border(2.dp, Color.White.copy(alpha = .4f), RoundedCornerShape(28.dp)))
        }
        val o = iconOut.value
        Image(painterResource(R.drawable.app_icon), null, Modifier.size(112.dp)
            .graphicsLayer {
                val s = (.4f + .6f * iconIn.value) * (1f - (1f - .232f) * o)
                scaleX = s; scaleY = s
                rotationZ = -10f * (1f - iconIn.value)
                translationX = (-88.5).dp.toPx() * o
                alpha = iconIn.value * (if (o <= .6f) 1f else 1f - (o - .6f) / .4f)
                shadowElevation = 24.dp.toPx() * (1f - o); shape = RoundedCornerShape(26.dp); clip = true
            })
        Image(painterResource(R.drawable.logo_reversed), "UTSW MyCare", Modifier.width(240.dp)
            .graphicsLayer { alpha = word.value; translationX = 16.dp.toPx() * (1f - word.value) })
        ProgressBar(bar.value, Modifier.align(Alignment.BottomCenter).padding(bottom = 72.dp))
    }
}
```

`Glow` draws a `Brush.radialGradient(listOf(Color(0x5C00A9E0), Color.Transparent))` in a box 1.6× the screen; `ProgressBar` is a 64 × 4 dp rounded track with a fill drawn at `scaleX = value`, `transformOrigin = TransformOrigin(0f, .5f)`.

---

## 3. Onboarding

### 3.1 Layout (390 × 844 reference)

| Region | Spec |
|---|---|
| Background | `bg`, full screen, below the status bar |
| Stage | `brand` panel, top **440 dp**, bottom corners 24 dp, clipped; holds the aurora and each slide’s scene |
| Aurora | Two radial gradients inside the stage, in a box inset −30%: cyan @ 34% at (76%, 30%) radius 36%×30%, and `#7BAFD4` @ 20% at (18%, 78%) radius 30%×26% |
| Top bar | 56 dp: reversed logo 188 dp wide (8 dp + 8 dp from the left), **Skip** text button on the right (16 sp semibold, white, 44 dp min target) |
| Pager | Horizontal pager, one page per slide, full width; below the top bar |
| Art area | 384 dp tall; scene canvas **296 × 320 dp** centered (max width = screen − 32) |
| Copy | Padding 32 top, 24 sides; title 28/36 sp bold `titleBlue`, letter spacing −0.01 em, centered; 12 dp gap; body 16/24 sp `text2`, max width 320 dp, centered |
| Footer | Padding 16 top, 24 sides, 40 bottom; 24 dp gap between dots and button |
| Dots | 4 dots, 8 dp gap; inactive 8 × 8 dp `borderStrong` @ 45%; active **24 × 8 dp** `ctl` @ 100% |
| Button | Full width, 48 dp tall, pill, `ctl` fill, white label “Next” + `arrow_forward` (20 dp); on slide 4 the label reads **“Get started”** |

### 3.2 Scenes – layers, position, depth and order

Positions are inside the 296 × 320 scene canvas (left, top). **z** = parallax depth; **d** = entrance order.

**Slide 1 – Find the right doctor**

| Layer | Position, size | z | d |
|---|---|---|---|
| Search pill “Knee pain doctor” (search icon) | 24, 8 · 248 wide | 1.6 | 0 |
| Back card “Rafael Santos, M.D.” (avatar RS, one line) at 90% opacity | 36, 252 · 224 wide | 0.5 | 3 |
| Main card “Avery Morgan, M.D.”, Orthopaedic Surgery, “Accepting new patients” tag, two placeholder lines (92%, 64%) | 12, 72 · 272 wide | 1.0 | 1 |
| Heart bubble (48 dp circle, filled heart `magenta`) | 244, 52 | 2.2 | 2 |

**Slide 2 – Your health in one place**

| Layer | Position | z | d |
|---|---|---|---|
| Sign-in card (lock well, two 32 dp fields, 32 dp blue pill) | 60, 44 · 176 wide | 1.0 | 0 |
| Chip “Visits” (calendar_month) | 0, 16 | 1.8 | 1 |
| Chip “Messages” (chat) | 168, 100 | 2.2 | 2 |
| Chip “Results” (labs) | 0, 196 | 1.6 | 3 |
| Chip “Bills” (credit_card) | 176, 256 | 2.0 | 4 |

**Slide 3 – Find a location near you**

| Layer | Position | z | d |
|---|---|---|---|
| Map tile (tint, 40 dp pastel grid, two white roads at −8° and 12°), radius 24 | 8, 8 · 280 × 232 | 0.6 | 0 |
| Pin `magenta` (inside the map) | 56, 40 | – | 2 |
| Pin `ctl` | 182, 60 | – | 3 |
| Pin `ctl` | 120, 150 | – | 4 |
| Card “Lakeview Primary Care · 2.1 mi · Open until 5 p.m.” | 24, 212 · 248 wide | 1.6 | 5 |

**Slide 4 – Get there, step by step**

| Layer | Position | z | d |
|---|---|---|---|
| Floor plan (`#F2F5F8`, four pastel rooms, blue “you are here” dot at 28, 188), radius 24 | 8, 48 · 280 × 216 | 0.6 | 0 |
| Route line `M36 196 V120 H150 V68 H236`, 6 dp `cyan`, round caps and joins | inside the plan | – | – |
| Destination pin `magenta` | 218, 30 (inside the plan) | – | 6 |
| Pill “Take the elevator to Level 7” (48 dp `greenInk` elevator badge) | 12, 0 · 272 wide | 1.8 | 1 |
| Card “Lakeview Transplant Clinic · 125 ft · Arrive 4:25 p.m.” | 32, 248 · 232 wide | 1.4 | 3 |

Cards: `surface`, radius 16, shadow y 16 blur 40 `#001428` @ 28%. Pills: radius full, shadow y 12 blur 32 @ 24%. Chips: 12 sp bold, 32 dp icon well, shadow y 10 blur 24 @ 22%.

### 3.3 Motion

| Behavior | Spec |
|---|---|
| **Intro (first slide only, on open)** | Every layer with a `d`: alpha 0→1, translationY +24→0 dp, scale 0.94→1 · **760 ms** `Settle` · delay **d × 90 + 80 ms** |
| **Pin drop** (first time a slide lands) | alpha 0→1, translationY −40→0 dp · **640 ms** `Settle` · delay **d × 90 + 120 ms**. Pins stay hidden until their slide first settles. |
| **Route draw** (slide 4, first time) | Path trims from 0→100% (stroke dash offset 420→0) · **1400 ms** `Settle` · delay **500 ms**. Afterwards it stays drawn. |
| “Seen” | 1900 ms after a slide first settles, its pins and route are marked done and never replay. |
| **Swipe parallax** (continuous, follows the finger) | For each slide, `off = (pageIndex − pagerPosition)` in −1…1. Each scene layer: translationX = **off × z × 56 dp**. Pins inherit their map. |
| Copy on swipe | translationX = **off × 48 dp**; alpha = **max(0, 1 − |off| × 1.4)** |
| Paging | Snap one page at a time (no fling past a page). **Next** animates to the next page: 450 ms `Settle`. |
| Dots | Width 8↔24 dp **360 ms** `Settle`; color and alpha **200 ms**. The active dot follows the nearest page while dragging. |
| Button label | Swaps to “Get started” on slide 4 (no animation; announce the new slide). |
| Aurora | Infinite, reverse: translate (−3%, 2%) rot 0° → (4%, −3%) rot 10°, **22 s** `InOut`. |
| **Finish** (Skip or Get started) | Whole onboarding: alpha 1→0, scale 1→1.04 · **420 ms** `Settle`, then show Home (Home runs its own fade-in). Save `onboarded = true`. |
| Back | System back on slides 2–4 goes to the previous slide; on slide 1 it leaves the app. |

### 3.4 Compose sketch

```kotlin
@Composable
fun Onboarding(onDone: () -> Unit) {
    val reduced = rememberReducedMotion()
    val pager = rememberPagerState { 4 }
    val scope = rememberCoroutineScope()
    val seen = remember { mutableStateListOf<Int>() }
    val exit = remember { Animatable(0f) }
    fun finish() = scope.launch {
        if (!reduced) exit.animateTo(1f, tween(420, easing = MyCareEasing.Settle)); onDone() }

    LaunchedEffect(pager.settledPage) {
        val p = pager.settledPage
        if (p !in seen) { delay(1900); seen += p }
    }

    Box(Modifier.fillMaxSize().background(MyCare.bg)
        .graphicsLayer { alpha = 1f - exit.value; val s = 1f + .04f * exit.value; scaleX = s; scaleY = s }) {
        Stage(Modifier.fillMaxWidth().height(440.dp), animateAurora = !reduced)
        Column(Modifier.fillMaxSize()) {
            TopBar(onSkip = ::finish)
            HorizontalPager(pager, Modifier.weight(1f), beyondViewportPageCount = 1,
                flingBehavior = PagerDefaults.flingBehavior(pager, pagerSnapDistance = PagerSnapDistance.atMost(1))) { page ->
                val off = (page - (pager.currentPage + pager.currentPageOffsetFraction))
                Slide(
                    index = page,
                    offset = if (reduced) 0f else off,          // drives off × z × 56 dp and the copy fade
                    intro = page == 0 && !reduced,              // 760 ms rise-in, delay d × 90 + 80
                    landed = pager.settledPage == page,         // triggers pin drop and route draw once
                    seen = page in seen || reduced
                )
            }
            Footer(
                active = pager.currentPage, count = 4,
                label = if (pager.currentPage == 3) "Get started" else "Next",
                onNext = {
                    if (pager.currentPage == 3) finish()
                    else scope.launch {
                        if (reduced) pager.scrollToPage(pager.currentPage + 1)
                        else pager.animateScrollToPage(pager.currentPage + 1,
                            animationSpec = tween(450, easing = MyCareEasing.Settle))
                    }
                })
        }
    }
}

/** One scene layer: parallax from the pager offset plus the one-time entrance. */
@Composable
fun SceneLayer(z: Float, d: Int, offset: Float, intro: Boolean, content: @Composable () -> Unit) {
    val t = remember { Animatable(if (intro) 0f else 1f) }
    LaunchedEffect(intro) { if (intro) { delay(d * 90L + 80); t.animateTo(1f, tween(760, easing = MyCareEasing.Settle)) } }
    Box(Modifier.graphicsLayer {
        translationX = offset * z * 56.dp.toPx()
        alpha = t.value
        translationY = 24.dp.toPx() * (1f - t.value)
        val s = .94f + .06f * t.value; scaleX = s; scaleY = s
    }) { content() }
}
```

Route draw: build the path with `PathParser().parsePathString("M36 196 V120 H150 V68 H236")`, scale it from the 280 × 216 viewBox to the plan’s size, and draw only the measured fraction with `PathMeasure.getSegment(0f, length * progress, dst)`.

Dots: `animateDpAsState(if (active) 24.dp else 8.dp, tween(360, easing = MyCareEasing.Settle))` for width, `animateColorAsState(…, tween(200))` for color.

---

## 4. Accessibility

- Splash: hidden from TalkBack except the single “UTSW MyCare is opening” polite announcement. Any tap skips it.
- Onboarding: each slide is a group labelled “Slide N of 4”; when the page settles, announce “*Title*. Slide N of 4.” Focus starts on slide 1’s title.
- Scene art is decorative (`clearAndSetSemantics {}`); the title and body carry the message.
- Skip and Next/Get started are always reachable; targets are at least 48 × 48 dp.
- Text scales with the system font size; let the copy grow and the art area keep its 384 dp (the footer stays pinned).
- After finishing: announce “Home. You’re exploring as a guest. Sign in any time from the top of Home.”

## 5. Acceptance checklist

- [ ] System splash → in-app splash shows no flash or color change (both `#004278`).
- [ ] Icon flies into the logo’s icon tile and the wordmark lands with no visible jump at ~1.8 s.
- [ ] Splash exits at 2.5 s (3.02 s with the exit), or immediately on tap.
- [ ] First slide’s layers rise in one after another (90 ms apart).
- [ ] Dragging moves layers at different speeds (z) and fades the copy; release snaps one page.
- [ ] Pins drop and the route draws only the first time their slide lands.
- [ ] Slide 4 says “Get started”; Skip and Get started both fade the flow out (420 ms) to Home.
- [ ] With “Remove animations” on: still splash for 700 ms, no parallax or entrances, route already drawn, instant paging and exit.
- [ ] Dark theme: stage and splash stay `#004278`; background, cards and text switch to the dark tokens.
