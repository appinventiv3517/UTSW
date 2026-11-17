/* ---------- App shell: header, sidebar (role-filtered IA), page heading with breadcrumbs, user menu ---------- */
/* EXTRA_GLYPHS: menu left_panel_close left_panel_open expand_more person logout search_off lock */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NAV, type RouteDef, type NavSection } from './nav';
import { ROLES, can, type Role } from './permissions';
import { Session } from './session';
import { Router, DEFAULT_ROUTE } from './router';
import { LOGO_REVERSED } from './assets';
import { pref, cx } from './util';
import { Badge, Icon, EmptyState } from '../ui/kit';
import type { User } from './types';

/* Desktop sidebar can collapse to an icon rail. Remembered per browser; a convenience only. */
const RAIL_KEY = 'utsw-admin-nav-rail';
const wideQuery = () => window.matchMedia('(min-width: 1024px)');
/* Sections opened by hand stay open until the person moves to another section */
const navOpen = new Set<string>();
let lastSection: string | null = null;

export const visibleNav = (role: Role): NavSection[] =>
  NAV.map(sec => ({ ...sec, items: sec.items.filter(i => can(role, i.area, 'view')) })).filter(sec => sec.items.length);
export const initials = (u: User): string => `${u.first[0]}${u.last[0]}`;

function Sidebar({ route, rail, onNavigate }: { route: RouteDef | null; rail: boolean; onNavigate: () => void }) {
  const role = Session.role()!;
  const cur = route && route.section ? route.section.id : null;
  if (cur && cur !== lastSection) { navOpen.clear(); navOpen.add(cur); lastSection = cur; }
  const [, bump] = useState(0);
  const [fly, setFly] = useState<{ id: string; top: number; focus: boolean } | null>(null);
  const side = useRef<HTMLElement>(null);
  useEffect(() => { setFly(null); }, [rail, route]);
  /* In the rail, a section opens as a flyout beside its icon */
  useEffect(() => {
    if (!fly) return;
    const sub = document.getElementById(`nav-${fly.id}`);
    if (sub) {
      sub.style.top = `${Math.max(8, Math.min(fly.top, window.innerHeight - sub.offsetHeight - 8))}px`;
      if (fly.focus) sub.querySelector<HTMLElement>('a')?.focus();
    }
    const out = (e: MouseEvent) => { if (!(e.target as Element).closest('.nav-sec')) setFly(null); };
    document.addEventListener('click', out);
    return () => document.removeEventListener('click', out);
  }, [fly]);
  const link = (item: RouteDef['item'], label: string, nested: boolean, icon?: string) => (
    <a href={`#${item.route}`} className={cx('nav-link', nested && 'nested')} aria-current={route && route.item === item ? 'page' : undefined} title={rail && !nested ? label : undefined}>
      {icon && <Icon name={icon} size={20} />}<span className="nav-l">{label}</span></a>
  );
  return (
    <nav className="sidebar" id="sidebar" aria-label="Admin sections" ref={side}
      onScroll={() => setFly(null)}
      onClick={e => { if ((e.target as Element).closest('a')) onNavigate(); }}
      onKeyDown={e => { if (e.key === 'Escape' && fly) { e.stopPropagation(); const id = fly.id; setFly(null); side.current?.querySelector<HTMLElement>(`[aria-controls="nav-${id}"]`)?.focus(); } }}>
      <ul className="nav">{visibleNav(role).map(sec => {
        if (sec.items.length === 1 && NAV.find(s => s.id === sec.id)!.items.length === 1) return <li key={sec.id} className="nav-sec single">{link(sec.items[0], sec.label, false, sec.icon)}</li>;
        const open = rail ? fly?.id === sec.id : navOpen.has(sec.id);
        return (
          <li key={sec.id} className={cx('nav-sec', cur === sec.id && 'here')}>
            <button type="button" className="nav-head" data-sec={sec.id} aria-expanded={open} aria-controls={`nav-${sec.id}`} title={rail ? sec.label : undefined}
              onClick={e => {
                if (rail) { if (open) setFly(null); else setFly({ id: sec.id, top: e.currentTarget.getBoundingClientRect().top, focus: e.detail === 0 }); return; }
                open ? navOpen.delete(sec.id) : navOpen.add(sec.id); bump(n => n + 1);
              }}>
              <Icon name={sec.icon} size={20} /><span className="nav-l">{sec.label}</span><Icon name="expand_more" size={20} className="chev" /></button>
            <ul className={cx('nav-sub', rail && 'fly')} id={`nav-${sec.id}`} data-label={sec.label} hidden={!open}>
              {sec.items.map(i => <li key={i.route}>{link(i, i.label, true)}</li>)}</ul>
          </li>
        );
      })}</ul>
      <p className="nav-foot"><Badge kind="pending" text="Role access: proposed" /><span>Navigation follows the proposed permission matrix for {ROLES[role].label}.</span></p>
    </nav>
  );
}

