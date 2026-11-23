/* ---------- The app: public pages, or the shell with the page for the route ---------- */
/* EXTRA_GLYPHS: lock */
import { useEffect, useLayoutEffect, useRef, type ComponentType } from 'react';
import { Router, useRoute, useDb, matchRoute, PUBLIC_ROUTES, DEFAULT_ROUTE, Unsaved } from './router';
import { Session } from './session';
import { can, type Role } from './permissions';
import { saveDb } from '../services/services';
import { Shell, DeniedView, NotFoundView } from './Shell';
import { PublicPage } from '../pages/Auth';
import { ModalHost, ToastHost, toast } from '../ui/overlays';
import { announce } from './util';
import { PAGES } from '../pages/registry';
import type { RouteDef } from './nav';

export interface PageProps { route: RouteDef; params: { id?: string }; role: Role }
export type Page = ComponentType<PageProps>;

const DASH_MSG = 'Only the Dashboard is available in this preview.';
const dashSay = () => { if (![...document.querySelectorAll('.toast-msg')].some(t => t.textContent === DASH_MSG)) toast(DASH_MSG); };
const ensureDashSession = () => { if (__DASHBOARD_ONLY__ && !Session.current()) Session.start('u1'); };

type View = { kind: 'public'; name: string } | { kind: 'redirect'; to: string; returnTo?: string; say?: boolean; end?: boolean } | { kind: 'shell'; name: string; route: RouteDef | null; page: Page | null; denied: boolean; title: string };
function resolve(name: string): View {
  if (__DASHBOARD_ONLY__) { const raw = location.hash.slice(1); if (raw !== 'dashboard') return { kind: 'redirect', to: 'dashboard', say: !!raw && Router.loaded }; }
  if (PUBLIC_ROUTES.includes(name) || name.startsWith('reset-')) return { kind: 'public', name };
  if (!Session.current()) return { kind: 'redirect', to: 'login', returnTo: name };
  if (Session.expired()) return { kind: 'redirect', to: 'expired', end: true };
  const role = Session.role()!;
  if (name === 'denied') return { kind: 'shell', name, route: null, page: null, denied: true, title: 'Access denied' };
  const m = matchRoute(name);
  if (!m) return { kind: 'shell', name, route: null, page: null, denied: false, title: 'Page not found' };
  if (!can(role, m.route.item.area, 'view')) return { kind: 'shell', name, route: m.route, page: null, denied: true, title: 'Access denied' };
  const page = PAGES[m.route.pattern] || null;
  return { kind: 'shell', name, route: m.route, page, denied: false, title: page ? m.route.title : 'Page not found' };
}

export function App() {
  const rs = useRoute();
  useDb();
  const view = resolve(rs.name);
  const first = useRef(true);
  /* Redirects happen before paint, without a history entry */
  useLayoutEffect(() => {
    if (view.kind !== 'redirect') return;
    if (view.returnTo !== undefined) Router.returnTo = view.returnTo;
    if (view.say) dashSay();
    if (view.end) Session.end();
    Router.replace(view.to);
  });
  /* Each navigation: keep the session alive, set the title, move focus to the new heading (not on first load,
     so Tab starts at the skip link), and announce the page */
  useEffect(() => {
    if (view.kind === 'redirect') return;
    if (view.kind === 'shell') {
      Session.touch(); saveDb();
      document.title = `${view.title} – MyCare Admin (prototype)`;
      if (!rs.refresh && !first.current) { const h = document.getElementById('page-h'); (h || document.getElementById('main'))?.focus({ preventScroll: true }); window.scrollTo(0, 0); }
      announce(`${view.title} page`);
    }
    first.current = false;
    Router.loaded = true;
  }, [rs.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  if (view.kind === 'redirect') return null;
  if (view.kind === 'public') return <><PublicPage key={`${view.name}:${rs.nonce}`} name={view.name} /><Overlays /></>;
  const role = Session.role()!;
  const m = view.route ? matchRoute(view.name) : null;
  const P = view.page;
  return (
    <>
      <Shell route={view.route}>
        {view.denied ? <DeniedView route={view.route} />
          : !P || !view.route ? <NotFoundView name={view.name} />
          : <P key={`${view.name}:${rs.nonce}`} route={view.route} params={m ? m.params : {}} role={role} />}
      </Shell>
      <Overlays />
    </>
  );
}
const Overlays = () => <><ModalHost /><ToastHost /></>;

/* ---------- Session upkeep ----------
   Activity keeps the simulated session alive; a check every 30 seconds ends it after the idle limit. */
export function startSession(): void {
  let lastTouch = 0;
  (['pointerdown', 'keydown'] as const).forEach(t => document.addEventListener(t, () => {
    if (!Session.current() || Date.now() - lastTouch < 15000) return;
    lastTouch = Date.now(); Session.touch(); saveDb();
  }, { passive: true }));
  setInterval(() => { if (Session.expired()) { Router.navigate('expired'); Session.end(); } }, 30000);
  window.addEventListener('beforeunload', e => { if (Router.guardFn && Unsaved.on) { e.preventDefault(); e.returnValue = ''; } });
  const markIcons = () => document.documentElement.classList.add('ms-ready');
  if (document.fonts && document.fonts.load) {
    document.fonts.load('24px "Material Symbols Rounded"', 'home').then(f => { if (f.length) markIcons(); }).catch(() => {});
    setTimeout(markIcons, 3000);
  } else markIcons();
  if (__DASHBOARD_ONLY__) startDashboardOnly();
}

/* ---------- Dashboard-only build (dashboard.html) ----------
   Signed in as the sample Super Admin, the Dashboard is the only page. Every other link and route is locked:
   links stay visible, marked unavailable, and a click explains instead of navigating. */
function startDashboardOnly(): void {
  ensureDashSession();
  document.body.classList.add('dash-only');
  const ONLY = ['#dashboard', '#main'];
  const locked = (a: Element | null) => !!a && !ONLY.includes(a.getAttribute('href') || '');
  document.addEventListener('click', e => {
    const t = e.target as Element;
    const a = t.closest('a[href^="#"]'), um = t.closest('[data-um]'), sec = t.closest('#sidebar .nav-head');
    if ((a && locked(a)) || um || sec) { e.preventDefault(); e.stopImmediatePropagation(); dashSay(); }
  }, true);
  const mark = () => {
    document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach(a => { if (locked(a) && !a.classList.contains('locked')) { a.classList.add('locked'); a.setAttribute('aria-disabled', 'true'); a.title = 'Not available in this preview'; } });
    document.querySelectorAll('[data-um], #sidebar .nav-head').forEach(b => { if (!b.classList.contains('locked')) { b.classList.add('locked'); b.setAttribute('aria-disabled', 'true'); } });
  };
  new MutationObserver(mark).observe(document.body, { childList: true, subtree: true });
}
export { DEFAULT_ROUTE };
