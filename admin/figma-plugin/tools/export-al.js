/* Exports the Login & forgot password flow and the Admin management flow as auto-layout Figma JSON:
     node admin/figma-plugin/tools/export-al.js               → admin/figma-plugin/admin-autolayout.json
     node admin/figma-plugin/tools/export-al.js users-list    → only screens whose id contains "users-list" (for checking)
   Every screen is checked: its auto layout is laid out again with Figma's rules and compared with the browser.
   The export stops with a list of differences if any layer is off by more than 1 px (2 px for text). */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { run, clean, count, stats } = require('./al-convert');
const ROOT = path.resolve(__dirname, '..');
const PORTAL = process.env.PORTAL ? path.resolve(process.env.PORTAL) : path.resolve(ROOT, '..', 'admin-portal.html');
const URL = 'file://' + PORTAL;
const OUT = process.env.OUT || path.join(ROOT, 'admin-autolayout.json');
const KEY = 'utsw-admin-mock-v1', W = 1440, VH = 900;
const wait = ms => new Promise(r => setTimeout(r, ms));
const TOKEN = '6d1c2e0f4a5b47c9a1e2d3f4b5c6d7e8';

/* ---------- Screen setups ---------- */
const withReset = db => { db.auth = { pw: {}, resets: { [TOKEN]: { userId: 'u1', at: Date.now() + 10 * 60 * 1000, used: false } } }; };
const fill = (sel, v) => async p => { await p.fill(sel, v); await wait(150); };
const click = sel => async p => { await p.click(sel); await wait(500); };
const seq = (...fns) => async p => { for (const f of fns) await f(p); };
const openDialog = sel => seq(click(sel), async p => { await p.waitForSelector('dialog[open]'); await wait(300); });
const S = (flow, id, name, route, o = {}) => ({ flow, id, name, route, ...o });
const LOGIN = 'Login & forgot password', USERS = 'Admin management';
const SCREENS = [
  S(LOGIN, 'login', '01 Log in', 'login', { signedOut: 1 }),
  S(LOGIN, 'login-filled', '02 Log in – filled', 'login', { signedOut: 1, act: seq(fill('#login-email', 'dana.whitfield@utsw.example'), fill('#login-pw', 'MyCare#2026')) }),
  S(LOGIN, 'login-error', '03 Log in – invalid credentials', 'login', { signedOut: 1, act: seq(fill('#login-email', 'dana.whitfield@'), fill('#login-pw', 'wrong-password'), click('#login-go'), async () => wait(600)) }),
  S(LOGIN, 'login-show-pw', '04 Log in – password shown', 'login', { signedOut: 1, act: seq(fill('#login-email', 'dana.whitfield@utsw.example'), fill('#login-pw', 'MyCare#2026'), click('#login-form .pw-eye')) }),
  S(LOGIN, 'forgot', '05 Forgot password', 'forgot-password', { signedOut: 1 }),
  S(LOGIN, 'forgot-filled', '06 Forgot password – filled', 'forgot-password', { signedOut: 1, act: fill('#fp-email', 'dana.whitfield@utsw.example') }),
  S(LOGIN, 'forgot-error', '07 Forgot password – invalid email', 'forgot-password', { signedOut: 1, act: seq(fill('#fp-email', 'dana.whitfield@fit'), click('#fp-go')) }),
  S(LOGIN, 'link-sent', '08 Link sent', 'forgot-password', { signedOut: 1, act: seq(fill('#fp-email', 'dana.whitfield@utsw.example'), click('#fp-go'), async () => wait(700)) }),
  S(LOGIN, 'reset-empty', '09 Create new password', `reset-${TOKEN}`, { signedOut: 1, setup: withReset }),
  S(LOGIN, 'reset-partial', '10 Create new password – requirements in progress', `reset-${TOKEN}`, { signedOut: 1, setup: withReset, act: fill('#rp-new', 'password1') }),
  S(LOGIN, 'reset-mismatch', '11 Create new password – passwords don’t match', `reset-${TOKEN}`, { signedOut: 1, setup: withReset, act: seq(fill('#rp-new', 'NewPass#2027'), fill('#rp-cnf', 'NewPass#2028')) }),
  S(LOGIN, 'reset-valid', '12 Create new password – ready', `reset-${TOKEN}`, { signedOut: 1, setup: withReset, act: seq(fill('#rp-new', 'NewPass#2027'), fill('#rp-cnf', 'NewPass#2027')) }),
  S(LOGIN, 'reset-done', '13 Password reset', `reset-${TOKEN}`, { signedOut: 1, setup: withReset, act: seq(fill('#rp-new', 'NewPass#2027'), fill('#rp-cnf', 'NewPass#2027'), click('#rp-go'), async () => wait(700)) }),
  S(LOGIN, 'link-expired', '14 Link expired', 'reset-expired-sample', { signedOut: 1 }),
  S(LOGIN, 'logged-out', '15 Logged out', 'signed-out', { signedOut: 1 }),
  S(LOGIN, 'session-ended', '16 Session ended', 'expired', { signedOut: 1 }),

  S(USERS, 'users-list', '01 All users', 'users'),
  S(USERS, 'users-filters', '02 All users – filters panel', 'users', { act: click('#us-fbtn') }),
  S(USERS, 'users-filter-role', '03 All users – role filter open', 'users', { act: seq(click('#us-fbtn'), click('#us-f-role-dd')) }),
  S(USERS, 'users-filtered', '04 All users – filtered', 'users', { act: seq(click('#us-fbtn'), click('#us-f-role-dd'), click('#us-f-role-o2'), click('#us-f-role-dd'), click('[data-fp="apply"]')) }),
  S(USERS, 'users-no-match', '05 All users – no matches', 'users', { act: fill('#us-q', 'zzzz') }),
  S(USERS, 'users-menu', '06 All users – user menu', 'users', { act: click('.user-btn') }),
  S(USERS, 'create-empty', '07 Create user', 'users-new'),
  S(USERS, 'create-errors', '08 Create user – errors', 'users-new', { act: seq(fill('#f-email', 'not-an-email'), click('#un-go')) }),
  S(USERS, 'create-filled', '09 Create user – filled', 'users-new', { act: seq(fill('#f-first', 'Jordan'), fill('#f-last', 'Reyes'), fill('#f-email', 'jordan.reyes@utsw.example'), click('label[for="f-role-admin"]')) }),
  S(USERS, 'create-leave', '10 Create user – leave without creating', 'users-new', { act: seq(fill('#f-first', 'Jordan'), async p => { await p.evaluate(() => { location.hash = 'users'; }); await p.waitForSelector('dialog[open]'); await wait(300); }) }),
  S(USERS, 'detail-active', '11 User details – active', 'users-u2'),
  S(USERS, 'detail-invited', '12 User details – invited', 'users-u6'),
  S(USERS, 'detail-deactivated', '13 User details – deactivated', 'users-u7'),
  S(USERS, 'detail-self', '14 User details – your own account', 'users-u1'),
  S(USERS, 'detail-edited', '15 User details – unsaved changes', 'users-u2', { act: seq(fill('#f-first', 'Christopher')) }),
  S(USERS, 'dlg-role', '16 Pop-up – change role', 'users-u2', { act: seq(click('label[for="f-role-marketing"]'), openDialog('#ud-save')) }),
  S(USERS, 'dlg-resend', '17 Pop-up – resend invitation', 'users-u6', { act: openDialog('[data-u="resend"]') }),
  S(USERS, 'dlg-deactivate', '18 Pop-up – deactivate account', 'users-u2', { act: openDialog('[data-u="deactivate"]') }),
  S(USERS, 'dlg-deactivate-err', '19 Pop-up – deactivate, reason missing', 'users-u2', { act: seq(openDialog('[data-u="deactivate"]'), click('dialog[open] [data-confirm]')) }),
  S(USERS, 'dlg-reactivate', '20 Pop-up – reactivate account', 'users-u7', { act: openDialog('[data-u="reactivate"]') }),
  S(USERS, 'dlg-delete', '21 Pop-up – delete account', 'users-u2', { act: openDialog('[data-u="delete"]') }),
  S(USERS, 'dlg-leave', '22 Pop-up – leave without saving', 'users-u2', { act: seq(fill('#f-first', 'Christopher'), async p => { await p.evaluate(() => { location.hash = 'users'; }); await p.waitForSelector('dialog[open]'); await wait(300); }) }),
  S(USERS, 'toast-saved', '23 User details – changes saved', 'users-u2', { keepToasts: 1, act: seq(fill('#f-first', 'Christopher'), click('#ud-save'), async () => wait(1400)) }),
  S(USERS, 'admin-list', '24 All users – Admin role (view only)', 'users', { as: 'u2' }),
  S(USERS, 'admin-detail', '25 User details – Admin role (view only)', 'users-u8', { as: 'u2' })
];