function UserMenu() {
  const u = Session.user()!, role = Session.role()!;
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null), b = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    host.current?.querySelector<HTMLElement>('.um-act')?.focus();
    const out = (e: MouseEvent) => { if (!host.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('click', out);
    return () => document.removeEventListener('click', out);
  }, [open]);
  const act = async (k: 'profile' | 'signout') => {
    setOpen(false);
    if (k === 'profile') { Router.go('profile'); return; }
    if (await Router.canLeave()) { Session.end(); Router.go('signed-out', { force: true }); } else b.current?.focus();
  };
  return (
    <div className="user" id="user" ref={host} onKeyDown={e => { if (e.key === 'Escape' && open) { setOpen(false); b.current?.focus(); } }}>
      <button type="button" className="user-btn" ref={b} aria-expanded={open} aria-controls="user-menu" onClick={() => setOpen(!open)}>
        <span className="avatar" aria-hidden="true">{initials(u)}</span>
        <span className="user-txt"><span className="user-n">{u.first} {u.last}</span><span className="user-r">{ROLES[role].label}</span></span>
        <Icon name="expand_more" size={20} />
      </button>
      <div className="user-menu" id="user-menu" hidden={!open}>
        <div className="um-id"><p className="um-n">{u.first} {u.last}</p><p className="um-e">{u.email}</p><p className="um-s"><span className="role-tag">{ROLES[role].label}</span></p></div>
        <div className="um-acts">
          <button type="button" className="um-act" data-um="profile" onClick={() => act('profile')}><Icon name="person" size={20} /><span>My profile</span></button>
          <button type="button" className="um-act" data-um="signout" onClick={() => act('signout')}><Icon name="logout" size={20} /><span>Sign out</span></button>
        </div>
      </div>
    </div>
  );
}

