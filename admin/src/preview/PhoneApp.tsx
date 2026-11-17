/* Mobile preview – the phone app drawn inside the preview iframe (its own document, so the app's CSS never meets the Admin's).
   Markup follows the UTSW MyCare Guest Flow 2 design (stakeholder update): home modules (tiles … announcements),
   alert banners, the Find Care hero, the floating tab bar, the menu, onboarding and the welcome (sign-in choice) screen.
   It is fed by the configuration the Admin passes in. Every control is inert: the preview shows the configuration,
   it does not run the app. The app UI is light only. */
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { LOGO_ICON_B64, LOGO_REVERSED_B64 } from '../app/assets';
import type { Data } from '../app/types';

/* Glyphs the fixed chrome uses (Material Symbols Rounded). Configurable items pass glyph names from the approved list. */
const ICONS = {
  home: 'home', findCare: 'stethoscope', search: 'search', wayfinding: 'directions_walk', favorites: 'favorite', signIn: 'login',
  menu: 'menu', close: 'close', back: 'arrow_back', expand: 'expand_more', next: 'chevron_right', external: 'open_in_new', go: 'arrow_forward',
  trending: 'trending_up', emergency: 'warning', advisory: 'error', time: 'schedule', place: 'location_on', info: 'info', parking: 'local_parking',
  indoor: 'directions_walk', guest: 'explore', checked: 'check_circle', lock: 'lock', inbox: 'inbox', visits: 'calendar_month', near: 'near_me',
  medicines: 'medication', joints: 'directions_run', heart: 'favorite', prevention: 'vaccines', cancer: 'health_and_safety', pregnancy: 'pregnant_woman',
  article: 'article', newspaper: 'newspaper'
};
const APP_ICON = `data:image/svg+xml;base64,${LOGO_ICON_B64}`;
const LOGO = `data:image/svg+xml;base64,${LOGO_REVERSED_B64}`;

/* An icon by concept (ICONS key) or by glyph name */
const Ico = ({ k, size = 24, cls }: { k: string; size?: number; cls?: string }) =>
  <span className={['ms', size === 24 ? '' : 's' + size, cls].filter(Boolean).join(' ')} aria-hidden="true">{(ICONS as Record<string, string>)[k] || k}</span>;
/* Every control is inert and out of the tab order */
const B = ({ children, ...p }: { children?: ReactNode; className?: string; style?: CSSProperties; 'aria-label'?: string; 'aria-expanded'?: boolean; 'aria-current'?: 'page' }) =>
  <button type="button" tabIndex={-1} {...p}>{children}</button>;
const Well = ({ g }: { g: string }) => <span className="well" aria-hidden="true"><Ico k={g} /></span>;
const Art = ({ svg }: { svg: string }) => <svg viewBox="0 0 304 144" preserveAspectRatio="xMidYMid slice" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
function Row({ g, lead, title, sub, ext, cls, end }: { g?: string; lead?: ReactNode; title: string; sub?: string; ext?: boolean; cls?: string; end?: ReactNode }) {
  return <B className={`row${cls ? ' ' + cls : ''}`}>{lead || <Well g={g!} />}<span className="rt"><b>{title}</b>{sub && <span>{sub}</span>}</span>{end || <Ico k={ext ? 'external' : 'next'} size={20} />}</B>;
}
/* MedBlog topic look: [glyph, art class] – from the design */
const TOPIC: Record<string, [string, string]> = { 'Medicines': ['medicines', 't-blue'], 'Bones and joints': ['joints', 't-orange'], 'Heart health': ['heart', 't-clay'], 'Prevention': ['prevention', 't-green'], 'Cancer': ['cancer', 't-purple'], 'Pregnancy': ['pregnancy', 't-sky'] };
/* Non-breaking spaces where the design keeps words together */
const NB: [RegExp, string][] = [[/(\d) (a\.m\.|p\.m\.|mi\b)/g, '$1 $2'], [/\b(Jan|Feb|Aug|Sept|Oct|Nov|Dec)\. (\d)/g, '$1. $2'], [/UT Southwestern/g, 'UT Southwestern']];
function nbsp(root: Node) {
  const w = root.ownerDocument!.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { const v = NB.reduce((s, [re, to]) => s.replace(re, to), n.nodeValue || ''); if (v !== n.nodeValue) n.nodeValue = v; }
}

