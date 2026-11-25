/* Mobile preview – the phone app drawn inside the preview iframe (its own document, so the app's CSS never meets the Admin's).
   Markup follows the UTSW MyCare Nov 19 design (guest-v2) with geolocation for guests: home modules (tiles … announcements),
   alert banners, the Find Care hero, the four-tab bar, the menu, onboarding, the contextual location card, and at a facility
   the 3D map first, Why you're here, Care near you, Doctors open today, Facilities, place pages and Wayfinding.
   EXTRA_GLYPHS: directions my_location layers view_in_ar call schedule warning */
/*
   It is fed by the configuration the Admin passes in. Every control is inert: the preview shows the configuration,
   it does not run the app. The app UI is light only. */
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { LOGO_ICON_B64, LOGO_REVERSED_B64 } from '../app/assets';
import GEO_MAP from './geo-map.jpg?inline';
import type { Data } from '../app/types';

/* Glyphs the fixed chrome uses (Material Symbols Rounded). Configurable items pass glyph names from the approved list. */
const ICONS = {
  home: 'home', findCare: 'stethoscope', search: 'search', wayfinding: 'directions', directions: 'directions', favorites: 'favorite', signIn: 'login',
  menu: 'menu', close: 'close', back: 'arrow_back', expand: 'expand_more', next: 'chevron_right', external: 'open_in_new', go: 'arrow_forward',
  trending: 'trending_up', emergency: 'warning', advisory: 'error', time: 'schedule', place: 'location_on', info: 'info', parking: 'local_parking',
  indoor: 'directions_walk', guest: 'explore', checked: 'check_circle', lock: 'lock', inbox: 'inbox', visits: 'calendar_month', near: 'near_me',
  medicines: 'medication', joints: 'directions_run', heart: 'favorite', prevention: 'vaccines', cancer: 'health_and_safety', pregnancy: 'pregnant_woman',
  article: 'article', newspaper: 'newspaper'
};
/* Follow us: brand glyphs from Font Awesome Free Brands 6.5.2 (CC BY 4.0), drawn in the app's icon color */
const SOCIAL: [string, number, number, string][] = [["Facebook",320,512,"M80 299.3V512H196V299.3h86.5l18-97.8H196V166.9c0-51.7 20.3-71.5 72.7-71.5c16.3 0 29.4 .4 37 1.2V7.9C291.4 4 256.4 0 236.2 0C129.3 0 80 50.5 80 159.4v42.1H14v97.8H80z"],["Instagram",448,512,"M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z"],["LinkedIn",448,512,"M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z"],["X",512,512,"M389.2 48h70.6L305.6 224.2 487 464H345L233.7 318.6 106.5 464H35.8L200.7 275.5 26.8 48H172.4L272.9 180.9 389.2 48zM364.4 421.8h39.1L151.1 88h-42L364.4 421.8z"]];
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
      <p className="fc-kick"><Ico k="findCare" size={20} />Find Care</p></div>
    <B className="search-entry"><Ico k="search" /><span>Doctors, locations, and more</span></B>
  </section>
);
/* At a facility: the 3D map leads Home (a still of the app's live map; the preview runs no scripts) */
const FAC_NAME = 'UTSW Clinical Center at Las Colinas';
function GeoHero({ m, eyebrow = 'You’re here', tall }: { m: Data; eyebrow?: string; tall?: boolean }) {
  const floors = String(m.floors || '1').split(',').map(x => +x.trim()).filter(Boolean).sort((a, b) => b - a), f = +m.defaultFloor || floors[floors.length - 1];
  return (
    <section className={`geo-hero${tall ? ' tall' : ''}`} aria-labelledby="h-geo"><img className="gh-map" src={GEO_MAP} alt={`Sample 3D map of ${FAC_NAME}, Floor ${f}`} />
      <div className="gh-top"><span className="gh-chip"><i className="gh-live" aria-hidden="true"></i><span><span className="eyebrow">{eyebrow}</span><h2 id="h-geo">{FAC_NAME}</h2></span></span></div>
      <div className="gh-side" role="group" aria-label="Floor">{floors.map(n => <B key={n} className="gh-fl" aria-current={n === f ? 'page' : undefined}>{n}{n === 1 && <i aria-hidden="true"></i>}</B>)}</div>
      <div className="gh-foot"><span className="tag-s">Sample 3D map · Floor {f}</span><B className="btn btn-primary btn-sm"><Ico k="directions" size={20} /><span>{m.cta || 'Get directions'}</span></B></div>
    </section>
  );
}
const walk = (floor: number) => 1 + (floor - 1) * 2 + (floor > 2 ? 1 : 0);
function FacilityTop({ F }: { F: Data }) {
  const w = F.why, n = F.near, rows = (x: Data[] = []) => x.filter(r => r.on !== false);
  const docs = [['Maya Patel, M.D.', 'Primary care · Open until 5 p.m.', 'MP'], ['Daniel Okafor, M.D.', 'Cardiology · Open until 4:30 p.m.', 'DO'], ['Rachel Kim, D.O.', 'Family medicine · Open until 6 p.m.', 'RK'], ['Luis Romero, M.D.', 'Internal medicine · Open until 3 p.m.', 'LR'], ['Ava Chen, M.D.', 'Pediatrics · Open until 5 p.m.', 'AC'], ['Sam Brooks, M.D.', 'Orthopedics · Open until 4 p.m.', 'SB']];
  return <>
    {w && w.enabled && <section className="mod" data-m="why" aria-labelledby="h-why"><div className="card why">
      <div className="why-head"><span className="eyebrow">Welcome to {FAC_NAME}</span><h2 id="h-why">{w.title}</h2></div>
      <div className="list">{rows(w.rows).map((r, i) => <Row key={i} lead={<Well g={r.glyph} />} title={r.label} sub={r.hint} cls={r.hl ? 'pv-hl' : ''} />)}</div>
      <div className="why-foot"><span className="fine">{w.note}</span><B className="btn btn-ghost btn-sm">Not now</B></div></div></section>}
    {n && n.careOn && <section className="mod" data-m="near-care" aria-labelledby="h-nc"><Head id="nc" title="Care near you" extra={<span className="fine">Sample</span>} />
      <div className="card list">{rows(n.care).slice().sort((a, b) => a.floor - b.floor).map((r, i) => <Row key={i} lead={<Well g={r.glyph} />} title={r.name} sub={`Floor ${r.floor}${r.suite ? `, Suite ${r.suite}` : ''} · ${walk(r.floor)} min walk`} />)}</div></section>}
    {n && n.doctorsOn && <section className="mod" data-m="near-docs" aria-labelledby="h-nd"><Head id="nd" title="Doctors open today" />
      <div className="card list">{docs.slice(0, n.doctorsCount || 3).map(([t, s, a], i) => <Row key={i} lead={<span className={`avatar a${i % 3 + 1}`} aria-hidden="true">{a}</span>} title={t} sub={s} />)}</div>
      <p className="fine">{n.openNote}</p></section>}
    {n && n.facilitiesOn && <section className="mod" data-m="near-fac" aria-labelledby="h-nf"><Head id="nf" title="Facilities" />
      <div className="wf-grid">{rows(n.tiles).map((t, i) => <B key={i} className="card wf-dest"><Well g={t.glyph} /><span>{t.name}</span><span className="fine">{walk(t.floor)} min</span></B>)}</div></section>}
  </>;
}

