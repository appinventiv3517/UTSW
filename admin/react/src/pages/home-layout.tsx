/* ---------- Home Screen → Layout ----------
   Order (drag, keyboard or the move menu) and visibility of the home modules for guests and signed-in patients, a live preview
   built from the Guest Flow 2 modules, and the shared Draft → Demo → Production lifecycle. Alerts and the Find Care hero are
   pinned above the ordered modules, as in the design's CMS module layout. */
/* EXTRA_GLYPHS: save rate_review science public vertical_align_top vertical_align_bottom arrow_upward arrow_downward drag_indicator visibility view_agenda */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import type { PageProps } from '../app/App';
import { PageHead } from '../app/Shell';
import { Session } from '../app/session';
import { canAct } from '../app/permissions';
import { useLoad } from '../app/useLoad';
import { ConfigService, dataAt, latestData } from '../services/services';
import { HOME_FIXED, HOME_MODULES } from '../mock/seed';
import { Badge, Btn, Card, Checkbox, EmptyState, ErrorState, Icon, LoadingState, Switch } from '../ui/kit';
import { ChangeList, HistoryCard, useLeaveGuard } from '../ui/Lifecycle';
import { FeatureBar } from '../ui/FeatureBar';
import { PreviewCard, recSources, appContent, colorsFor } from '../ui/preview';
import { confirmDialog, toast } from '../ui/overlays';
import { announce, clone, cx, fmtLocal, same, windowStatus } from '../app/util';
import type { ConfigRecord, Data, LayoutData, LayoutModule } from '../app/types';

type ModId = keyof typeof HOME_MODULES;
const MOVES: [string, string, string][] = [['top', 'Move to top', 'vertical_align_top'], ['up', 'Move up', 'arrow_upward'], ['down', 'Move down', 'arrow_downward'], ['bottom', 'Move to bottom', 'vertical_align_bottom']];
const AUDIENCES: ['guest' | 'authenticated', string][] = [['guest', 'Guest'], ['authenticated', 'Authenticated']];
const meta = (id: string) => (HOME_MODULES as Record<string, { label: string; icon: string; desc: string; link?: string }>)[id] || { label: id, icon: 'help', desc: '' };
const modLabel = (id: string) => meta(id).label || id;
export function describeLayout(from: Data | null, to: Data): string[] {
  if (!from) return ['New layout'];
  const out: string[] = [], pos = (list: LayoutModule[]) => Object.fromEntries(list.map((m, i) => [m.id, i + 1]));
  const pf = pos(from.modules), pt = pos(to.modules);
  (to.modules as LayoutModule[]).forEach(m => {
    const was = (from.modules as LayoutModule[]).find(x => x.id === m.id);
    if (!was) { out.push(`${modLabel(m.id)} is added at position ${pt[m.id]}${m.on ? '' : ', hidden'}`); return; }
    if (pf[m.id] !== pt[m.id]) out.push(`${modLabel(m.id)} moves from position ${pf[m.id]} to ${pt[m.id]}`);
    if (was.on !== m.on) out.push(`${modLabel(m.id)} is ${m.on ? 'shown' : 'hidden'}`);
  });
  (from.modules as LayoutModule[]).forEach(m => { if (!pt[m.id]) out.push(`${modLabel(m.id)} is removed`); });
  return out;
}

export function HomeLayoutPage(_: PageProps) {
  const [aud, setAud] = useState<'guest' | 'authenticated'>('guest');
  const dirtyRef = useRef(false);
  const tabs = useRef<HTMLDivElement>(null);
  const pick = async (k: typeof aud, focus = false) => {
    if (k === aud) return;
    if (dirtyRef.current) {
      const r = await confirmDialog({ title: 'Discard unsaved changes?', body: <p>You have unsaved changes to the {aud} layout. Switching audiences discards them.</p>, confirmLabel: 'Discard and switch', variant: 'danger', cancelLabel: 'Keep editing' });
      if (!r.ok) return;
    }
    setAud(k);
    if (focus) requestAnimationFrame(() => document.getElementById(`aud-${k}`)?.focus());
  };
  const key = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (d) { e.preventDefault(); pick(AUDIENCES[(i + d + AUDIENCES.length) % AUDIENCES.length][0], true); }
  };
  return (
    <div className="page hl">
      <PageHead crumbs={[['Home Screen', null]]} title="Home screen layout" lede="Choose which modules patients see on the home screen, and in what order." />
      <FeatureBar types={['homeLayout']} />
      <div className="tabs" role="tablist" aria-label="Audience" ref={tabs}>{AUDIENCES.map(([k, l], i) => (
        <button key={k} type="button" role="tab" id={`aud-${k}`} aria-controls="aud-panel" aria-selected={k === aud} tabIndex={k === aud ? 0 : -1} data-aud={k}
          onClick={() => pick(k)} onKeyDown={e => key(e, i)}>{l}</button>))}</div>
      <div id="aud-panel" role="tabpanel" aria-labelledby={`aud-${aud}`}><AudiencePanel key={aud} aud={aud} dirtyRef={dirtyRef} /></div>
    </div>
  );
}

