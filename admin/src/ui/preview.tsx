/* ---------- Preview frame ----------
   The phone app (preview/PhoneApp.tsx) is a React tree rendered into an iframe's own document through a portal, so the
   designs/guest CSS can't leak into the Admin and the Admin's can't leak into it. The frame runs no scripts of its own
   (sandbox without allow-scripts); it holds the app's styles and fonts, and the Admin renders into it. */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import PREVIEW_CSS from '../preview/mobile.css?raw';
import { PhoneApp } from '../preview/PhoneApp';
import { ConfigService, dataAt, latestData } from '../services/services';
import { STATIC_CONTENT } from '../mock/seed';
import { Badge, Icon, Segmented } from './kit';
import { fmtDay, fmtLocal, windowStatus } from '../app/util';
import type { ConfigRecord, Data } from '../app/types';

const previewDoc = () => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=390">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..800&display=swap">
<link rel="stylesheet" href="${__ICON_FONT_URL__}">
<style>${PREVIEW_CSS}</style></head><body><div id="pv-root"></div></body></html>`;

export type Payload = Data & { label?: string };
/* The phone: once the frame's document is ready, the app renders into it and re-renders with each new payload */
export function PhoneFrame({ title, payload }: { title: string; payload: Payload | null }) {
  const frame = useRef<HTMLIFrameElement>(null), dev = useRef<HTMLDivElement>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [doc] = useState(previewDoc);
  const ready = () => {
    const d = frame.current?.contentDocument, root = d?.getElementById('pv-root');
    if (!d || !root) return;
    const mark = () => d.documentElement.classList.add('ms-ready');
    if (d.fonts && d.fonts.load) { d.fonts.load('24px "Material Symbols Rounded"', 'home').then(f => { if (f.length) mark(); }).catch(() => {}); setTimeout(mark, 3000); } else mark();
    setMount(root);
  };
  /* The frame may finish loading before React attaches onLoad */
  useEffect(() => { if (frame.current?.contentDocument?.getElementById('pv-root')) ready(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const rendered = () => { const host = dev.current?.parentElement; if (host) host.dataset.rendered = String(Date.now()); };
  return (
    <div className="pv-device" ref={dev}><div className="pv-screen">
      <iframe ref={frame} className="pv-frame" sandbox="allow-same-origin" title={title} srcDoc={doc} onLoad={ready}></iframe>
      {mount && payload && createPortal(<PhoneApp msg={payload} onRendered={rendered} />, mount)}
    </div></div>
  );
}

/* ---------- What the app shows: assembles preview content from the config records ----------
   env picks the snapshot of every other record (production by default); overrides replace one record's data. */
export const ENV_PICK = (r: ConfigRecord | null, env: string): Data | null => !r ? null : (env === 'draft' ? latestData(r) : env === 'demo' ? dataAt(r, 'demo') || dataAt(r, 'production') : dataAt(r, 'production'));
const campaignView = (d: Data) => ({ tag: d.tag, title: d.title, description: d.description, icon: d.icon, ctaLabel: d.ctaLabel });
/* Alerts (Guest Flow 2): emergency before advisory, then newest first */
export const alertView = (d: Data) => ({ level: d.level === 'advisory' ? 'advisory' : 'emergency', title: d.title, message: d.message, dismissible: d.level === 'advisory' && d.dismissible,
  posted: d.start ? `Posted ${fmtDay(d.start.slice(0, 10))}` : 'Posted now', window: d.end ? `Ends ${fmtLocal(d.end, false)}` : '', start: d.start || '' });
type AlertView = ReturnType<typeof alertView>;
export const alertOrder = (a: AlertView, b: AlertView) => (+(b.level === 'emergency') - +(a.level === 'emergency')) || String(b.start).localeCompare(String(a.start));
/* Top searches on the home hero (four) or popular searches on Find Care, from Search configuration */
export const topSearches = (pick: (r: ConfigRecord) => Data | null, where: string): string[] => { const r = ConfigService.peek('search-top'); const d = r && pick(r); return d ? d.rows.filter((x: Data) => x.where === where).map((x: Data) => x.term) : []; };
export const layoutFor = (audience: string, env = 'production'): Data => ENV_PICK(ConfigService.peek(`home-layout-${audience}`), env) || { head: [], modules: [] };
export const colorsFor = (env: string): Data | null => ENV_PICK(ConfigService.peek('global-colors'), env);
export interface ContentOpts { env?: string; overrides?: Record<string, Data | null>; audience?: string; allAlerts?: boolean; newItem?: { type: string; data: Data } | null }
export function appContent({ env = 'production', overrides = {}, audience = 'guest', allAlerts = false, newItem = null }: ContentOpts = {}): Data {
  const pick = (r: ConfigRecord) => overrides[r.id] !== undefined ? overrides[r.id] : ENV_PICK(r, env);
  type X = { r: { id: string }; d: Data };
  const of = (type: Parameters<typeof ConfigService.peekAll>[0]): X[] => ConfigService.peekAll(type).map(r => ({ r, d: pick(r) as Data })).filter(x => x.d);
  const forAudience = (d: Data) => !d.audience || d.audience === 'seg-all' || (audience === 'guest' ? d.audience !== 'seg-signedin' : d.audience !== 'seg-guests');
  const ordered = (type: Parameters<typeof ConfigService.peekAll>[0]) => of(type).filter(x => x.d.enabled !== false).sort((a, b) => a.d.order - b.d.order);
  const camps = of('campaign').filter(x => x.d.enabled !== false && forAudience(x.d));
  const editedCamp = camps.find(x => overrides[x.r.id] !== undefined);
  const camp = editedCamp || camps.find(x => windowStatus(x.d) === 'active') || null;
  const alerts = of('alert').filter(x => x.d.enabled !== false && (allAlerts || overrides[x.r.id] !== undefined || windowStatus(x.d) === 'active'));
  const drawer = ConfigService.peek('drawer'), entry = ConfigService.peek('app-entry');
  /* An item that isn't saved yet has no record, so it joins its list here */
  const add = (type: string): X[] => newItem && newItem.type === type ? [{ r: { id: '__new__' }, d: newItem.data }] : [];
  const camp2 = newItem && newItem.type === 'campaign' ? { d: newItem.data } : camp;
  /* The item open in an editor is outlined in the preview, so it can be found among the others */
  const editing = (x: X) => x.r.id === '__new__' || overrides[x.r.id] !== undefined;
  const withNew = (type: string, list: X[]) => [...list, ...add(type).filter(x => x.d.enabled !== false)].sort((a, b) => a.d.order - b.d.order);
  return {
    ...STATIC_CONTENT,
    top: topSearches(pick, 'home'),
    quickLinks: withNew('quickLink', ordered('quickLink')).map(x => ({ title: x.d.title || 'New quick link', icon: x.d.icon, highlight: editing(x) })),
    resources: withNew('featuredCard', ordered('featuredCard')).map(x => ({ category: x.d.category, title: x.d.title || 'New card', description: x.d.subtitle, icon: x.d.icon, highlight: editing(x) })),
    campaign: camp2 ? campaignView(camp2.d) : null,
    alerts: [...alerts, ...add('alert')].map(x => alertView(x.d)).sort(alertOrder),
    drawer: overrides.drawer || (drawer && pick(drawer)),
    entry: overrides['app-entry'] || (entry && pick(entry))
  };
}
/* The Admin and the app are light only (Guest Flow 2: the app UI is light only), so the preview has no theme switch */

/* Standard source options for a record being edited: [key, label, what it is] */
export type Source = [string, string, ReactNode];
export function recSources(rec: ConfigRecord | null, dirty: boolean, isNew: boolean): Source[] {
  const out: Source[] = [['working', isNew ? 'New' : dirty ? 'Your edits' : rec && rec.draft ? 'Draft' : 'Current',
    isNew || dirty ? <Badge kind="unsaved" text="Unsaved edits – not live" /> : rec && rec.draft ? <Badge kind="draft" text="Saved draft – not live" /> : <Badge kind="production" text={`Same as production v${rec!.production}`} />]];
  if (rec && rec.demo && (dirty || rec.draft || rec.demo !== rec.production)) out.push(['demo', 'Demo', <Badge kind="demo" text={`Demo v${rec.demo} – demo environment only`} />]);
  if (rec && rec.production && (dirty || rec.draft || rec.demo !== rec.production)) out.push(['production', 'Production', <Badge kind="production" text={`Production v${rec.production} – what patients see`} />]);
  return out;
}

/* Size the phone so the preview card ends level with the editor column beside it, at any width. Never larger
   than the breakpoint's scale, never smaller than a readable minimum. Only the phone scales; the preview column
   keeps its width, so the editor never reflows because of this (no resize loop). Stacked layouts are left alone. */
function useFitPreview(aside: React.RefObject<HTMLElement>) {
  useLayoutEffect(() => {
    const el = aside.current; if (!el) return;
    const grid = el.closest('.ed-grid, .hl-grid') as HTMLElement | null;
    if (!grid || !window.ResizeObserver) return;
    const left = [...grid.children].find(c => c !== el && !c.contains(el)) as HTMLElement | undefined;
    const phone = el.querySelector<HTMLElement>('.pv-host');
    const scales = grid.matches('.hl-grid');
    if (!left || !phone) return;
    /* When the editor is shorter than even the smallest phone, its last card grows to meet the preview */
    const last = (): HTMLElement | null => {
      const t = (left.matches('.ed-main, .hl-main') ? left.lastElementChild : left) as HTMLElement | null;
      return t && !t.matches('.card') ? (t.querySelector<HTMLElement>(':scope > .card:last-child') || t) : t;
    };
    let ro: ResizeObserver;
    const fit = () => {
      if (!grid.isConnected) { ro.disconnect(); return; }
      phone.style.removeProperty('--s'); phone.style.removeProperty('--ph');
      const tail = last(); if (tail) tail.style.removeProperty('min-height');
      if (getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length < 2) return;
      const max = parseFloat(getComputedStyle(phone).getPropertyValue('--s')) || .8;
      const chrome = el.offsetHeight - 844 * max;
      const avail = left.offsetHeight - chrome;
      const s = Math.max(Math.min(max, .5), Math.min(max, avail / 844));
      /* Editors (with accordions that open and close) keep a steady phone; only the layout page scales it */
      if (scales && s < max - .002) phone.style.setProperty('--s', s.toFixed(3));
      const short = el.offsetHeight - left.offsetHeight;
      if (short > 1 && tail) tail.style.minHeight = `${tail.offsetHeight + short}px`;
    };
    ro = new ResizeObserver(() => requestAnimationFrame(fit));
    ro.observe(left); const ctl = el.querySelector('.pv-ctl'); if (ctl) ro.observe(ctl);
    fit();
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

/* Preview card: source switch (your edits / demo / production), optional extras; payload(src) builds the message */
export function PreviewCard({ id, title, sources, payload, extras, className = 'ed-side' }: { id: string; title: string; sources: Source[]; payload: (src: string) => Payload | null; extras?: ReactNode; className?: string }) {
  const [src0, setSrc] = useState(sources[0][0]);
  const src = sources.some(o => o[0] === src0) ? src0 : sources[0][0];
  const cur = sources.find(o => o[0] === src)!;
  const aside = useRef<HTMLElement>(null);
  useFitPreview(aside);
  const p = payload(src);
  return (
    <aside className={className} id={id} ref={aside}>
      <section className="card pv-card" aria-labelledby={`${id}-h`}><div className="card-head"><h2 id={`${id}-h`}>Mobile preview</h2></div><div className="card-body">
        <div className="pv-top"><div className="pv-ctl">
          {sources.length > 1 && <div className="pv-row"><Segmented id={`${id}-src`} label="Preview source" options={sources.map(o => [o[0], o[1]] as [string, string])} value={src} onChange={setSrc} /></div>}
          <p className="pv-what">{cur[2]}</p></div>
          {extras && <div className="pv-extras">{extras}</div>}</div>
        <div className="pv-host"><PhoneFrame title={p ? `${title}: ${p.label}` : title} payload={p ? { audience: 'guest', ...p } : null} /></div>
        <p className="pv-note"><Icon name="info" size={16} /><span>Sample content drawn with the Guest Flow 2 designs. Not the live app.</span></p></div></section>
    </aside>
  );
}