/* ---------- Modules, in the order the Admin sets ---------- */
const Head = ({ id, title, all, extra }: { id: string; title: string; all?: boolean; extra?: ReactNode }) =>
  <div className="mod-head"><h2 className="sec-h" id={`h-${id}`}>{title}</h2>{all && <B className="btn btn-ghost btn-sm">See all</B>}{extra}</div>;
const MODULES: Record<string, (C: Data, guest: boolean) => ReactNode> = {
  tiles: C => { const list: Data[] = (C.quickLinks || []).slice(0, 6); return <><Head id="tiles" title="Quick links" />
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
  visits: C => <><Head id="visits" title="Your next visits" extra={<span className="eyebrow">From MyChart</span>} />
    <div className="card list ann">{(C.visits || []).map((v: Data, i: number) => <Row key={i} lead={<span className="ann-date">{v.m} {v.d}</span>} title={`${v.type} · ${v.t}`} sub={`${v.who} · ${v.where}`} />)}</div></>,
  near: C => <><Head id="near" title="Near you" all />
    <div className="card list">{(C.near || []).map((n: Data, i: number) => <Row key={i} g="place" title={n.t} sub={n.s} />)}</div></>
};
function Home({ msg, ctx, facility }: { msg: Data; ctx?: ReactNode; facility?: boolean }) {
  const C = msg.content, guest = msg.audience !== 'authenticated';
  const mods = (msg.layout.modules as { id: string; on: boolean }[]).filter(m => m.on).map(m => ({ id: m.id, el: MODULES[m.id] ? MODULES[m.id](C, guest) : null })).filter(m => m.el);
  const F = C.facility || {}, mapFirst = facility && F.map && F.map.mapFirst !== false;
  return (
    <div className="v-inner">{facility ? <>
      <div className="top" data-m="alerts"><Alerts C={C} />{mapFirst ? <GeoHero m={F.map} /> : <Hero C={C} />}</div><FacilityTop F={F} />
      {mapFirst && <div className="top low" data-m="hero"><Hero C={C} /></div>}</>
      : <><div className="top" data-m="alerts"><Alerts C={C} /><Hero C={C} /></div>{ctx && <section className="mod" data-m="ctx">{ctx}</section>}</>}
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
        if (s.id === 'social') return <section key={si} className="grp">{s.label && <h2 className="lbl-h">{s.label}</h2>}<div className="social">{items.length ? items.map((it, i) => { const b = SOCIAL.find(x => x[0] === it.label);
          return <B key={i} className="soc-btn" style={it.visible ? undefined : { opacity: .45 }} aria-label={it.label}><span className="soc-ic" aria-hidden="true">{b ? <svg viewBox={`0 0 ${b[1]} ${b[2]}`} width="20" height="20"><path fill="currentColor" d={b[3]} /></svg> : <Ico k="public" size={20} />}</span><span className="soc-l" aria-hidden="true">{it.label}</span></B>; })
          : <p className="fine">No visible items</p>}</div></section>;
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
    <div className="ob-copy"><h2>Find the right doctor</h2><p>Search by name, specialty, or condition, and read full profiles to choose the clinician who fits your care.</p></div>
    <div className="ob-foot"><div className="ob-dots" aria-hidden="true"><i className="on"></i><i></i><i></i><i></i></div><B className="btn btn-primary"><span>Next</span><Ico k="go" size={20} /></B></div></div>
);
interface Out { home?: boolean; title?: string; tab?: number; view?: ReactNode; overlay?: ReactNode; dark?: boolean; ctx?: ReactNode; facility?: boolean; noBar?: boolean }
function entry(C: Data): Out {
  const e = C.entry;
  const eula = e.eulaVisible ? <><div className="pv-shade"></div><div className="sheet" role="dialog" aria-label="Terms of use"><div className="grab"></div><h2>Before you start</h2><p className="meta">Terms of use, version {e.eulaVersion}</p><p>{e.eulaText}</p><B className="btn btn-primary">Accept and continue</B></div></> : null;
  if (C.entryView === 'onboarding' && e.onboardingVisible) return { overlay: <><Onboarding />{eula}</> };
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
/* Nov 19: location-specific information shows as the contextual card on Home (You're here / Get directions) */
function location(C: Data): Out {
  const l = C.location;
  if (!l) return { home: true, ctx: <p className="pv-empty">No facilities have location-specific information.</p> };
  return { home: true, ctx: (
    <article className="card wf-here ctx-card"><span className="eyebrow"><i className="gh-live" aria-hidden="true"></i>You’re here</span><h2>{l.name}</h2><p>{l.type}</p>
      {l.message && <p className="loc-tip"><Ico k="info" size={20} /><span>{l.message}</span></p>}
      {l.parking && <p className="loc-row"><Ico k="parking" size={20} /><span>{l.parking}</span></p>}
      <div className="row-btns">{l.indoor && <B className="btn btn-primary btn-sm"><Ico k="directions" size={20} /><span>Get directions</span></B>}<B className="btn btn-secondary btn-sm">Details</B></div></article>) };
}
/* Place page: hours, the walk-in wait, the catalog, Start 3D directions */
function place(C: Data): Out {
  const rows: Data[] = ((C.facility || {}).places || []).filter((r: Data) => r.on !== false);
  const p = rows.find(r => r.sel) || rows[0];
  if (!p) return { title: 'Place', view: <div className="res-body"><p className="pv-empty">No place pages are on.</p></div> };
  const groups: [string, string[][]][] = [];
  String(p.items || '').split('\n').map((l: string) => l.trim()).filter(Boolean).forEach((l: string) => { const [g, ...r] = l.split('|').map(x => x.trim()); const hit = groups.find(x => x[0] === g); if (hit) hit[1].push(r); else groups.push([g, [r]]); });
  return { title: p.name.split(',')[0], view: (
    <div className="res-body"><div className="card wf-here"><span className="eyebrow">{FAC_NAME}</span><h2>{p.name}</h2><p>Floor {p.floor} · {walk(p.floor)} min walk{p.hours ? ` · Open ${p.hours}` : ''}</p>
      {p.wait && <p className="geo-wait"><Ico k="time" size={20} /><span>{p.wait} (sample)</span></p>}
      <div className="row-btns"><B className="btn btn-primary btn-sm"><Ico k="directions" size={20} /><span>Start 3D directions</span></B></div></div>
      {groups.length > 0 && <section className="grp"><div className="grp-h"><h2 className="lbl-h">{p.kind}</h2><span className="sug-type">Sample</span></div>
        {groups.map(([h, items], i) => <div key={i} className="card geo-cat"><h3>{h}</h3><ul>{items.map(([t, pr, tag], j) => <li key={j}><span>{t}{tag && <span className="sug-type">{tag}</span>}</span><b>{pr}</b></li>)}</ul></div>)}
        {p.note && <p className="fine">{p.note}</p>}</section>}</div>) };
}
/* Wayfinding (Nov 19 redesign, in the app): map first at a facility, then quick destinations */
function wayfinding(C: Data): Out {
  const m = (C.facility || {}).map || {};
  return { title: 'Wayfinding', view: (
    <div className="v-inner"><div className="top"><GeoHero m={m} eyebrow="Wayfinding" tall /></div>
      <section className="mod"><Head id="wd" title="Where to?" />
        <div className="wf-grid">{(m.dest || []).filter((d: Data) => d.on !== false).map((d: Data, i: number) => <B key={i} className={`card wf-dest${d.hl ? ' pv-hl' : ''}`}><Well g={d.glyph} /><span>{d.name}</span></B>)}</div></section>
      <section className="mod"><Head id="wo" title="Route options" />
        <div className="card list">{[m.fromStreet && ['directions_car', 'From the street', 'Drive in, park, walk, enter'], m.overview && ['layers', 'Route overview', 'Every floor of the route'], m.liveView && ['view_in_ar', 'Live view', 'Simulated camera view'], m.voice && ['volume_up', 'Voice guidance', 'Spoken turn by turn']].filter(Boolean).map((r, i) => { const [g, t, s] = r as string[]; return <Row key={i} g={g} title={t} sub={s} />; })}</div></section></div>) };
}

/* ---------- Chrome ---------- */
const TABS: [string, string][] = [['Home', 'home'], ['Find Care', 'findCare'], ['MyChart', 'signIn'], ['Favorites', 'favorites']];
/* Global colors: only the approved set maps onto app tokens */
const colorVars = (c: Data | null): CSSProperties => c ? { '--c-blue': c.primary, '--c-mid-blue': c.secondary, '--c-muted-blue': c.tertiary, '--c-bg': c.background } as CSSProperties : {};

export function PhoneApp({ msg, onRendered }: { msg: Data; onRendered: () => void }) {
  const C = msg.content, guest = msg.audience !== 'authenticated';
  const screen = msg.screen || 'home';
  const out: Out = screen === 'drawer' ? { home: true, overlay: <Menu C={C} /> } : screen === 'entry' ? entry(C) : screen === 'push' ? push(C) : screen === 'location' ? location(C) : screen === 'facility' ? { home: true, facility: true } : screen === 'place' ? place(C) : screen === 'wayfinding' ? wayfinding(C) : { home: true };
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
      <div className="views"><div className="view" id="view" tabIndex={0} ref={view} aria-label={`Mobile preview: ${msg.label}. Scroll with the arrow keys.`}>{out.home ? <Home msg={msg} ctx={out.ctx} facility={out.facility} /> : out.view}</div></div>
      <nav className="tabbar" id="tabbar" aria-label="Main">{TABS.map(([l, g], i) => <B key={l} className="tab" aria-current={i === tab ? 'page' : undefined}><span className="pill"><Ico k={g} /></span><span>{l}</span></B>)}</nav>
      <div className="homebar" aria-hidden="true"></div>
      <div id="overlay">{out.overlay}</div>
    </div>
  );
}