function AudiencePanel({ aud, dirtyRef }: { aud: 'guest' | 'authenticated'; dirtyRef: React.MutableRefObject<boolean> }) {
  const [load, retry] = useLoad(() => ConfigService.get(`home-layout-${aud}`), [aud]);
  if (load.status === 'loading') return <LoadingState text="Loading the layout" />;
  if (load.status === 'error') return <ErrorState msg={load.error} onRetry={retry} />;
  return <LayoutEditor aud={aud} rec0={load.data} dirtyRef={dirtyRef} />;
}

function LayoutEditor({ aud, rec0, dirtyRef }: { aud: 'guest' | 'authenticated'; rec0: ConfigRecord; dirtyRef: React.MutableRefObject<boolean> }) {
  const [rec, setRec] = useState(rec0);
  const [working, setWorking] = useState<LayoutData>(() => clone(latestData(rec0)) as LayoutData);
  const [showAlert, setShowAlert] = useState(true);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; order: string[] } | null>(null);
  const focusAfter = useRef<{ id: string; act: string } | 'ord' | null>(null);
  const base = latestData(rec) as LayoutData;
  const dirty = !same(working, base);
  dirtyRef.current = dirty;
  useEffect(() => () => { dirtyRef.current = false; }, [dirtyRef]);
  useLeaveGuard(dirty, 'the layout');
  const ro = !canAct(Session.role(), 'homeLayout', 'saveDraft');
  const list = useRef<HTMLOListElement>(null);

  /* Focus goes back to the control that moved or changed, once the list has re-rendered */
  useEffect(() => {
    const f = focusAfter.current; if (!f) return; focusAfter.current = null;
    const el = f === 'ord' ? null : document.querySelector<HTMLElement>(`[data-id="${f.id}"] [data-act="${f.act}"]`);
    (el || document.getElementById('ord-h'))?.focus();
  });
  const moveTo = (id: string, j: number, how = 'moved'): boolean => {
    const mods = working.modules, i = mods.findIndex(m => m.id === id);
    j = Math.max(0, Math.min(mods.length - 1, j));
    if (i < 0 || i === j) return false;
    const next = [...mods]; const [m] = next.splice(i, 1); next.splice(j, 0, m);
    setWorking({ ...working, modules: next });
    announce(`${modLabel(id)} ${how} to position ${j + 1} of ${mods.length}`);
    focusAfter.current = { id, act: 'drag' };
    return true;
  };
  const save = async () => {
    setBusy(true);
    try {
      const r = await ConfigService.saveDraft(rec.id, clone(working), '');
      setBusy(false); setRec(r); setWorking(clone(latestData(r)) as LayoutData);
      toast('Draft saved. Deploy or publish it from the Publishing bar.', { kind: 'success' }); announce('Draft saved');
      requestAnimationFrame(() => document.getElementById('ed-h')?.focus());
    } catch (err) { setBusy(false); toast((err as Error).message, { kind: 'error', ms: 8000 }); }
  };
  const discard = async () => {
    const c = await confirmDialog({ title: 'Discard unsaved changes?', body: <><p>The layout goes back to {rec.draft ? 'your saved draft' : `production v${rec.production}`}. These changes are lost:</p><ChangeList items={describeLayout(base, working)} /></>, confirmLabel: 'Discard changes', variant: 'danger', cancelLabel: 'Keep editing' });
    if (!c.ok) return;
    setWorking(clone(base)); requestAnimationFrame(() => document.getElementById('ed-h')?.focus()); announce('Changes discarded');
  };
  /* The Campaign banner row names the live campaign; ended campaigns hide themselves */
  const moduleDesc = (id: string) => {
    if (id !== 'campaign') return meta(id).desc;
    const fits = (d: Data) => !d.audience || d.audience === 'seg-all' || (aud === 'guest' ? d.audience !== 'seg-signedin' : d.audience !== 'seg-guests');
    const live = ConfigService.peekAll('campaign').map(r => dataAt(r, 'production')).filter((d): d is Data => !!d && d.enabled !== false && fits(d) && windowStatus(d) === 'active');
    return live.length ? `Live: ${live[0].title} · until ${fmtLocal(live[0].end, false).replace(/\.$/, '')}. Ended campaigns hide automatically.` : 'No campaign is live, so the module hides itself. Ended campaigns hide automatically.';
  };

  /* ---------- Pointer drag (mouse, pen and touch on the handle; mouse anywhere on the row) ----------
     While dragging, the rows render in a live order and the dragged row follows the pointer; the drop commits it. */
  const justDragged = useRef(false);
  const tops = useRef(new Map<string, number>());
  const dragY = useRef({ grab: 0, last: 0 });
  const placeDragged = () => {
    const row = list.current?.querySelector<HTMLElement>('.mod-row.is-dragging'); if (!row) return;
    row.style.transform = '';
    const natural = row.getBoundingClientRect().top;
    row.style.transform = `translateY(${dragY.current.last - dragY.current.grab - natural}px)`;
  };
  /* FLIP: rows displaced by the drag slide into their new place */
  useLayoutEffect(() => {
    const l = list.current; if (!l) return;
    const rows = [...l.querySelectorAll<HTMLElement>('.mod-row')];
    rows.forEach(x => {
      const id = x.dataset.id!, before = tops.current.get(id);
      if (drag && id === drag.id) return;
      if (before == null) return;
      const dy = before - x.getBoundingClientRect().top; if (!dy) return;
      x.style.transition = 'none'; x.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => { x.style.transition = ''; x.style.transform = ''; });
    });
    tops.current = new Map(rows.map(x => [x.dataset.id!, x.getBoundingClientRect().top]));
    if (drag) placeDragged();
  });
  const onPointerDown = (e: RPointerEvent<HTMLOListElement>) => {
    const t = e.target as Element;
    if (e.button !== 0 || t.closest('.drag-menu') || ro) return;
    const onHandle = !!t.closest('.drag-h');
    if (!onHandle && (e.pointerType !== 'mouse' || t.closest('a,button,input,label,[role="switch"]'))) return;
    const row = t.closest<HTMLElement>('.mod-row'); if (!row) return;
    const id = row.dataset.id!, startY = e.clientY;
    dragY.current = { grab: e.clientY - row.getBoundingClientRect().top, last: e.clientY };
    let dragging = false, raf = 0, order = working.modules.map(m => m.id);
    const reorder = () => {
      const l = list.current!, r = l.querySelector<HTMLElement>('.mod-row.is-dragging'); if (!r) return;
      const box = r.getBoundingClientRect(), mid = box.top + box.height / 2;
      const prev = r.previousElementSibling as HTMLElement | null, next = r.nextElementSibling as HTMLElement | null;
      const half = (x: HTMLElement) => { const b = x.getBoundingClientRect(); return b.top + b.height / 2; };
      const i = order.indexOf(id);
      if (prev && prev.classList.contains('mod-row') && mid < half(prev)) order = [...order.slice(0, i - 1), id, order[i - 1], ...order.slice(i + 1)];
      else if (next && next.classList.contains('mod-row') && mid > half(next)) order = [...order.slice(0, i), order[i + 1], id, ...order.slice(i + 2)];
      else { placeDragged(); return; }
      setDrag({ id, order });
    };
    const edge = () => {                    /* scroll the page while dragging near the top or bottom edge */
      if (!dragging) return;
      const top = 120, bottom = innerHeight - 60, y = dragY.current.last;
      const v = y < top ? -(top - y) / 6 : y > bottom ? (y - bottom) / 6 : 0;
      if (v) { scrollBy(0, Math.max(-24, Math.min(24, v))); placeDragged(); reorder(); }
      raf = requestAnimationFrame(edge);
    };
    const move = (ev: PointerEvent) => {
      dragY.current.last = ev.clientY;
      if (!dragging) {
        if (Math.abs(ev.clientY - startY) < 5) return;
        dragging = true; setMenu(null);
        setDrag({ id, order });
        raf = requestAnimationFrame(edge);
      }
      ev.preventDefault(); placeDragged(); reorder();
    };
    const end = (ev: PointerEvent) => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', end); removeEventListener('pointercancel', end);
      cancelAnimationFrame(raf);
      if (!dragging) return;
      const r = list.current?.querySelector<HTMLElement>('.mod-row.is-dragging'); if (r) r.style.transform = '';
      setDrag(null);
      justDragged.current = true; setTimeout(() => { justDragged.current = false; }, 0);
      if (ev.type === 'pointercancel' || !moveTo(id, order.indexOf(id))) focusAfter.current = { id, act: 'drag' };
    };
    addEventListener('pointermove', move, { passive: false }); addEventListener('pointerup', end); addEventListener('pointercancel', end);
  };
  const onListKey = (e: KeyboardEvent<HTMLOListElement>) => {
    const h = (e.target as Element).closest('.drag-h'); if (!h || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const id = h.closest<HTMLElement>('.mod-row')!.dataset.id!, i = working.modules.findIndex(m => m.id === id);
    moveTo(id, ({ ArrowUp: i - 1, ArrowDown: i + 1, Home: 0, End: working.modules.length - 1 } as Record<string, number>)[e.key]);
  };

  const shown = drag ? drag.order.map(id => working.modules.find(m => m.id === id)!) : working.modules;
  const n = shown.length;
  const audLabel = aud === 'guest' ? 'Guest' : 'Authenticated';
  return (
    <>
      <div className="hl-grid">
        <div className="hl-main">
          <div className="hl-edit" id="editor">
            <Card title={`${audLabel} home modules`} titleId="ed-h" headTabIndex={-1}
              actions={ro ? <Badge kind="fixed" text="View only" /> : <>
                <span id="lc-badges">{dirty && <Badge kind="unsaved" />}</span>
                {dirty && <Btn label="Discard changes" variant="text" size="sm" data-hl="discard" onClick={discard} />}
                <Btn label="Save draft" icon="save" variant="primary" size="sm" data-hl="save" disabled={!dirty} busy={busy} busyLabel="Saving draft" onClick={save} /></>}>
              <h3 className="sub-h" id="pin-h">Pinned to the top</h3>
              <ul className="pin-list" aria-labelledby="pin-h">{HOME_FIXED.map(f => (
                <li key={f.id} className="pin-row" data-pin={f.id}><span className="mod-pos" aria-hidden="true">–</span><span className="mod-ic"><Icon name={f.icon} size={20} /></span>
                  <span className="mod-txt"><span className="mod-t">{f.label}</span><span className="mod-d">{f.desc}{'link' in f && f.link ? <> <a className="text-link" href={`#${f.link}`}>Manage</a></> : null}</span></span><Badge kind="fixed" text="Pinned" /></li>))}</ul>
              <h3 className="sub-h" id="ord-h" tabIndex={-1}>Modules, in order</h3>
              <p className="hint-line" id="drag-help">{ro ? 'Hidden modules keep their place but patients don’t see them.' : 'Drag a handle to reorder, or focus it and use the arrow keys. Hidden modules keep their place but patients don’t see them.'}</p>
              {n ? <>
                <ol className={cx('mod-list', drag && 'is-sorting')} aria-labelledby="ord-h" ref={list} onPointerDown={onPointerDown} onKeyDown={onListKey}>{shown.map((m, i) => {
                  const mt = meta(m.id);
                  return (
                    <li key={m.id} className={cx('mod-row', !m.on && 'is-off', ro && 'ro', drag?.id === m.id && 'is-dragging')} data-id={m.id}>
                      {!ro && <button type="button" className="drag-h" data-act="drag" aria-haspopup="menu" aria-expanded={menu === m.id} aria-label={`Reorder ${mt.label}, position ${i + 1} of ${n}`} aria-describedby="drag-help" title="Drag to reorder"
                        onClick={() => { if (justDragged.current) return; setMenu(menu === m.id ? null : m.id); if (menu === m.id) focusAfter.current = { id: m.id, act: 'drag' }; }}><Icon name="drag_indicator" size={20} /></button>}
                      <span className="mod-pos" aria-hidden="true">{i + 1}</span>
                      <span className="mod-ic"><Icon name={mt.icon} size={20} /></span>
                      <span className="mod-txt"><span className="mod-t" id={`mt-${m.id}`}>{mt.label}<span className="vh">, position {i + 1} of {n}</span></span><span className="mod-d">{moduleDesc(m.id)}{mt.link && <> <a className="text-link" href={`#${mt.link}`}>Manage</a></>}</span></span>
                      {!m.on && <Badge kind="hidden" />}
                      {!ro && <span className="mod-ctl"><Switch id={`vis-${m.id}`} checked={m.on} label={`Show ${mt.label} on the home screen`} data-act="vis"
                        onChange={() => { setWorking({ ...working, modules: working.modules.map(x => x.id === m.id ? { ...x, on: !x.on } : x) }); announce(`${mt.label} ${!m.on ? 'shown' : 'hidden'}`); focusAfter.current = { id: m.id, act: 'vis' }; }} /></span>}
                      {menu === m.id && <MoveMenu id={m.id} i={i} n={n} onClose={f => { setMenu(null); if (f) focusAfter.current = { id: m.id, act: 'drag' }; }}
                        onMove={to => { setMenu(null); moveTo(m.id, to); }} />}
                    </li>);
                })}</ol>
                <p className="mod-sum"><Icon name="visibility" size={16} /><span>{working.modules.filter(m => m.on).length} of {n} modules shown to {aud === 'guest' ? 'guests' : 'signed-in patients'}</span></p>
              </> : <EmptyState icon="view_agenda" title="No modules on this layout" />}
            </Card>
          </div>
        </div>
        <PreviewCard id="hl-pv" className="hl-preview" title={`Mobile preview of the ${aud} home screen`} sources={recSources(rec, dirty, false)}
          extras={<Checkbox id="pv-alert" label="Show emergency alerts" checked={showAlert} onChange={setShowAlert} />}
          payload={src => {
            const data = src === 'working' ? working : dataAt(rec, src);
            const content = appContent({ audience: aud, allAlerts: true });
            if (!showAlert) content.alerts = [];
            return { screen: 'home', audience: aud, layout: clone(data), content, colors: colorsFor('production'),
              label: src === 'working' ? (dirty ? 'unsaved edits, not live' : rec.draft ? 'saved draft, not live' : `production version ${rec.production}`) : `${src} version ${src === 'demo' ? rec.demo : rec.production}` };
          }} />
      </div>
      <HistoryCard rec={rec} describe={describeLayout} onSaved={r => { setRec(r); setWorking(clone(latestData(r)) as LayoutData); }} />
    </>
  );
}

