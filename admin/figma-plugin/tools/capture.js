/* Captures every Admin portal screen (and every empty state) from admin/admin-portal.html and writes ../ui.html, the
   Figma plugin's UI with the screen data inlined. Needs Node and Playwright (Chromium). Run from anywhere:
     node admin/figma-plugin/tools/capture.js            all screens
     node admin/figma-plugin/tools/capture.js campaigns  only screens whose id contains "campaigns" (for checking)
   The portal runs on its mock data, so every capture starts from the same seeded state. */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const PORTAL = path.resolve(ROOT, '..', 'admin-portal.html');
const URL = 'file://' + PORTAL;
const KEY = 'utsw-admin-mock-v1', RAIL = 'utsw-admin-nav-rail';
const W = 1440;
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ---------- Data changes that produce each empty state ---------- */
const dropType = type => db => { Object.keys(db.records).forEach(id => { if (db.records[id].type === type) delete db.records[id]; }); };
const emptyRows = id => db => { const r = db.records[id]; Object.values(r.versions).forEach(v => { v.data.rows = []; }); if (r.draft) r.draft.data.rows = []; };
const emptyLayout = db => { const r = db.records['home-layout-guest']; Object.values(r.versions).forEach(v => { v.data.modules = []; }); if (r.draft) r.draft.data.modules = []; };
const quietDashboard = db => { dropType('campaign')(db); dropType('alert')(db); db.notifications = []; db.audit = []; };
const search = q => async p => { await p.fill('.tbl-search input', q); await wait(500); };
const tab = value => async p => { await p.click(`[role="radio"][data-value="${value}"]`); await wait(900); };
const inject = (sel, html) => async p => { await p.evaluate(([s, h]) => { document.querySelector(s).innerHTML = h; }, [sel, html]); await wait(200); };