(async () => {
  const only = process.argv[2];
  const list = only ? SCREENS.filter(s => only.split(',').some(o => s.id.includes(o))) : SCREENS;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: VH }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await ctx.addInitScript(k => { try { const s = sessionStorage.getItem('__alState'); if (s) { localStorage.setItem(k, s); sessionStorage.removeItem('__alState'); } } catch (e) { /* first load */ } }, KEY);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await wait(300); await p.evaluate(() => localStorage.clear()); await p.reload(); await wait(400);
  await p.click('[data-fill="u1"]'); await p.click('#login-go'); await wait(1500);
  const baseline = JSON.parse(await p.evaluate(k => localStorage.getItem(k), KEY));
  const screens = [], icons = new Set(), report = [];
  let failed = 0;
  for (const sc of list) {
    const st = JSON.parse(JSON.stringify(baseline));
    if (sc.signedOut) st.session = null;
    if (sc.as) { const u = st.db.users.find(x => x.id === sc.as); st.session = { ...st.session, userId: u.id, role: u.role }; }
    if (st.session) st.session.lastActive = Date.now() + 60 * 60 * 1000;
    if (sc.setup) sc.setup(st.db);
    await p.setViewportSize({ width: W, height: VH });
    /* A marker in the data proves the page booted with this screen's state; otherwise it is set again and reloaded */
    st.db.__alMark = sc.id;
    let booted = false;
    for (let tries = 0; tries < 4 && !booted; tries++) {
      await p.goto(`${URL}?s=blank${tries}`); await wait(200);
      await p.evaluate(([k, v]) => { localStorage.setItem(k, v); sessionStorage.setItem('__alState', v); }, [KEY, JSON.stringify(st)]);
      await p.goto(`${URL}?s=${sc.id}&t=${tries}#${sc.route}`); await wait(1500);
      booted = await p.evaluate(([k, id]) => { try { return JSON.parse(localStorage.getItem(k)).db.__alMark === id; } catch (e) { return false; } }, [KEY, sc.id]);
    }
    if (!booted) console.log(`  ! ${sc.id}: the prepared data did not load`);
    await p.waitForFunction(() => !document.querySelector('.state-loading'), null, { timeout: 8000 }).catch(() => {});
    if (sc.act) await sc.act(p);
    await wait(400);
    const popup = await p.evaluate(() => !!document.querySelector('dialog[open], .dd-list, #user-menu:not([hidden]), .tbl-fpanel:not([hidden])'));
    if (!sc.keepToasts) await p.evaluate(() => { const t = document.getElementById('toasts'); if (t) t.querySelectorAll('.toast').forEach(x => { x.style.display = 'none'; }); });
    await p.evaluate(() => { const a = document.activeElement; if (a && a.blur && !a.closest('dialog, .dd-list, #user-menu, .tbl-fpanel')) a.blur(); });
    /* Full-page screens grow to their content; screens with a pop-up stay one window tall, as the pop-up is drawn */
    let H = VH;
    if (!popup && !sc.keepToasts) { H = await p.evaluate(() => Math.max(document.documentElement.scrollHeight, 900)); await p.setViewportSize({ width: W, height: H }); await wait(500); }
    /* Prototype-only notes (the simulated-accounts panel, the mock-data flag) aren't part of the design: hidden so the layout closes up */
    await p.evaluate(() => document.querySelectorAll('.sim-note, .auth-flag').forEach(e => { e.style.display = 'none'; }));
    await wait(100);
    if (process.env.SHOTS) await p.screenshot({ path: path.join(process.env.SHOTS, `p-${sc.id}.png`) });
    await p.addScriptTag({ path: path.join(__dirname, 'al-walk.js') });
    await p.addScriptTag({ path: path.join(__dirname, 'serialize.js') });
    await p.evaluate(() => window.__figMaterialize());
    const box = await p.evaluate(([name, h]) => window.__alWalk({ name, height: h }), [sc.name, H]);
    const { tree, errs: diffs } = run(box);
    if (diffs.length) { failed++; report.push(`✗ ${sc.id}: ${diffs.length} layers off`); diffs.slice(0, 12).forEach(d => report.push(`    ${d}`)); }
    else report.push(`✓ ${sc.id}  ${count(tree)} layers  ${JSON.stringify(stats(tree))}`);
    const walkIcons = n => { if (n.k === 'I') icons.add(`${n.g}${n.f ? '-fill' : ''}`); (n.ch || []).forEach(walkIcons); };
    walkIcons(tree);
    screens.push({ flow: sc.flow, id: sc.id, name: sc.name, w: W, h: H, tree: clean(tree) });
    console.log(report.slice(-1 - (diffs.length ? Math.min(12, diffs.length) : 0)).join('\n'));
  }
  await browser.close();
  /* Icon components: Material Symbols Rounded, weight 500 (the portal's), filled where the portal fills them.
     Fetched by exact name from Google Fonts' icon service, so renamed glyphs (expand_more…) still match. */
  const lib = {};
  const cache = path.join(require('os').tmpdir(), 'al-icons'); fs.mkdirSync(cache, { recursive: true });
  for (const k of [...icons].sort()) {
    const [g, fillv] = k.endsWith('-fill') ? [k.slice(0, -5), 1] : [k, 0];
    const f = path.join(cache, `${k}.svg`);
    if (!fs.existsSync(f)) {
      const url = `https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsrounded/${g}/wght500${fillv ? 'fill1' : ''}/24px.svg`;
      try { require('child_process').execFileSync('curl', ['-sfL', '-o', f, url]); } catch (e) { report.push(`! icon ${k}: couldn't fetch`); continue; }
    }
    lib[k] = fs.readFileSync(f, 'utf8');
  }
  if (failed && !process.env.FORCE) { console.log(`\n${failed} screen(s) have layers out of place. Nothing written.`); console.log(report.filter(r => r.startsWith('!')).join('\n')); process.exit(1); }
  const out = { format: 'utsw-admin-autolayout', version: 1, exported: new Date().toISOString(), font: 'Inter', icons: lib,
    flows: [LOGIN, USERS].map(f => ({ name: f, screens: screens.filter(s => s.flow === f).map(({ flow, ...s }) => s) })).filter(f => f.screens.length) };
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`\n${screens.length} screens, ${Object.keys(lib).length} icons, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB → ${OUT}`);
  console.log(report.filter(r => r.startsWith('!')).join('\n'));
  if (errs.length) console.log('page errors:', [...new Set(errs)].slice(0, 5));
})();
