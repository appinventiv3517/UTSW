/* Exports the guest Splash, Onboarding and Home flows (every Home scenario and pop-up) as auto-layout Figma JSON:
     node design/guest-v2/figma-autolayout/tools/export-guest.js            → ../guest-autolayout.json
     node .../export-guest.js home-why                                   → only screens whose id contains "home-why"
   Each screen is laid out again with Figma's auto-layout rules and compared with the browser; if any layer is off by more
   than 1 px (2 px for text) nothing is written. Needs Playwright and the local three.js copy (THREE=path) for the 3D map. */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { run, clean, count, stats } = require('./al-convert');
const PAGE = 'file://' + path.resolve(__dirname, '..', '..', 'guest-flow.html');
const OUT = process.env.OUT || path.resolve(__dirname, '..', 'guest-autolayout.json');
const THREE = process.env.THREE ? fs.readFileSync(process.env.THREE) : null;
const W = 390, VH = 844;
const wait = ms => new Promise(r => setTimeout(r, ms));
const jump = k => async p => { await p.click(`[data-jump="${k}"]`); await wait(900); };
const tap = sel => async p => { await p.click(`#screen ${sel}`); await wait(700); };
const ctl = (k, v) => async p => { await p.click(`[data-ctl="${k}"] [data-v="${v}"]`); await wait(300); };
const scrollTo = sel => async p => { await p.evaluate(s => { const v = document.querySelector('#view'), e = document.querySelector('#view ' + s); if (e) v.scrollTop = e.getBoundingClientRect().top - v.getBoundingClientRect().top + v.scrollTop - 16; }, sel); await wait(400); };
const seq = (...f) => async p => { for (const x of f) await x(p); };
const S = (flow, id, name, act, o = {}) => ({ flow, id, name, act, ...o });
const START = 'Splash and onboarding', HOME = 'Home', WAY = 'Wayfinding and directions';
const why = k => seq(jump('geo-why'), tap(`[data-action="geo-why"][data-k="${k}"]`));
const nav = (k, extra) => seq(jump('geo-nav'), async p => { for (let i = 0; i < k; i++) { await p.click('#screen [data-action="geo-step"][data-d="1"]'); await wait(300); } }, extra || (async () => {}));
const SCREENS = [
  /* The splash lifts by itself: a still copy is kept the moment it shows, and onboarding underneath is hidden */
  S(START, 'splash', '01 Splash', async p => { await p.click('[data-jump="splash"]'); await wait(150);
    await p.evaluate(() => { const s = document.getElementById('splash'), c = s.cloneNode(true); c.id = 'splash-still'; c.hidden = false; c.classList.remove('out'); s.after(c); s.style.display = 'none'; const ob = document.getElementById('ob'); if (ob) ob.hidden = true; }); }, { fixed: 1, keepSplash: 1 }),
  S(START, 'ob-1', '02 Onboarding – 1 Find care', seq(jump('onboarding')), { fixed: 1 }),
  S(START, 'ob-2', '03 Onboarding – 2 MyChart', seq(jump('onboarding'), tap('[data-action="ob-next"]')), { fixed: 1 }),
  S(START, 'ob-3', '04 Onboarding – 3 Location', seq(jump('onboarding'), tap('[data-action="ob-next"]'), tap('[data-action="ob-next"]')), { fixed: 1 }),
  S(START, 'ob-4', '05 Onboarding – 4 Wayfinding', seq(jump('onboarding'), tap('[data-action="ob-next"]'), tap('[data-action="ob-next"]'), tap('[data-action="ob-next"]')), { fixed: 1 }),

  S(HOME, 'home', '01 Home – guest', seq(ctl('alerts', '0'), jump('home'))),
  S(HOME, 'home-alerts', '02 Home – with alerts', seq(ctl('alerts', '2'), jump('home'))),
  S(HOME, 'home-alerts-more', '03 Home – alerts, all shown', seq(ctl('alerts', '2'), jump('home'), tap('.more-alerts'))),
  S(HOME, 'pop-alert', '04 Pop-up – alert details', seq(ctl('alerts', '2'), jump('home'), tap('.alert-toggle'), tap('[data-action="alert-details"]')), { fixed: 1, popup: 1 }),
  S(HOME, 'pop-menu', '05 Pop-up – menu', seq(ctl('alerts', '0'), jump('menu')), { fixed: 1, popup: 1 }),
  S(HOME, 'pop-menu-full', '05 Pop-up – menu, full length (to Follow us and legal)', seq(ctl('alerts', '0'), jump('menu')), { fixed: 1, popup: 1, grow: '#drawer-body' }),
  S(HOME, 'pop-search', '06 Pop-up – search, no recent searches yet', seq(ctl('alerts', '0'), jump('home'), tap('#hero-search')), { fixed: 1, popup: 1 }),
  S(HOME, 'pop-search-recent', '06 Pop-up – search, recent searches', seq(ctl('alerts', '0'), jump('gsearch-recent')), { fixed: 1, popup: 1 }),
  S(HOME, 'pop-search-results', '07 Pop-up – search results', seq(ctl('alerts', '0'), jump('gsearch')), { fixed: 1, popup: 1 }),
  S(HOME, 'home-visit', '08 Home – before a visit', seq(ctl('alerts', '0'), jump('wf-visit'))),
  S(HOME, 'home-why', '09 Home at a facility – why you’re here', seq(ctl('alerts', '0'), jump('geo-why'))),
  S(HOME, 'home-why-appt', '10 Home at a facility – an appointment', seq(ctl('alerts', '0'), why('appt'))),
  S(HOME, 'home-why-visit', '11 Home at a facility – visiting someone', seq(ctl('alerts', '0'), why('visit'))),
  S(HOME, 'home-why-lab', '12 Home at a facility – lab or imaging', seq(ctl('alerts', '0'), why('lab'))),
  S(HOME, 'home-why-pharm', '13 Home at a facility – pharmacy', seq(ctl('alerts', '0'), why('pharm'))),
  S(HOME, 'home-why-care', '14 Home at a facility – I need care', seq(ctl('alerts', '0'), why('care'))),
  S(HOME, 'home-why-look', '15 Home at a facility – guest nearby', seq(ctl('alerts', '0'), why('look'))),
  S(HOME, 'home-why-skip', '16 Home at a facility – not now', seq(ctl('alerts', '0'), why('skip'))),
  S(HOME, 'home-floor2', '17 Home at a facility – Floor 2 map', seq(ctl('alerts', '0'), why('look'), tap('.gh-fl[data-f="2"]'))),
  S(HOME, 'place-cafe', '18 Place – café menu', seq(ctl('alerts', '0'), jump('geo-place'))),
  S(HOME, 'place-lab', '19 Place – lab prices', seq(ctl('alerts', '0'), why('lab'), tap('[data-action="geo-place"][data-room="lv2-lab"]'))),
  S(HOME, 'locations', '20 Locations', seq(ctl('alerts', '0'), jump('locations'))),
  S(HOME, 'medblog', '21 MedBlog – see all', seq(ctl('alerts', '0'), jump('medblog'))),
  S(HOME, 'mychart-tab', '22 MyChart tab – sign in', seq(ctl('alerts', '0'), jump('home'), tap('.tab[data-tab="mychart"]'))),

  S(WAY, 'way-here', '01 Wayfinding – at a facility', seq(ctl('alerts', '0'), jump('wf-here'), tap('[data-action="push"][data-v="wayfinding"]'))),
  S(WAY, 'pop-where', '02 Pop-up – where are you going', seq(ctl('alerts', '0'), jump('wf-here'), tap('[data-action="push"][data-v="wayfinding"]'), tap('[data-action="geo-where"]')), { fixed: 1, popup: 1 }),
  S(WAY, 'way-visit', '03 Wayfinding – before a visit', seq(ctl('alerts', '0'), jump('wf-visit'), tap('.wf-ctx-go'))),
  S(WAY, 'way-other', '04 Wayfinding – another location', seq(ctl('alerts', '0'), jump('wayfinding'))),
  S(WAY, 'nav-hall', '05 Directions – main hall', nav(0), { fixed: 1 }),
  S(WAY, 'nav-lift', '06 Directions – turn to the elevator', nav(1), { fixed: 1 }),
  S(WAY, 'nav-ride', '07 Directions – elevator ride', nav(2), { fixed: 1 }),
  S(WAY, 'nav-exit', '08 Directions – out of the elevator', nav(3), { fixed: 1 }),
  S(WAY, 'nav-live', '09 Directions – live view', nav(3, tap('[data-action="geo-live"]')), { fixed: 1 }),
  S(WAY, 'nav-overview', '10 Directions – route overview', nav(1, tap('[data-action="geo-all"]')), { fixed: 1 }),
  S(WAY, 'nav-arrived', '11 Directions – arrived', nav(4), { fixed: 1 }),
  S(WAY, 'nav-drive', '12 Directions – from the street', seq(ctl('alerts', '0'), jump('wf-visit'), tap('.wf-ctx-go'), tap('[data-action="geo-out"][data-room="lv2-pc"]')), { fixed: 1 }),
  S(WAY, 'nav-garage', '13 Directions – into the garage', seq(ctl('alerts', '0'), jump('wf-visit'), tap('.wf-ctx-go'), tap('[data-action="geo-out"][data-room="lv2-pc"]'), tap('[data-action="geo-step"][data-d="1"]')), { fixed: 1 })
];
/* Numbered in order within each flow */
const NUM = {}; SCREENS.forEach(x => { NUM[x.flow] = (NUM[x.flow] || 0) + 1; x.name = String(NUM[x.flow]).padStart(2, '0') + ' ' + x.name.replace(/^\d+ /, ''); });
/* Splash, Onboarding and Home by default; ALL=1 adds Wayfinding and directions */
const FLOWS = process.env.ALL ? [START, HOME, WAY] : [START, HOME];