/* ---------- Screens ---------- */
const S = (group, id, name, route, o = {}) => ({ group, id, name, route, ...o });
const SCREENS = [
  S('Sign in', 'login', 'Sign in', 'login', { signedOut: true }),
  S('Sign in', 'login-mfa', 'Sign in – multi-factor check', 'login', { signedOut: true, act: async p => { await p.click('#sso'); await p.click('button[type=submit]'); await wait(700); } }),
  S('Sign in', 'signed-out', 'Signed out', 'signed-out', { signedOut: true }),
  S('Dashboard', 'dashboard', 'Dashboard', 'dashboard'),
  S('Dashboard', 'dashboard-rail', 'Dashboard – sidebar collapsed', 'dashboard', { rail: true }),
  S('Analytics and reporting', 'analytics-home', 'Home screen overview', 'analytics-home'),
  S('Analytics and reporting', 'analytics-adoption', 'Adoption and engagement', 'analytics-adoption'),
  S('Analytics and reporting', 'analytics-search', 'Search', 'analytics-search'),
  S('Analytics and reporting', 'analytics-content', 'Content', 'analytics-content'),
  S('Analytics and reporting', 'analytics-care', 'Care and wayfinding', 'analytics-care'),
  S('Analytics and reporting', 'analytics-notifications', 'Notifications', 'analytics-notifications'),
  S('Admin management', 'users', 'All users', 'users'),
  S('Admin management', 'users-new', 'Create user', 'users-new'),
  S('Admin management', 'users-detail', 'User details', 'users-u5'),
  S('Admin management', 'users-invited', 'User details – invited', 'users-u6'),
  S('Admin management', 'profile', 'My profile', 'profile'),
  S('Home Screen', 'layout-guest', 'Layout – Guest', 'home-layout'),
  S('Home Screen', 'layout-authenticated', 'Layout – Authenticated', 'home-layout', { act: async p => { await p.click('#aud-authenticated'); await wait(1600); } }),
  S('Home Screen', 'campaigns', 'Campaigns', 'home-campaigns'),
  S('Home Screen', 'campaigns-new', 'New campaign', 'home-campaigns-new'),
  S('Home Screen', 'campaigns-detail', 'Campaign – Flu shots are here', 'home-campaigns-campaign-flu'),
  S('Home Screen', 'campaigns-draft', 'Campaign – draft', 'home-campaigns-campaign-frisco'),
  S('Home Screen', 'alerts', 'Emergency alerts', 'home-alerts'),
  S('Home Screen', 'alerts-new', 'New emergency alert', 'home-alerts-new'),
  S('Home Screen', 'alerts-detail', 'Emergency alert – Severe weather', 'home-alerts-alert-weather'),
  S('Home Screen', 'alerts-advisory', 'Emergency alert – Advisory', 'home-alerts-alert-garage'),
  S('Home Screen', 'quick-links', 'Quick links', 'home-quick-links'),
  S('Home Screen', 'quick-links-new', 'New quick link', 'home-quick-links-new'),
  S('Home Screen', 'quick-links-detail', 'Quick link – Message your doctor', 'home-quick-links-quick-link-msg'),
  S('Home Screen', 'services', 'Services and resources', 'home-featured-cards'),
  S('Home Screen', 'services-new', 'New resource card', 'home-featured-cards-new'),
  S('Home Screen', 'services-detail', 'Resource card – Directions on campus', 'home-featured-cards-featured-card-wayres'),
  S('Content and navigation', 'colors', 'Global colors', 'content-colors'),
  S('Content and navigation', 'menu', 'Menu', 'content-drawer'),
  S('Content and navigation', 'app-entry', 'App entry – Welcome', 'content-app-entry'),
  S('Content and navigation', 'app-entry-onboarding', 'App entry – Onboarding', 'content-app-entry', { act: async p => { await p.click('#pv-entry [data-value="onboarding"]'); await wait(900); } }),
  S('Search configuration', 'search-top', 'Top and popular searches', 'search-top'),
  S('Search configuration', 'search-mappings', 'Query mappings', 'search-query-mappings'),
  S('Search configuration', 'search-synonyms', 'Synonyms', 'search-synonyms'),
  S('Search configuration', 'search-specialties', 'Specialty mapping', 'search-specialties'),
  S('Search configuration', 'search-zero', 'Zero-result queries', 'search-zero-results'),
  S('Search configuration', 'search-ranking', 'Ranking', 'search-ranking'),
  S('Audience management', 'segments', 'Audience segments', 'audiences'),
  S('Audience management', 'segments-new', 'New segment', 'audiences-new'),
  S('Audience management', 'segments-detail', 'Segment – Guests', 'audiences-seg-guests'),
  S('Audience management', 'segment-rules', 'Segment rules', 'audiences-rules'),
  S('Audience management', 'targeting', 'Targeting', 'audiences-targeting'),
  S('Notifications', 'notifications', 'All notifications', 'notifications'),
  S('Notifications', 'notifications-new', 'Create notification', 'notifications-new'),
  S('Notifications', 'notifications-sent', 'Notification – sent', 'notifications-n1'),
  S('Notifications', 'notifications-scheduled', 'Notification – scheduled', 'notifications-n3'),
  S('Wayfinding', 'wayfinding', 'Wayfinding files', 'wayfinding'),
  S('Audit and versioning', 'audit', 'Audit logs', 'audit'),
  S('Audit and versioning', 'audit-history', 'Configuration history', 'audit-history'),
  S('Platform operations', 'integrations', 'Integration status', 'platform-integrations'),
  S('Platform operations', 'monitoring', 'Operational monitoring', 'platform-monitoring'),
  S('Administrative settings', 'settings', 'Approved settings', 'admin-settings'),
  S('Administrative settings', 'locations', 'Location-aware configuration', 'admin-settings-locations'),
  /* Every empty state */
  S('Empty states', 'empty-campaigns', 'No campaigns yet', 'home-campaigns', { setup: dropType('campaign') }),
  S('Empty states', 'empty-alerts', 'No emergency alerts yet', 'home-alerts', { setup: dropType('alert') }),
  S('Empty states', 'empty-quick-links', 'No quick links yet', 'home-quick-links', { setup: dropType('quickLink') }),
  S('Empty states', 'empty-services', 'No services and resources yet', 'home-featured-cards', { setup: dropType('featuredCard') }),
  S('Empty states', 'empty-layout', 'Layout – no modules (preview: no modules visible)', 'home-layout', { setup: emptyLayout }),
  S('Empty states', 'empty-preview-tiles', 'Preview – no quick links or resource cards on', 'home-quick-links-new', { setup: db => { dropType('quickLink')(db); dropType('featuredCard')(db); }, act: async p => { await p.evaluate(() => { location.hash = 'home-layout'; }); await wait(400); const lv = await p.$('dialog[open] button:has-text("Leave page")'); if (lv) await lv.click(); await wait(1800); await p.click('#pv-alert'); await wait(900); } }),
  S('Empty states', 'empty-segments', 'No audience segments yet', 'audiences', { setup: dropType('segment') }),
  S('Empty states', 'empty-notifications', 'No notifications yet', 'notifications', { setup: db => { db.notifications = []; } }),
  S('Empty states', 'empty-search-top', 'No top or popular searches yet', 'search-top', { setup: emptyRows('search-top') }),
  S('Empty states', 'empty-mappings', 'No query mappings yet', 'search-query-mappings', { setup: emptyRows('search-mappings') }),
  S('Empty states', 'empty-synonyms', 'No synonyms yet', 'search-synonyms', { setup: emptyRows('search-synonyms') }),
  S('Empty states', 'empty-specialties', 'No specialty mappings yet', 'search-specialties', { setup: emptyRows('search-specialties') }),
  S('Empty states', 'empty-zero', 'No zero-result searches', 'search-zero-results', { setup: db => { db.zeroResults = []; } }),
  S('Empty states', 'empty-locations', 'No facilities yet', 'admin-settings-locations', { setup: emptyRows('locations') }),
  S('Empty states', 'empty-versions', 'History – no versions yet', 'home-campaigns-campaign-frisco', { setup: db => { db.records['campaign-frisco'].events = []; } }),
  S('Empty states', 'empty-changes', 'History – no changes yet', 'home-campaigns-campaign-frisco', { setup: db => { db.records['campaign-frisco'].events = []; }, act: tab('events') }),
  S('Empty states', 'empty-analytics-notifications', 'Analytics – no sent notifications', 'analytics-notifications', { setup: db => { db.notifications.forEach(n => { n.stats = null; }); } }),
  S('Empty states', 'empty-analytics-range', 'Analytics – no data for this range', 'analytics-adoption', { act: inject('#an-body', '<div class="state state-empty"><span class="ms s32" aria-hidden="true">monitoring</span><h2>No data for this range</h2><p>Try a longer date range.</p></div>') }),
  S('Empty states', 'empty-dashboard', 'Dashboard – nothing scheduled, nothing live', 'dashboard', { setup: quietDashboard }),
  S('Empty states', 'empty-no-matches', 'Table – no matches for a search', 'home-campaigns', { act: search('zzzz') }),
  S('Empty states', 'empty-users-no-matches', 'Users – no matches', 'users', { act: search('zzzz') }),
  S('Empty states', 'denied', 'Access denied', 'denied'),
  S('Empty states', 'not-found', 'Page not found', 'no-such-page'),
  S('Error states', 'error-list', 'Campaigns – couldn’t load', 'home-campaigns', { prefs: { simulateErrors: true } }),
  S('Error states', 'error-dashboard', 'Dashboard – couldn’t load', 'dashboard', { prefs: { simulateErrors: true } })
];