/* ---------- Pinned: alerts, then the Find Care hero ---------- */
function AlertCard({ a, open, stacked }: { a: Data; open: boolean; stacked: boolean }) {
  const adv = a.level === 'advisory';
  return (
    <article className={`alert ${adv ? 'advisory' : 'emergency'}${open ? ' open' : ''}${stacked ? ' stacked' : ''}`}>
      <h2><B className="alert-toggle" aria-expanded={open}><span className="sev-ic"><Ico k={adv ? 'advisory' : 'emergency'} cls="f" /></span>
        <span className="alert-txt"><span className="alert-meta"><b>{adv ? 'Advisory' : 'Emergency'}</b> · {a.posted}</span><span className="alert-title">{a.title}</span></span><Ico k="expand" size={20} cls="chev" /></B></h2>
      {open && <div className="alert-body"><p>{a.message}</p>{a.window && <p>{a.window}</p>}
        <div className="row-btns"><B className="btn btn-primary btn-sm">Read full alert</B>{a.dismissible && <B className="btn btn-ghost btn-sm">Dismiss</B>}</div></div>}
    </article>
  );
}
function Alerts({ C }: { C: Data }) {
  const list: Data[] = (C.alerts || []).slice();
  if (!list.length) return null;
  const [first, ...rest] = list;
  return (
    <section className="alerts" aria-label="Active alerts"><AlertCard a={first} open stacked={rest.length > 0} />
      {rest.length > 0 && <B className="more-alerts" aria-expanded={false}><span>{rest.length} more alert{rest.length > 1 ? 's' : ''}</span><Ico k="expand" size={20} /></B>}</section>
  );
}
const Hero = ({ C }: { C: Data }) => (
  <section className="hero" aria-labelledby="h-hero"><span className="aurora" aria-hidden="true"><i></i></span>
    <div className="hero-copy"><h1 className="vh" id="h-hero">UTSW MyCare home</h1>
      <p className="fc-kick"><Ico k="findCare" size={20} />Find Care</p><p className="sub">Search UTSW MyCare for doctors, locations, and more.</p></div>
    <B className="search-entry"><Ico k="search" /><span>Doctors, locations, and more</span></B>
    <div className="top-s"><span className="eyebrow" id="top-h">Top searches</span>
      <div className="chips" role="group" aria-labelledby="top-h">{(C.top || []).slice(0, 4).map((t: string | string[], i: number) => <B key={i} className="chip on-blue-chip"><Ico k="trending" size={16} />{Array.isArray(t) ? t[0] : t}</B>)}</div></div>
  </section>
);

/* ---------- Modules, in the order the Admin sets ---------- */
const Head = ({ id, title, all, extra }: { id: string; title: string; all?: boolean; extra?: ReactNode }) =>
  <div className="mod-head"><h2 className="sec-h" id={`h-${id}`}>{title}</h2>{all && <B className="btn btn-ghost btn-sm">See all</B>}{extra}</div>;