/* ---------- Move menu: the single-pointer and keyboard alternative to dragging (WCAG 2.5.7) ---------- */
function MoveMenu({ id, i, n, onClose, onMove }: { id: string; i: number; n: number; onClose: (focusHandle: boolean) => void; onMove: (to: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const off: Record<string, boolean> = { top: i === 0, up: i === 0, down: i === n - 1, bottom: i === n - 1 };
  useEffect(() => {
    const m = ref.current!;
    const items = [...m.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    (items.find(b => !b.hasAttribute('aria-disabled')) || items[0]).focus();
    const outside = (e: PointerEvent) => { const t = e.target as Element; if (!m.contains(t) && t.closest('.drag-h') !== m.parentElement?.querySelector('.drag-h')) onClose(false); };
    const blur = () => onClose(false);
    document.addEventListener('pointerdown', outside, true);
    addEventListener('blur', blur);
    return () => { document.removeEventListener('pointerdown', outside, true); removeEventListener('blur', blur); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const key = (e: KeyboardEvent) => {
    const items = [...ref.current!.querySelectorAll<HTMLElement>('[role="menuitem"]')], k = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(k + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); items[e.key === 'Home' ? 0 : items.length - 1].focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(true); }
    else if (e.key === 'Tab') onClose(false);
  };
  return (
    <div className="drag-menu" role="menu" aria-label={`Move ${modLabel(id)}`} ref={ref} onKeyDown={key}
      onBlur={e => { const to = e.relatedTarget as Node | null; const h = ref.current?.parentElement?.querySelector('.drag-h'); if (!ref.current?.contains(to) && to !== h) setTimeout(() => { if (ref.current && !ref.current.contains(document.activeElement)) onClose(false); }, 0); }}>
      {MOVES.map(([k, l, g]) => (
        <button key={k} type="button" role="menuitem" tabIndex={-1} data-mv={k} aria-disabled={off[k] || undefined}
          onClick={e => { e.stopPropagation(); if (off[k]) return; onMove(({ top: 0, up: i - 1, down: i + 1, bottom: n - 1 } as Record<string, number>)[k]); }}>
          <Icon name={g} size={20} /><span>{l}</span></button>))}
    </div>
  );
}
export type { ModId };