export function Shell({ route, children }: { route: RouteDef | null; children: ReactNode }) {
  const [railOn, setRailOn] = useState(() => pref.get(RAIL_KEY) === '1');
  const [wide, setWide] = useState(() => wideQuery().matches);
  const [navOpenMobile, setNavOpenMobile] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => { const q = wideQuery(), f = () => setWide(q.matches); q.addEventListener('change', f); return () => q.removeEventListener('change', f); }, []);
  useEffect(() => {
    if (!navOpenMobile) return;
    const side = document.getElementById('sidebar');
    (side?.querySelector<HTMLElement>('[aria-current="page"]') || side?.querySelector<HTMLElement>('a,button'))?.focus();
  }, [navOpenMobile]);
  const setNav = (open: boolean) => setNavOpenMobile(open);
  const railLabel = railOn ? 'Expand navigation' : 'Collapse navigation';
  return (
    <div id="app-shell" className={cx('app', navOpenMobile && 'nav-open', railOn && 'nav-rail')}>
      <a className="skip" href="#main" data-skip="" onClick={e => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to main content</a>
      <header className="topbar">
        <button type="button" ref={toggle} className="nav-toggle btn btn-text btn-icon" aria-controls="sidebar" aria-expanded={navOpenMobile} aria-label={navOpenMobile ? 'Hide navigation' : 'Show navigation'}
          onClick={() => setNav(!navOpenMobile)}><Icon name="menu" /></button>
        <button type="button" className="rail-toggle btn btn-text btn-icon" aria-controls="sidebar" aria-expanded={!railOn} aria-label={railLabel} title={railLabel}
          onClick={() => { const v = !railOn; pref.set(RAIL_KEY, v ? '1' : '0'); setRailOn(v); }}><Icon name={railOn ? 'left_panel_open' : 'left_panel_close'} /></button>
        <a className="brand" href={`#${DEFAULT_ROUTE}`} aria-label="UTSW MyCare Admin, go to the dashboard"><img src={LOGO_REVERSED} alt="" width={200} /><span className="brand-admin" aria-hidden="true">Admin</span></a>
        <UserMenu />
      </header>
      <div className="layout" onKeyDown={e => { if (e.key === 'Escape' && navOpenMobile && (e.target as Element).closest('#sidebar')) { setNav(false); toggle.current?.focus(); } }}>
        <Sidebar route={route} rail={railOn && wide} onNavigate={() => setNav(false)} />
        <div className="scrim" id="scrim" hidden={!navOpenMobile} onClick={() => { setNav(false); toggle.current?.focus(); }}></div>
        <main id="main" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}

/* Page heading with breadcrumbs */
export type Crumb = [string, string | null];
export function PageHead({ crumbs, title, lede, badges, actions, extra }: { crumbs: Crumb[]; title: string; lede?: ReactNode; badges?: ReactNode; actions?: ReactNode; extra?: ReactNode }) {
  return (
    <div className="page-head">
      {crumbs.length > 0 && <nav aria-label="Breadcrumb" className="crumbs"><ol>{crumbs.map(([label, href]) => <li key={label}>{href ? <a href={`#${href}`}>{label}</a> : <span>{label}</span>}</li>)}<li><span aria-current="page">{title}</span></li></ol></nav>}
      <div className="ph-row"><div className="ph-main"><h1 id="page-h" tabIndex={-1}>{title}</h1>{badges && <div className="ph-badges">{badges}</div>}</div>{actions && <div className="ph-actions">{actions}</div>}</div>
      {lede && <p className="lede">{lede}</p>}
      {extra}
    </div>
  );
}
export const crumbsFor = (r: RouteDef): Crumb[] => {
  const c: Crumb[] = [];
  if (r.section.items.length > 1) c.push([r.section.label, null]);
  if (r.parent) c.push([r.parent.label, r.parent.route]);
  return c;
};

/* System pages shown inside the shell */
function SysPage({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="page sys-page"><div className="state state-empty"><Icon name={icon} size={32} /><h1 id="page-h" tabIndex={-1}>{title}</h1><p>{text}</p>
      <a className="btn btn-primary" href={`#${DEFAULT_ROUTE}`}><span className="lbl">Go to the dashboard</span></a></div></div>
  );
}
export function DeniedView({ route }: { route: RouteDef | null }) {
  const role = Session.role()!;
  const what = route ? `${route.section.label}${route.section.items.length > 1 ? ` – ${route.item.label}` : ''}` : 'this page';
  return <SysPage icon="lock" title="You don’t have access to this page"
    text={`Your role, ${ROLES[role].label}, can’t open ${what}. Access follows the proposed permission matrix, which is pending UTSW confirmation. Ask a Super Admin if you need access.`} />;
}
export const NotFoundView = ({ name }: { name: string }) =>
  <SysPage icon="search_off" title="Page not found" text={`There is no page at “#${name}”. Check the link, or use the navigation.`} />;
export { EmptyState };