const MODULES: Record<string, (C: Data, guest: boolean) => ReactNode> = {
  tiles: C => { const list: Data[] = (C.quickLinks || []).slice(0, 4); return <><Head id="tiles" title="Quick links" />
    {list.length ? <div className="tiles">{list.map((t, i) => <B key={i} className={`tile${t.highlight ? ' pv-hl' : ''}`}><Well g={t.icon} /><span>{t.title}</span></B>)}</div> : <p className="pv-empty">No quick links are on.</p>}</>; },
  mychart: (_, guest) => !guest ? null : (
    <div className="mychart"><span className="mc-glow" aria-hidden="true"></span>
      <div className="mc-txt"><span className="eyebrow">Already a patient?</span><h2 id="h-mychart">Sign in for more</h2></div>
      <p>Sign in to message your doctor, get your test results, manage your visits, and manage billing.</p>
      <div className="mc-btns"><B className="mc-b mc-solid"><Ico k="signIn" size={20} /><span>Sign in</span></B><B className="mc-b mc-line">Create an account</B></div></div>),
  featured: C => <><Head id="featured" title="MedBlog" all />
    <ul className="h-scroll mb-row" aria-labelledby="h-featured">{(C.blog || []).map((b: Data, i: number) => { const [g, t] = TOPIC[b.cat] || ['article', 't-blue']; return (
      <li key={i} className="mb-item"><B className="card mb-card"><span className={`mb-art ${t}`} aria-hidden="true"><i className="r1"></i><i className="r2"></i><span className="mb-ic"><Ico k={g} cls="f" /></span><span className="mb-read"><Ico k="time" size={16} />{b.read}</span></span>
        <span className="mb-txt"><span className="mb-cat">{b.cat}</span><span className="mb-t">{b.t}</span><span className="mb-d">{b.d}</span></span></B></li>); })}</ul></>,
  campaign: C => { const k = C.campaign; if (!k) return null; return (
    <div className="campaign"><span className="cp-glow" aria-hidden="true"></span><span className="cp-glass" aria-hidden="true"></span>
      <span className="cp-badge" aria-hidden="true"><i className="cp-ring"></i><span className="cp-core"><Ico k={k.icon || 'vaccines'} /></span></span>
      {k.tag && <span className="eyebrow">{k.tag}</span>}<h2 id="h-campaign">{k.title || 'Campaign title'}</h2>
      {k.description && <p>{k.description}</p>}
      {k.ctaLabel && <B className="btn btn-white cp-cta"><span>{k.ctaLabel}</span><Ico k="go" size={20} /></B>}</div>); },
  services: C => { const list: Data[] = C.resources || []; return <><Head id="services" title="Services and resources" />
    {list.length ? <div className="h-scroll">{list.map((s, i) => (
      <B key={i} className={`card svc${s.highlight ? ' pv-hl' : ''}`}><span className={`svc-art a${i % 3}`} aria-hidden="true"><i className="s1"></i><i className="s2"></i><Ico k={s.icon} size={40} /></span>
        <span className="svc-body">{s.category && <span className="svc-cat">{s.category}</span>}<b>{s.title}</b>{s.description && <span>{s.description}</span>}</span></B>))}</div>
      : <p className="pv-empty">No services or resources are on.</p>}</>; },
  news: C => <><Head id="news" title="Announcements" />
    <div className="card list ann">{(C.announcements || []).map((a: Data, i: number) => <Row key={i} lead={<span className="ann-date">{a.d}</span>} title={a.t} sub={a.s} end={a.isNew ? <span className="new-pill">New</span> : <Ico k="next" size={20} />} />)}</div></>,
  saved: C => <><Head id="saved" title="Your saved providers" all />
    <div className="card list">{(C.saved || []).map((p: Data, i: number) => <Row key={i} lead={<span className={`avatar ${p.a}`} aria-hidden="true">{p.i}</span>} title={p.n} sub={p.s} />)}</div>
    <p className="fine">Shows only on devices with saved providers.</p></>,
  visits: C => <><Head id="visits" title="Your next visits" extra={<span className="eyebrow">From MyChart</span>} />
    <div className="card list ann">{(C.visits || []).map((v: Data, i: number) => <Row key={i} lead={<span className="ann-date">{v.m} {v.d}</span>} title={`${v.type} · ${v.t}`} sub={`${v.who} · ${v.where}`} />)}</div></>,
  near: C => <><Head id="near" title="Near you" all />
    <div className="card list">{(C.near || []).map((n: Data, i: number) => <Row key={i} g="place" title={n.t} sub={n.s} />)}</div></>
};
function Home({ msg }: { msg: Data }) {
  const C = msg.content, guest = msg.audience !== 'authenticated';
  const mods = (msg.layout.modules as { id: string; on: boolean }[]).filter(m => m.on).map(m => ({ id: m.id, el: MODULES[m.id] ? MODULES[m.id](C, guest) : null })).filter(m => m.el);
  return (
    <div className="v-inner"><div className="top" data-m="alerts"><Alerts C={C} /><Hero C={C} /></div>
      {mods.length ? mods.map(m => <section key={m.id} className="mod" data-m={m.id} aria-labelledby={`h-${m.id}`}>{m.el}</section>)
        : <div className="mod"><p className="pv-empty">No modules are visible on this layout.</p></div>}</div>
  );
}

