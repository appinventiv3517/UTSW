/* Drive the prototype to every screen and state, read each one in light and dark with dom2fig.js,
   and write out/<id>.json plus a reference screenshot. Usage: node capture.js [id ...] */
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const HERE = __dirname, OUT = path.join(HERE, 'out'), BASE = 'file://' + path.join(HERE, '..', 'guest-flow.html');
// overlays and onboarding are captured at phone size; scrolling pages are captured full length
const PHONE = new Set(['ob-1','ob-2','ob-3','ob-4','welcome','menu','search','search-history','gsearch','filters','sort','share','e-denied','e-search','e-history']);
fs.mkdirSync(OUT, { recursive: true });
const SRC = fs.readFileSync(path.join(HERE, 'dom2fig.js'), 'utf8');
const W = ms => p => p.waitForTimeout(ms);
const jump = k => async p => { await p.click(`#jumps [data-jump="${k}"]`); await p.waitForTimeout(1400); };
const clickA = sel => async p => { await p.click(sel); await p.waitForTimeout(1000); };
const obTo = i => async p => { await p.evaluate(i => { const t = document.querySelector('#ob-track'); t.scrollLeft = i * t.clientWidth; t.dispatchEvent(new Event('scroll')); }, i); await p.waitForTimeout(900); };
const seq = (...fs) => async p => { for (const f of fs) await f(p); };
const clearStore = async p => { await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (/saved|recent/.test(k)) localStorage.removeItem(k); }); };
// [id, section, label, steps]
const STATES = [
  ['ob-1', '01 Onboarding', 'Onboarding 1', jump('onboarding')],
  ['ob-2', '01 Onboarding', 'Onboarding 2', seq(jump('onboarding'), obTo(1))],
  ['ob-3', '01 Onboarding', 'Onboarding 3', seq(jump('onboarding'), obTo(2))],
  ['ob-4', '01 Onboarding', 'Onboarding 4', seq(jump('onboarding'), obTo(3))],
  ['welcome', '01 Onboarding', 'Welcome', jump('welcome')],
  ['home', '02 Home', 'Home', jump('home')],
  ['menu', '03 Menu', 'Menu', jump('menu')],
  ['search', '04 Search', 'Search · Saved providers', seq(jump('home'), clickA('#tabbar [data-action="open-search"]'))],
  ['search-history', '04 Search', 'Search · Search history', seq(jump('home'), clickA('#tabbar [data-action="open-search"]'), clickA('#yt-history'))],
  ['gsearch', '04 Search', 'Search · Results for “knee”', jump('gsearch')],
  ['find', '05 Find Care', 'Find Care', jump('find')],
  ['suggest', '05 Find Care', 'Find Care · Suggestions', jump('suggest')],
  ['results', '06 Doctors', 'Doctors · Near me', jump('results')],
  ['plain', '06 Doctors', 'Doctors · Plain-language search', jump('plain')],
  ['typo', '06 Doctors', 'Doctors · Spelling correction', jump('typo')],
  ['filters', '06 Doctors', 'Doctors · Filters', jump('filters')],
  ['sort', '06 Doctors', 'Doctors · Sort', jump('sort')],
  ['loading', '06 Doctors', 'Doctors · Loading', seq(jump('loading'), W(-1000))],
  ['profile', '07 Doctor profile', 'Doctor profile', jump('profile')],
  ['missing', '07 Doctor profile', 'Doctor profile · Missing data', jump('missing')],
  ['share', '07 Doctor profile', 'Doctor profile · Share', jump('share')],
  ['wayfinding', '08 Wayfinding', 'Wayfinding', seq(jump('home'), clickA('#tabbar [data-tab="wayfinding"]'))],
  ['saved', '09 Favorites', 'Favorites', jump('saved')],
  ['mychart', '10 MyChart', 'MyChart sign in', jump('mychart')],
  ['locations', '11 Locations', 'Locations', seq(jump('home'), async p => { await p.evaluate(() => { const b = document.querySelector('[data-action="push"][data-v="locations"]'); if (b) b.click(); }); await p.waitForTimeout(1000); })],
  ['medblog', '12 MedBlog and Inbox', 'MedBlog', jump('medblog')],
  ['inbox', '12 MedBlog and Inbox', 'Inbox', seq(jump('menu'), clickA('#drawer [data-v="inbox"]'))],
  ['e-results', '13 Empty states', 'No matching doctors', jump('empty')],
  ['e-error', '13 Empty states', 'Service error', jump('error')],
  ['e-offline', '13 Empty states', 'Offline', jump('offline')],
  ['e-denied', '13 Empty states', 'Location denied', jump('denied')],
  ['e-saved', '13 Empty states', 'No saved providers', seq(jump('home'), clickA('#tabbar [data-tab="saved"]'))],
  ['e-search', '13 Empty states', 'Search · nothing saved yet', seq(jump('home'), clickA('#tabbar [data-action="open-search"]'))],
  ['e-history', '13 Empty states', 'Search · no history yet', seq(jump('home'), clickA('#tabbar [data-action="open-search"]'), clickA('#yt-history'))],
];
const shape = t => t.k + (t.ch ? '(' + t.ch.map(shape).join(',') + ')' : '');
(async () => {
  const only = process.argv.slice(2); const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
    const index = [];
  for (const [id, section, label, go] of STATES) {
    if (only.length && !only.includes(id)) continue;
    const PAGE = BASE + (PHONE.has(id) ? '' : '#capture'); await p.goto('about:blank'); await p.goto(PAGE); await p.waitForTimeout(500);
    const empty = /^e-(saved|search|history)$/.test(id);
    await p.evaluate(empty => { if (empty) { localStorage.removeItem('mycare-guest-saved'); localStorage.removeItem('mycare-guest-recent'); } else { localStorage.setItem('mycare-guest-saved', JSON.stringify(['priya-shah', 'avery-morgan'])); localStorage.setItem('mycare-guest-recent', JSON.stringify(['Knee pain', 'Dermatology', 'Spanish speaking pediatrician'])); } }, empty);
    await p.reload(); await p.waitForTimeout(3000);
    if (PHONE.has(id)) { await p.click('[data-ctl="rm"] [data-v="1"]').catch(() => {}); }
    await p.click('[data-ctl="theme"] [data-v="light"]'); await p.waitForTimeout(200);
    await go(p);
    const read = async th => { await p.click(`[data-ctl="theme"] [data-v="${th}"]`); await p.waitForTimeout(700);
      await p.screenshot({ path: path.join(OUT, `${id}-${th}.png`), clip: await p.locator('#screen').evaluate(e => { const r = e.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }; }), fullPage: true });
      await p.addScriptTag({ content: SRC }); return p.evaluate(() => window.__dom2fig('#screen')); };
    const L = await read('light'), D = await read('dark');
    const same = shape(L.tree) === shape(D.tree);
    fs.writeFileSync(path.join(OUT, id + '.json'), JSON.stringify({ id, section, label, same, light: L, dark: same ? { colors: D.colors, tree: D.tree } : D }));
    index.push({ id, section, label, same, w: L.w, h: L.h, bytes: JSON.stringify(L.tree).length });
    console.log(id, L.w + '×' + L.h, same ? 'paired' : 'DIFFERENT', JSON.stringify(L.tree).length);
  }
  if (!only.length) fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1));
  console.log('errors', errs); await b.close();
})();