(async () => {
  const only = process.argv[2];
  const list = only ? SCREENS.filter(s => only.split(',').some(o => s.id.includes(o))) : SCREENS;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  /* The prepared state is applied before the app boots, so nothing in flight can overwrite it */
  await ctx.addInitScript(([k, r]) => { try { const s = sessionStorage.getItem('__figState'); if (s) { const o = JSON.parse(s); localStorage.setItem(k, o.db); if (o.rail) localStorage.setItem(r, '1'); else localStorage.removeItem(r); sessionStorage.removeItem('__figState'); } } catch (e) { /* first load */ } }, [KEY, RAIL]);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await wait(300); await p.evaluate(() => localStorage.clear()); await p.reload(); await wait(400);
  await p.click('#sso'); await p.click('button[type=submit]'); await wait(300); await p.click('#mfa-ok'); await wait(1500);
  const baseline = await p.evaluate(k => localStorage.getItem(k), KEY);
  const fontUrl = decodeURIComponent(fs.readFileSync(PORTAL, 'utf8').match(/const ICON_FONT_URL = "([^"]+)"/)[1]);

  const assets = {}, iconKeys = new Set(), out = [];
  const addAsset = (buf, mime) => { const h = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 14); assets[h] = { m: mime, d: buf.toString('base64') }; return h; };
  for (const sc of list) {
    const t0 = Date.now();
    const st = JSON.parse(baseline);
    if (sc.signedOut) { st.session = null; }
    if (sc.setup) sc.setup(st.db);
    st.prefs = { ...(st.prefs || {}), ...(sc.prefs || {}) };
    await p.setViewportSize({ width: W, height: 900 });
    /* A new query string makes every screen a fresh document. A marker in the data proves the app booted with this
       screen's state; if anything wrote over it, the state is set again and the page reloaded. */
    st.db.__figMark = sc.id;
    const state = JSON.stringify({ db: JSON.stringify(st), rail: !!sc.rail });
    let ok = false;
    for (let tries = 0; tries < 4 && !ok; tries++) {
      await p.evaluate(v => { sessionStorage.setItem('__figState', v); }, state);
      if (tries) await p.evaluate(([k, v]) => { localStorage.setItem(k, JSON.parse(v).db); }, [KEY, state]);
      await p.goto(`${URL}?screen=${encodeURIComponent(sc.id)}&try=${tries}#${sc.route}`); await wait(1900);
      ok = await p.evaluate(([k, id]) => { try { return JSON.parse(localStorage.getItem(k)).db.__figMark === id; } catch (e) { return false; } }, [KEY, sc.id]);
    }
    if (!ok) console.log(`  ! ${sc.id}: the prepared data did not load`);
    if (sc.act) await sc.act(p);
    await p.waitForFunction(() => !document.querySelector('.state-loading'), null, { timeout: 8000 }).catch(() => {});
    await p.evaluate(() => { const t = document.getElementById('toasts'); if (t) t.innerHTML = ''; document.activeElement && document.activeElement.blur && document.activeElement.blur(); });
    /* Grow the viewport to the full page so sticky and fixed parts sit where they belong */
    for (let i = 0; i < 3; i++) { const h = await p.evaluate(() => Math.max(document.documentElement.scrollHeight, 900)); await p.setViewportSize({ width: W, height: Math.min(h, 12000) }); await wait(700); }
    await p.addScriptTag({ path: path.join(__dirname, 'serialize.js') });
    await p.evaluate(() => window.__figMaterialize());
    const { root, shots } = await p.evaluate(() => window.__figSerialize());
    const shotHash = {};
    for (const s of shots) {
      const el = await p.$(`[data-fig-shot="${s.id}"]`); if (!el) continue;
      const buf = await el.screenshot(s.jpeg ? { type: 'jpeg', quality: 86 } : { type: 'png' }).catch(() => null);
      if (buf) shotHash[s.id] = addAsset(buf, s.jpeg ? 'image/jpeg' : 'image/png');
    }
    const fix = n => {
      if (n.t === 'img' && n.shot) { n.a = shotHash[n.shot]; delete n.shot; }
      if (n.t === 'icon') iconKeys.add(n.key);
      (n.ch || []).forEach(fix);
      if (n.ch) n.ch = n.ch.filter(c => !(c.t === 'img' && !c.a));
    };
    fix(root);
    out.push({ id: sc.id, group: sc.group, name: sc.name, route: sc.route, w: root.w, h: root.h, root });
    console.log(`${sc.id.padEnd(30)} ${root.w}×${root.h}  ${Math.round(JSON.stringify(root).length / 1024)} KB  ${((Date.now() - t0) / 1000).toFixed(1)} s${errs.length ? `  PAGE ERRORS: ${errs.splice(0).join(' | ')}` : ''}`);
  }

  /* Icons: each glyph, size, color and fill drawn once on a transparent page, at 3× */
  const ip = await (await browser.newContext({ deviceScaleFactor: 3 })).newPage();
  await ip.setContent(`<!doctype html><html><head><link rel="stylesheet" href="${fontUrl.replace(/&/g, '&amp;')}"><style>html,body{margin:0;background:transparent}#i{display:inline-block;font-family:"Material Symbols Rounded";line-height:1;width:1em;height:1em;overflow:hidden;font-feature-settings:"liga";-webkit-font-smoothing:antialiased;text-align:center}</style></head><body><span id="i">home</span></body></html>`);
  await ip.evaluate(() => document.fonts.ready); await wait(1500);
  const iconHash = {};
  for (const key of iconKeys) {
    const [glyph, size, col, fvs] = key.split('|');
    await ip.evaluate(([g, s, c, f]) => { const e = document.getElementById('i'); e.textContent = g; e.style.fontSize = s + 'px'; e.style.color = c; e.style.fontVariationSettings = f; }, [glyph, size, col, fvs]);
    await ip.evaluate(() => document.fonts.ready);
    iconHash[key] = addAsset(await (await ip.$('#i')).screenshot({ omitBackground: true }), 'image/png');
  }
  const swap = n => { if (n.t === 'icon') { n.t = 'img'; n.a = iconHash[n.key]; n.icon = 1; delete n.key; } (n.ch || []).forEach(swap); };
  out.forEach(s => swap(s.root));
  await browser.close();

  const used = new Set(); const mark = n => { if (n.a) used.add(n.a); (n.ch || []).forEach(mark); }; out.forEach(s => mark(s.root));
  Object.keys(assets).forEach(h => { if (!used.has(h)) delete assets[h]; });
  const json = v => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const tpl = fs.readFileSync(path.join(ROOT, 'ui.template.html'), 'utf8');
  const html = tpl.replace('/*__DATA__*/', `window.SCREENS = ${json(out)};\nwindow.ASSETS = ${json(assets)};\nwindow.CAPTURED = ${json(new Date().toISOString())};`);
  fs.writeFileSync(path.join(ROOT, only ? 'ui.partial.html' : 'ui.html'), html);
  console.log(`\n${out.length} screens, ${Object.keys(assets).length} images, ui${only ? '.partial' : ''}.html ${(html.length / 1048576).toFixed(1)} MB`);
  if (errs.length) console.log('Page errors:', errs);
})();