/* ---------- Other screens ---------- */
function Menu({ C }: { C: Data }) {
  return (
    <div className="drawer-layer"><div className="scrim"></div><aside className="drawer" aria-label="Menu">
      <div className="drawer-head"><h2>Menu</h2><B className="icon-btn" aria-label="Close menu"><Ico k="close" /></B></div>
      <div className="drawer-body"><div className="res-body">{(C.drawer.sections as Data[]).map((s, si) => {
        const items = (s.items as Data[]).filter(it => it.visible || C.showHidden);
        if (s.style === 'chips') return <section key={si} className="grp">{s.label && <h2 className="lbl-h">{s.label}</h2>}<div className="chips">{items.length ? items.map((it, i) => <B key={i} className={`chip${it.visible ? '' : ' off'}`} style={it.visible ? undefined : { opacity: .45 }}>{it.label}</B>) : <p className="fine">No visible items</p>}</div></section>;
        return <section key={si} className="grp">{s.label && <h2 className="lbl-h">{s.label}</h2>}<div className="card list">{items.length ? items.map((it, i) => <Row key={i} g={it.icon} title={it.label} sub={it.sub} ext={!!it.destination && it.destination.type === 'url'} cls={it.visible ? '' : 'off'} />)
          : <p className="fine" style={{ padding: 'var(--sp-12) var(--sp-16)' }}>No visible items</p>}</div></section>;
      })}
        <p className="fine">UTSW MyCare version 2.0 (sample) · Menu items come from the CMS</p></div></div></aside></div>
  );
}
const Onboarding = () => (
  <div className="ob"><div className="ob-stage" aria-hidden="true"></div>
    <div className="ob-bar"><img className="logo" alt="UTSW MyCare" src={LOGO} /><B className="ob-skip">Skip</B></div>
    <div className="ob-art"><div className="ob-scene" aria-hidden="true">
      <div className="sc sc-pill" style={{ left: 24, top: 8, width: 248 }}><Ico k="search" size={20} /><span>Knee pain doctor</span></div>
      <div className="sc sc-card" style={{ left: 12, top: 72, width: 272, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}><span className="avatar a1" style={{ width: 56, height: 56, fontSize: 18 }}>AM</span><span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><b style={{ color: 'var(--c-blue)' }}>Avery Morgan, M.D.</b><span style={{ fontSize: 14, lineHeight: '20px', color: 'var(--c-text-2)' }}>Orthopaedic Surgery</span></span></span>
        <span className="sc-tag"><Ico k="checked" size={16} cls="f" />Accepting new patients</span><span className="sc-line" style={{ width: '92%' }}></span><span className="sc-line" style={{ width: '64%' }}></span></div>
      <div className="sc sc-card" style={{ left: 36, top: 236, width: 224, padding: 12, display: 'flex', gap: 12, alignItems: 'center', opacity: .9 }}><span className="avatar a2">RS</span><span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}><b style={{ fontSize: 14, lineHeight: '20px', color: 'var(--c-blue)' }}>Rafael Santos, M.D.</b><span className="sc-line" style={{ width: 96 }}></span></span></div>
      <div className="sc sc-heart" style={{ left: 236, top: 52 }}><Ico k="favorites" cls="f" /></div></div></div>
    <div className="ob-copy"><h2>Find the right doctor</h2><p>Search by name, specialty, or condition, and read full profiles to choose the provider who fits your care.</p></div>
    <div className="ob-foot"><div className="ob-dots" aria-hidden="true"><i className="on"></i><i></i><i></i><i></i></div><B className="btn btn-primary"><span>Next</span><Ico k="go" size={20} /></B></div></div>
);
const Welcome = () => (
  <div className="ob ob-welcome"><div className="ob-stage" aria-hidden="true"></div>
    <div className="ob-bar" aria-hidden="true"></div>
    <div className="ob-wel-art" aria-hidden="true"><span className="ob-wel-ring r2"></span><span className="ob-wel-ring"></span><span className="ob-wel-icon"><img src={APP_ICON} alt="" /></span></div>
    <div className="ob-wel-body"><h2>Welcome to UTSW MyCare</h2><p>Sign in to MyChart for your health record, or continue as a guest to find care.</p>
      <div className="ob-choices">
        <B className="ob-choice primary"><span className="ob-ic"><Ico k="signIn" /></span><span className="rt"><b>Sign in as a patient</b><span>Messages, test results, visits, and bills</span></span><Ico k="next" /></B>
        <B className="ob-choice secondary"><span className="ob-ic"><Ico k="guest" /></span><span className="rt"><b>Continue as guest</b><span>Find doctors, locations, and directions</span></span><Ico k="next" /></B>
      </div>
      <B className="ob-wel-link">New to MyChart? <u>Create an account</u></B></div></div>
);
interface Out { home?: boolean; title?: string; tab?: number; view?: ReactNode; overlay?: ReactNode; dark?: boolean }
function entry(C: Data): Out {
  const e = C.entry;
  const eula = e.eulaVisible ? <><div className="pv-shade"></div><div className="sheet" role="dialog" aria-label="Terms of use"><div className="grab"></div><h2>Before you start</h2><p className="meta">Terms of use, version {e.eulaVersion}</p><p>{e.eulaText}</p><B className="btn btn-primary">Accept and continue</B></div></> : null;
  if (C.entryView === 'onboarding' && e.onboardingVisible) return { overlay: <><Onboarding />{eula}</> };
  if (e.loginPromptVisible && e.loginPromptType === 'choice') return { overlay: <><Welcome />{eula}</> };
  return { home: true, overlay: eula };
}
function push(C: Data): Out {
  const p = C.push;
  if (p.delivery === 'inbox') return { title: 'Inbox', view: <div className="res-body"><div className="card list"><Row g="inbox" title={p.title || 'Notification title'} sub={`${p.body || ''}`.slice(0, 90)} end={<span className="new-pill">New</span>} /><Row g="inbox" title="Saturday hours at Lakeview Primary Care" sub="Open 8 a.m. to noon starting Oct. 17." /></div></div> };
  return { dark: true, overlay: (
    <div className="lock"><p className="lock-time">9:41</p><p className="lock-date">{p.when || 'Thursday, Oct. 30'}</p>
      <div className="push"><div className="push-top"><img src={APP_ICON} alt="" /><span>UTSW MyCare</span><span className="when">now</span></div>
        <p className="push-t">{p.title || 'Notification title'}</p><p className="push-b">{p.body || ''}</p>{p.art && <div className="push-img"><Art svg={p.art} /></div>}</div>
      <p className="push-note">{p.delivery === 'push+inbox' ? 'Also saved in the app’s Inbox' : 'Push only'}</p></div>) };
}
function location(C: Data): Out {
  const l = C.location;
  if (!l) return { title: 'Locations', tab: -1, view: <div className="res-body"><p className="pv-empty">No facilities have location-specific information.</p></div> };
  return { title: 'Locations', tab: -1, view: (
    <div className="res-body"><article className="card loc-card"><div className="loc-map" aria-hidden="true"><i></i></div><div className="loc-body"><h2>{l.name}</h2>
      <p className="loc-row"><Ico k="place" size={20} /><span>{l.type}</span></p>
      {l.message && <p className="loc-tip"><Ico k="info" size={20} /><span>{l.message}</span></p>}
      {l.parking && <p className="loc-row"><Ico k="parking" size={20} /><span>{l.parking}</span></p>}
      {l.indoor && <B className="btn btn-primary"><Ico k="indoor" size={20} /><span>Indoor directions</span></B>}</div></article></div>) };
}