(async () => {
  const only = process.argv[2];
  const list = (only ? SCREENS.filter(s => only.split(',').some(o => s.id.includes(o))) : SCREENS).filter(s => FLOWS.includes(s.flow));
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const screens = [], report = [];
  let failed = 0;
  for (const sc of list) {
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 1000 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    if (THREE) await p.route('**/three.js/r128/three.min.js', r => r.fulfill({ status: 200, body: THREE, contentType: 'application/javascript' }));
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(PAGE); await wait(1200);
    /* the prototype opens on the splash and onboarding: close them, then set the scenario */
    await p.evaluate(() => { localStorage.clear(); });
    await p.reload(); await wait(1500);
    await p.click('[data-ctl="rm"] [data-v="1"]').catch(() => {}); await wait(200);
    await p.click('[data-ctl="theme"] [data-v="light"]').catch(() => {});
    await p.evaluate(() => { const s = document.querySelector('#splash'); if (s && !s.hidden) s.click(); }); await wait(600);
    await p.evaluate(() => { const b = document.querySelector('#ob:not([hidden]) .ob-skip, #ob:not([hidden]) [data-action="ob-skip"]'); if (b) b.click(); }); await wait(600);
    await sc.act(p); await wait(sc.keepSplash ? 0 : 1800);
    if (!sc.keepSplash) await p.evaluate(() => { const t = document.getElementById('toast'); if (t) t.classList.remove('show', 'on'); });
    /* The phone screen becomes the page: one frame, 390 wide; scrolling screens grow to their full content */
    const H = await p.evaluate(([fixed, VH, grow]) => {
      const sc = document.getElementById('screen'), v = document.getElementById('view');
      /* moving the screen resets every scroll position (the onboarding track, lists): keep them */
      const scrolled = [...sc.querySelectorAll('*')].filter(e => e.scrollLeft || e.scrollTop).map(e => [e, e.scrollLeft, e.scrollTop]);
      document.body.prepend(sc);
      const fm = document.createElement('style'); fm.textContent = '#screen, #screen *{font-optical-sizing:none!important}'; document.head.appendChild(fm);
      scrolled.forEach(([e, l, t]) => { e.scrollLeft = l; e.scrollTop = t; });
      /* Onboarding: only the slide on screen is part of the frame */
      const on = sc.querySelector('#ob:not([hidden]) .ob-slide.on');
      if (on) { const ob = sc.querySelector('#ob'), d = ob.querySelector('.ob-dots'), nx = ob.querySelector('[data-action="ob-next"]'); window.__obKeep = { on, dots: d && d.innerHTML, next: nx && nx.innerHTML };
        sc.querySelectorAll('#ob .ob-slide:not(.on)').forEach(x => { x.style.display = 'none'; }); const tr = on.parentElement; tr.scrollLeft = 0; tr.style.transform = 'none'; } document.querySelector('.page')?.remove();
      document.body.style.margin = '0'; document.body.style.background = 'transparent';
      Object.assign(sc.style, { borderRadius: '0', margin: '0', position: 'relative', boxShadow: 'none' });
      let h = VH;
      if (!fixed) { v.scrollTop = 0; const chrome = sc.getBoundingClientRect().height - v.getBoundingClientRect().height; h = Math.ceil(chrome + v.scrollHeight); }
      /* a scrolling panel (the menu) shown at full length: the screen grows by what the panel hides */
      if (grow) { const g = sc.querySelector(grow); if (g) { g.scrollTop = 0; h = VH + Math.ceil(g.scrollHeight - g.clientHeight); } }
      sc.style.height = h + 'px';
      const a = document.activeElement; if (a && a.blur && !a.closest('.layer, .drawer-layer, .search-layer, .ob')) a.blur();
      return h;
    }, [!!sc.fixed, VH, sc.grow || '']);
    await p.setViewportSize({ width: W, height: H }); await p.mouse.move(W - 1, 1); await wait(1500); /* no leftover hover from the last tap */
    /* the track's scroll handler re-selects slide 1 after the reset: put the slide's dots and button back */
    await p.evaluate(() => { const k = window.__obKeep; if (!k) return; const ob = document.getElementById('ob'); ob.querySelectorAll('.ob-slide').forEach(x => x.classList.toggle('on', x === k.on));
      const d = ob.querySelector('.ob-dots'), nx = ob.querySelector('[data-action="ob-next"]'); if (d) d.innerHTML = k.dots; if (nx) nx.innerHTML = k.next; }); await wait(300);
    if (process.env.SHOTS) await p.screenshot({ path: path.join(process.env.SHOTS, `g-${sc.id}.png`) });
    await p.addScriptTag({ path: path.join(__dirname, 'al-walk.js') });
    await p.addScriptTag({ path: path.join(__dirname, 'serialize.js') });
    await p.evaluate(() => window.__figMaterialize());
    /* Splash and onboarding cover the app: only their own layers (and the status bar) are exported */
    const exclude = '.sr-only, .ghost-wrap, .ptr, .skip' + (sc.flow === START ? ', #screen > :not(#splash):not(#splash-still):not(#ob):not(.statusbar)' : '');
    const box = await p.evaluate(([name, h, ex]) => window.__alWalk({ name, height: h, exclude: ex }), [sc.name, H, exclude]);
    const { tree, errs: diffs } = run(box);
    if (diffs.length) { failed++; report.push(`✗ ${sc.id}: ${diffs.length} layers off`); diffs.slice(0, 12).forEach(d => report.push(`    ${d}`)); }
    else report.push(`✓ ${sc.id}  ${count(tree)} layers  ${JSON.stringify(stats(tree))}`);
    if (errs.length) report.push(`! ${sc.id} page errors: ${[...new Set(errs)].slice(0, 3).join(' | ')}`);
    screens.push({ flow: sc.flow, id: sc.id, name: sc.name, w: W, h: H, tree: clean(tree) });
    console.log(report.slice(-1 - (diffs.length ? Math.min(12, diffs.length) : 0)).join('\n'));
    await ctx.close();
  }
  await browser.close();
  if (failed && !process.env.FORCE) { console.log(`\n${failed} screen(s) have layers out of place. Nothing written.`); process.exit(1); }
  const out = { format: 'utsw-guest-autolayout', version: 1, exported: new Date().toISOString(), font: 'Inter', icons: {},
    flows: FLOWS.map(f => ({ name: f, screens: screens.filter(s => s.flow === f).map(({ flow, ...s }) => s) })).filter(f => f.screens.length) };
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`\n${screens.length} screens, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB → ${OUT}`);
})();