/* ---------- Chrome ---------- */
const TABS: [string, string][] = [['Home', 'home'], ['Find Care', 'findCare'], ['Search', 'search'], ['Wayfinding', 'wayfinding'], ['Favorites', 'favorites']];
/* Global colors: only the approved set maps onto app tokens */
const colorVars = (c: Data | null): CSSProperties => c ? { '--c-blue': c.primary, '--c-mid-blue': c.secondary, '--c-muted-blue': c.tertiary, '--c-bg': c.background } as CSSProperties : {};

export function PhoneApp({ msg, onRendered }: { msg: Data; onRendered: () => void }) {
  const C = msg.content, guest = msg.audience !== 'authenticated';
  const screen = msg.screen || 'home';
  const out: Out = screen === 'drawer' ? { home: true, overlay: <Menu C={C} /> } : screen === 'entry' ? entry(C) : screen === 'push' ? push(C) : screen === 'location' ? location(C) : { home: true };
  const title = out.home ? '' : out.title || '';
  const tab = out.home ? 0 : out.tab != null ? out.tab : -1;
  const phone = useRef<HTMLDivElement>(null), view = useRef<HTMLDivElement>(null);
  const key = JSON.stringify(msg);
  /* After each render: scroll to the module being edited, bring the highlighted card into its row, keep words together */
  useLayoutEffect(() => {
    const v = view.current!;
    v.scrollTop = 0;
    if (out.home && msg.focus) { const el = v.querySelector<HTMLElement>(`[data-m="${msg.focus}"]`); if (el) v.scrollTop = Math.max(0, el.offsetTop - 96); }
    v.querySelectorAll<HTMLElement>('.h-scroll').forEach(sc => { const hl = sc.querySelector<HTMLElement>('.pv-hl'); sc.scrollLeft = hl ? Math.max(0, hl.offsetLeft - 16) : 0; });
    nbsp(phone.current!);
    onRendered();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const menuBtn = <B className="icon-btn ab-menu" aria-label="Menu, 2 new in Inbox"><Ico k="menu" /><i className="ab-dot" aria-hidden="true"></i></B>;
  return (
    <div className={`screen${out.dark ? ' st-dark' : ''}`} id="phone" lang="en" ref={phone} style={colorVars(msg.colors)}>
      <div className="statusbar" aria-hidden="true"><span>9:41</span><span className="sys"><i></i><i></i></span></div>
      <header className={`appbar${title ? '' : ' home'}`} id="appbar">
        {title ? <><h1 className="ttl">{title}</h1>{menuBtn}</>
          : <><img className="logo" alt="UTSW MyCare" src={LOGO} /><span className="sp"></span>{guest && <B className="ab-sign"><Ico k="signIn" size={20} /><span>Sign in</span></B>}{menuBtn}</>}
      </header>
      <div className="views"><div className="view" id="view" tabIndex={0} ref={view} aria-label={`Mobile preview: ${msg.label}. Scroll with the arrow keys.`}>{out.home ? <Home msg={msg} /> : out.view}</div></div>
      <nav className="tabbar" id="tabbar" aria-label="Main">{TABS.map(([l, g], i) => <B key={l} className="tab" aria-current={i === tab ? 'page' : undefined}><span className="pill"><Ico k={g} /></span><span>{l}</span></B>)}</nav>
      <div className="homebar" aria-hidden="true"></div>
      <div id="overlay">{out.overlay}</div>
    </div>
  );
}
