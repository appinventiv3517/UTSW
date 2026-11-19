/* ---------- Single-record editors with the same lifecycle: colors, menu, app entry, search, ranking, locations ---------- */
/* EXTRA_GLYPHS: add edit delete arrow_upward arrow_downward remove_circle smartphone table_rows error */
import { useState, type ReactNode } from 'react';
import type { PageProps, Page } from '../app/App';
import { PageHead } from '../app/Shell';
import { Session } from '../app/session';
import { can, type Area } from '../app/permissions';
import { useLoad } from '../app/useLoad';
import { ConfigService, dataAt, latestData } from '../services/services';
import { destLabel } from '../mock/seed';
import { Badge, Btn, Checkbox, Icon, LoadingState, ErrorState, Segmented, Switch } from '../ui/kit';
import { DataTable, type Column } from '../ui/DataTable';
import { Form, validateData, describeData, type FormSection, type Errors } from '../ui/forms';
import { LifecyclePanel, HistoryCard, formModal, useLeaveGuard } from '../ui/Lifecycle';
import { PreviewCard, recSources, appContent, layoutFor, type Payload } from '../ui/preview';
import { toast } from '../ui/overlays';
import { BarList } from '../ui/charts';
import { fieldsOf, keepErrors, focusSoon } from './collection';
import { announce, clone, cx, same, uid } from '../app/util';
import type { ConfigRecord, Data } from '../app/types';

/* Preview extras (show hidden items, entry screen, facility) live in page state */
export type Extras = Record<string, unknown>;
export interface EditorProps { working: Data; set: (d: Data) => void; ro: boolean; x: Extras; setX: (p: Extras) => void }
export interface SingletonCfg {
  route: string; id: string; area: Area; section: string; title: string; noun: string; lede: ReactNode; formTitle?: string;
  sections?: FormSection[]; validate?: (d: Data) => Errors; describe?: (a: Data | null, b: Data) => string[];
  Editor?: (p: EditorProps) => ReactNode; side?: (d: Data) => ReactNode; sideStatic?: (d: Data) => ReactNode;
  preview?: (d: Data, src: string, x: Extras) => Payload; previewExtras?: (x: Extras, setX: (p: Extras) => void) => ReactNode; initialExtras?: Extras;
}

export function defineSingleton(cfg: SingletonCfg): Record<string, Page> {
  const allF = cfg.sections ? fieldsOf(cfg.sections) : [];
  const describe = (a: Data | null, b: Data) => cfg.describe ? cfg.describe(a, b) : describeData(a, b, allF);
  function SingletonPage(_: PageProps) {
    const [load, retry] = useLoad(() => ConfigService.get(cfg.id));
    return (
      <div className="page" id="sg-page">
        <PageHead crumbs={[[cfg.section, null]]} title={cfg.title} lede={cfg.lede} />
        <div id="sg-body">
          {load.status === 'loading' ? <LoadingState text={`Loading ${cfg.title.toLowerCase()}`} />
            : load.status === 'error' ? <ErrorState msg={load.error} onRetry={retry} />
            : <Body rec0={load.data} />}
        </div>
      </div>
    );
  }
  function Body({ rec0 }: { rec0: ConfigRecord }) {
    const [rec, setRec] = useState(rec0);
    const [working, setWorkingRaw] = useState<Data>(() => clone(latestData(rec0)));
    const [errors, setErrors] = useState<Errors>({});
    const [x, setXRaw] = useState<Extras>(cfg.initialExtras || {});
    const setX = (p: Extras) => setXRaw(o => ({ ...o, ...p }));
    const base = latestData(rec), dirty = !same(working, base);
    const ro = !can(Session.role(), cfg.area, 'draft');
    useLeaveGuard(dirty && !ro, cfg.title.toLowerCase());
    const set = (d: Data) => { setWorkingRaw(d); if (cfg.sections && Object.keys(errors).length) setErrors(e => keepErrors(e, validateData(allF, d, cfg.validate))); };
    const reset = (d: Data) => { setWorkingRaw(clone(d)); setErrors({}); };
    const validate = () => {
      const errs = cfg.sections ? validateData(allF, working, cfg.validate) : (cfg.validate ? cfg.validate(working) : {});
      setErrors(errs);
      const bad = Object.values(errs).filter(Boolean);
      if (cfg.sections) { if (bad.length) focusSoon('f-errsum'); }
      else if (bad.length) toast(bad[0]!, { kind: 'error', ms: 8000 });
      return !bad.length;
    };
    const onSaved = (r: ConfigRecord) => { setRec(r); reset(latestData(r)); };
    const secs = cfg.sections?.map(s => ({ ...s, fields: s.fields.map(f => ro ? { ...f, readonly: true } : f) }));
    const editor = secs ? <form className="form" noValidate id="sg-form" onSubmit={e => e.preventDefault()}><Form sections={secs} data={working} errors={errors} prefix="f" onChange={set} /></form>
      : cfg.Editor ? <cfg.Editor working={working} set={set} ro={ro} x={x} setX={setX} /> : null;
    const side = cfg.side ? cfg.side(working) : cfg.sideStatic ? cfg.sideStatic(working) : null;
    return (
      <>
        <section className="card lc lc-slim" aria-labelledby="lc-h"><span id="sg-badges" hidden></span><div className="card-body" id="lc">
          <LifecyclePanel area={cfg.area} noun={cfg.noun} rec={rec} getWorking={() => clone(working)} dirty={dirty} describe={describe} validate={validate}
            onSaved={onSaved} onDiscard={() => reset(latestData(rec))} />
        </div></section>
        <div className={cx('ed-grid', !(cfg.preview || side) && 'single')}>
          <div className="ed-main">
            <section className="card" aria-labelledby="form-h"><div className="card-head"><h2 id="form-h">{cfg.formTitle || 'Settings'}</h2>{ro && <div className="card-actions"><Badge kind="fixed" text="View only" /></div>}</div>
              <div className="card-body" id="sg-editor">{editor}</div></section>
            {cfg.preview && side && <section className="card"><div className="card-body" id="sg-side">{side}</div></section>}
          </div>
          {cfg.preview ? <PreviewCard id="sg-pv" title={`Mobile preview of ${cfg.title.toLowerCase()}`} sources={recSources(rec, dirty, false)}
              payload={src => { const d = src === 'working' ? working : dataAt(rec, src); return d ? cfg.preview!(d, src, x) : null; }}
              extras={cfg.previewExtras ? cfg.previewExtras(x, setX) : undefined} />
            : side ? <aside className="ed-side"><section className="card"><div className="card-body" id="sg-side">{side}</div></section></aside> : null}
        </div>
        <HistoryCard rec={rec} describe={describe} onSaved={onSaved} />
      </>
    );
  }
  return { [cfg.route]: SingletonPage };
}

/* ---------- Editable rows (search tables, locations) on top of the data table ---------- */
export interface RowsOpts<R extends Data> {
  rows: R[]; onRows: (rows: R[]) => void; noun: string; caption: string; columns: Column<R>[]; sections: FormSection[]; blank: () => Data;
  validate: (v: Data, others: R[]) => Errors; ro: boolean; searchText: (r: R) => string; rowTitle: (r: R) => string; extraActions?: (r: R) => ReactNode;
}
export function RowsEditor<R extends Data>(o: RowsOpts<R>) {
  const cap = `${o.noun[0].toUpperCase()}${o.noun.slice(1)}`;
  const add = async () => {
    const d = await formModal({ title: `Add ${o.noun}`, sections: o.sections, data: o.blank(), validate: v => o.validate(v, o.rows), confirmLabel: `Add ${o.noun}` });
    if (d) { o.onRows([...o.rows, { ...d, id: uid('r') } as unknown as R]); toast(`${cap} added to your working copy. Save the draft to keep it.`); announce(`${o.noun} added`); }
    focusSoon('rows-add');
  };
  const edit = async (r: R) => {
    const d = await formModal({ title: `Edit ${o.noun}`, sections: o.sections, data: r, validate: v => o.validate(v, o.rows.filter(x => x.id !== r.id)) });
    if (d) { o.onRows(o.rows.map(x => x.id === r.id ? d as R : x)); announce(`${o.noun} updated`); }
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-row-edit="${r.id}"]`)?.focus());
  };
  const del = (r: R) => {
    const i = o.rows.findIndex(x => x.id === r.id), rows = o.rows.filter(x => x.id !== r.id);
    o.onRows(rows);
    toast(`Deleted “${o.rowTitle(r)}” from your working copy.`, { action: 'Undo', onAction: () => { const back = [...rows]; back.splice(i, 0, r); o.onRows(back); announce('Restored'); } });
    focusSoon('rows-add');
  };
  return (
    <DataTable<R> id="rows" caption={o.caption} noun={o.noun} rows={o.rows} rowKey={r => r.id} searchPlaceholder={`Search ${o.caption.toLowerCase()}`} searchText={o.searchText}
      actions={o.ro ? null : <Btn label={`Add ${o.noun}`} icon="add" variant="primary" data-row-add="" id="rows-add" onClick={add} />}
      empty={{ icon: 'table_rows', title: `No ${o.noun}s yet`, text: o.ro ? '' : `Add the first ${o.noun}.` }}
      columns={[...o.columns, { key: 'acts', label: 'Actions', hideLabel: true, render: r => o.ro ? null : <span className="row-acts">{o.extraActions && o.extraActions(r)}
        <Btn label={`Edit ${o.rowTitle(r)}`} icon="edit" variant="text" iconOnly data-row-edit={r.id} onClick={() => edit(r)} />
        <Btn label={`Delete ${o.rowTitle(r)}`} icon="delete" variant="text" iconOnly data-row-del={r.id} onClick={() => del(r)} /></span> }]} />
  );
}

/* ---- Global colors ---- */
const hexRgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export function contrast(a: string, b: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return 0;
  const L = (h: string) => { const c = hexRgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
  const x = L(a), y = L(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
const COLOR_CHECKS = (d: Data): [string, number, number, string][] => [
  ['White text on the primary color (buttons, app bar)', contrast('#FFFFFF', d.primary), 4.5, 'primary'],
  ['Primary text on the background (headings, links)', contrast(d.primary, d.background), 4.5, 'primary'],
  ['Body text #333333 on the background', contrast('#333333', d.background), 4.5, 'background'],
  ['White text on the secondary color (campaign gradient)', contrast('#FFFFFF', d.secondary), 3, 'secondary'],
  ['Tertiary icons on the primary color', contrast(d.tertiary, d.primary), 3, 'tertiary']
];
const colorPages = defineSingleton({
  route: 'content-colors', id: 'global-colors', area: 'colors', section: 'Content and navigation', title: 'Global colors', noun: 'color set',
  lede: 'The approved global app colors. Every change is checked against WCAG 2.2 AA before it can be saved. Component-level styles stay in the app’s design system.',
  formTitle: 'Colors',
  sections: [{ note: 'Which tokens are editable, and the effect on dark mode, are pending confirmation (§10.9). In dark mode the app keeps its own page colors; the primary color still drives the brand surfaces.', fields: [
    { key: 'primary', label: 'Primary global app color', type: 'color', required: true, hint: 'App bar, hero, buttons and links. UT Southwestern Blue is #004278.' },
    { key: 'secondary', label: 'Secondary global app color', type: 'color', required: true, hint: 'Campaign gradient and supporting surfaces.' },
    { key: 'tertiary', label: 'Tertiary global app color', type: 'color', required: true, hint: 'Accents and icons on Blue.' },
    { key: 'background', label: 'Background global app color', type: 'color', required: true, hint: 'The page behind cards, in light mode.' }] }],
  validate: d => { const e: Errors = {}; COLOR_CHECKS(d).forEach(([l, r, need, key]) => { if (r && r < need && !e[key]) e[key] = `${l}: ${r.toFixed(2)}:1, needs ${need}:1.`; }); return e; },
  side: d => <><h2 className="side-h">Contrast checks</h2><ul className="checks">{COLOR_CHECKS(d).map(([l, r, need]) => (
    <li key={l}>{r >= need ? <Badge kind="live" text="Pass" /> : <Badge kind="error" text="Fail" />}<span>{l}<br /><b>{r ? r.toFixed(2) : '–'}:1</b> <span className="muted">needs {need}:1</span></span></li>))}</ul>
    <p className="muted">Saving is blocked until every check passes.</p></>,
  preview: (d, src) => ({ screen: 'home', layout: layoutFor('guest'), content: appContent(), colors: d, focus: 'campaign', label: src === 'working' ? 'your colors, not live' : `${src} colors` })
});

/* ---- Menu (Guest Flow 2: opens from the round menu button on the home bar) ---- */
const FIXED_DRAWER = ['inbox', 'signin', 'privacy'];
interface DrawerItem { id: string; label: string; sub?: string; icon: string; destination: { type: string; value: string }; visible: boolean }
interface DrawerSec { id: string; label: string; style?: string; items: DrawerItem[] }
const ITEM_SECS: FormSection[] = [{ fields: [
  { key: 'label', label: 'Label', required: true, max: 32 }, { key: 'sub', label: 'Subtitle', max: 40 },
  { key: 'icon', label: 'Icon', type: 'icon' }, { key: 'destination', label: 'Destination', type: 'destination', required: true, noNone: true },
  { key: 'visible', label: 'Show in the menu', type: 'switch' }] }];
function DrawerEditor({ working, set, ro }: EditorProps) {
  const secs: DrawerSec[] = working.sections;
  const upd = (fn: (s: DrawerSec[]) => void, focus?: string) => { const next = clone(working); fn(next.sections); set(next); if (focus) requestAnimationFrame(() => { const el = document.querySelector<HTMLButtonElement>(`#sg-editor ${focus}`); (el && !el.disabled ? el : document.querySelector<HTMLElement>('#sg-editor h3'))?.focus(); }); };
  const row = (si: number, i: number) => `[data-s="${si}"][data-i="${i}"]`;
  const add = async (si: number) => {
    const d = await formModal({ title: 'Add a menu item', sections: ITEM_SECS, data: { label: '', sub: '', icon: 'help', destination: { type: 'screen', value: 'Help and contact us' }, visible: true }, confirmLabel: 'Add item' });
    if (d) { const n = secs[si].items.length; upd(s => { s[si].items.push({ ...(d as DrawerItem), id: uid('di') }); }, `${row(si, n)} [data-d="edit"]`); announce(`${d.label} added`); }
    else focusSoon(`dr-add-${si}`);
  };
  const edit = async (si: number, i: number) => {
    const it = secs[si].items[i];
    const d = await formModal({ title: `Edit ${it.label}`, sections: ITEM_SECS, data: it });
    upd(s => { if (d) s[si].items[i] = d as DrawerItem; }, `${row(si, i)} [data-d="edit"]`);
  };
  const remove = (si: number, i: number) => {
    const it = secs[si].items[i];
    upd(s => { s[si].items.splice(i, 1); }, `[data-add="${si}"]`);
    const keep = clone(working);
    toast(`${it.label} removed.`, { action: 'Undo', onAction: () => set(keep) });
  };
  return (
    <>{secs.map((s, si) => (
      <section key={s.id} className="dr-sec" aria-labelledby={`ds-${s.id}`}><h3 className="sub-h" id={`ds-${s.id}`} tabIndex={-1}>{s.label || 'Legal and settings'}{s.style === 'chips' && <> <span className="muted">(chips)</span></>}</h3>
        <ol className="mod-list">{s.items.map((it, i) => (
          <li key={it.id} className={cx('mod-row', !it.visible && 'is-off')} data-s={si} data-i={i}>
            <span className="mod-pos" aria-hidden="true">{i + 1}</span><span className="mod-ic"><Icon name={it.icon} size={20} /></span>
            <span className="mod-txt"><span className="mod-t">{it.label}<span className="vh">, position {i + 1} of {s.items.length}</span></span><span className="mod-d">{destLabel(it.destination)}{FIXED_DRAWER.includes(it.id) ? ' · Fixed by the app' : ''}</span></span>
            <Badge kind={it.visible ? 'visible' : 'hidden'} />
            {!ro && <span className="mod-ctl">
              <Switch id={`dv-${it.id}`} checked={it.visible} label={`Show ${it.label} in the menu`} data-d="vis" onChange={() => { upd(x => { x[si].items[i].visible = !it.visible; }); announce(`${it.label} ${!it.visible ? 'shown' : 'hidden'}`); }} />
              <button type="button" className="btn btn-text btn-icon" data-d="up" aria-label={`Move ${it.label} up`} disabled={i === 0} onClick={() => { upd(x => { const l = x[si].items; [l[i], l[i - 1]] = [l[i - 1], l[i]]; }, `${row(si, i - 1)} [data-d="up"]`); announce(`${it.label} moved to position ${i}`); }}><Icon name="arrow_upward" size={20} /></button>
              <button type="button" className="btn btn-text btn-icon" data-d="down" aria-label={`Move ${it.label} down`} disabled={i === s.items.length - 1} onClick={() => { upd(x => { const l = x[si].items; [l[i], l[i + 1]] = [l[i + 1], l[i]]; }, `${row(si, i + 1)} [data-d="down"]`); announce(`${it.label} moved to position ${i + 2}`); }}><Icon name="arrow_downward" size={20} /></button>
              <button type="button" className="btn btn-text btn-icon" data-d="edit" aria-label={`Edit ${it.label}`} onClick={() => edit(si, i)}><Icon name="edit" size={20} /></button>
              {!FIXED_DRAWER.includes(it.id) && <button type="button" className="btn btn-text btn-icon" data-d="remove" aria-label={`Remove ${it.label}`} onClick={() => remove(si, i)}><Icon name="remove_circle" size={20} /></button>}
            </span>}
          </li>))}</ol>
        {!ro && <Btn label={`Add item to ${s.label || 'Legal and settings'}`} icon="add" variant="tonal" data-add={si} id={`dr-add-${si}`} onClick={() => add(si)} />}
      </section>))}</>
  );
}
const drawerPages = defineSingleton({
  route: 'content-drawer', id: 'drawer', area: 'drawer', section: 'Content and navigation', title: 'Menu', noun: 'menu',
  lede: 'The menu that opens from the round button on the home bar (its dot means unread Inbox items). Items are grouped in sections, and “Follow us” shows as chips. Which items are fixed and whether sections can be reordered is pending confirmation (§10.11).',
  formTitle: 'Menu items',
  describe: (a, b) => {
    const out: string[] = [];
    const items = (d: Data) => Object.fromEntries((d.sections as DrawerSec[]).flatMap(s => s.items.map((it, i) => [it.id, { ...it, sec: s.label || 'Top', pos: i + 1 }])));
    const A = items(a!), B = items(b);
    Object.values(B).forEach(it => { const was = A[it.id]; if (!was) out.push(`${it.label} is added to ${it.sec}`); else { if (was.visible !== it.visible) out.push(`${it.label} is ${it.visible ? 'shown' : 'hidden'}`); if (was.pos !== it.pos) out.push(`${it.label} moves from position ${was.pos} to ${it.pos}`); if (was.label !== it.label) out.push(`“${was.label}” is renamed “${it.label}”`); if (!same(was.destination, it.destination)) out.push(`${it.label} now opens ${destLabel(it.destination)}`); } });
    Object.values(A).forEach(it => { if (!B[it.id]) out.push(`${it.label} is removed`); });
    return out;
  },
  Editor: DrawerEditor,
  previewExtras: (x, setX) => <Checkbox id="pv-hidden" label="Show hidden items, dimmed" checked={!!x.showHidden} onChange={v => setX({ showHidden: v })} />,
  preview: (d, src, x) => ({ screen: 'drawer', layout: layoutFor('guest'), content: { ...appContent(), drawer: d, showHidden: !!x.showHidden }, label: src === 'working' ? 'your menu, not live' : `${src} menu` })
});

/* ---- App entry ---- */
const entryPages = defineSingleton({
  route: 'content-app-entry', id: 'app-entry', area: 'appEntry', section: 'Content and navigation', title: 'App entry', noun: 'app entry setting',
  lede: 'What people see when they first open MyCare: four onboarding slides (Find the right doctor, Your health in one place, Find a location near you, Get there, step by step), the End User License Agreement, and the welcome screen that asks them to sign in as a patient or continue as a guest.',
  formTitle: 'First launch',
  sections: [
    { title: 'Onboarding', fields: [{ key: 'onboardingVisible', label: 'Show the four onboarding slides on first launch', type: 'switch', hint: 'People can swipe, tap Next, or Skip.' }] },
    { title: 'End User License Agreement', note: 'EULA source, versioning and re-acceptance are pending (§10.10). The prototype app has no EULA today.', fields: [
      { key: 'eulaVisible', label: 'Show the EULA before first use', type: 'switch' },
      { key: 'eulaVersion', label: 'EULA version', required: true, max: 20, show: d => d.eulaVisible, wide: false },
      { key: 'eulaText', label: 'EULA summary text', type: 'textarea', rows: 5, required: true, max: 800, show: d => d.eulaVisible },
      { key: 'reacceptOnChange', label: 'Ask everyone to accept again when the version changes', type: 'switch', show: d => d.eulaVisible }] },
    { title: 'Sign-in prompt', fields: [
      { key: 'loginPromptVisible', label: 'Ask people to sign in', type: 'switch' },
      { key: 'loginPromptType', label: 'Prompt type', type: 'radio', show: d => d.loginPromptVisible, options: [['choice', 'Welcome screen at launch: Sign in as a patient or Continue as guest'], ['module', 'Only the MyChart sign-in card on the guest home screen']] }] }
  ],
  initialExtras: { entryView: 'welcome' },
  previewExtras: (x, setX) => <div className="pv-row"><Segmented id="pv-entry" label="Preview screen" options={[['onboarding', 'Onboarding'], ['welcome', 'Welcome']]} value={(x.entryView as string) || 'welcome'} onChange={v => setX({ entryView: v })} /></div>,
  preview: (d, src, x) => ({ screen: 'entry', layout: layoutFor('guest'), content: { ...appContent(), entry: d, entryView: x.entryView || 'welcome' }, label: src === 'working' ? 'your first-launch settings, not live' : `${src} first launch` })
});

/* ---- Search: top searches, query mappings, synonyms, specialty mapping ---- */
interface Row extends Data { id: string }
function Tester({ id, placeholder, fn, working }: { id: string; placeholder: string; fn: (d: Data, q: string) => ReactNode; working: Data }) {
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();
  return (
    <><h2 className="side-h">Try a search</h2><p className="muted">Uses your working copy, including unsaved edits.</p>
      <div className="field"><label htmlFor={id}>What a patient types</label><input className="input" id={id} type="search" placeholder={placeholder} value={q} onChange={e => setQ(e.target.value)} /></div>
      <div id={`${id}-out`} className="tester-out" role="status">{t ? fn(working, t) : null}</div></>
  );
}
interface RowsSingletonOpts { route: string; id: string; title: string; lede: ReactNode; noun: string; caption: string; columns: Column<Row>[]; sections: FormSection[]; blank: () => Data;
  validate: (v: Data, others: Row[]) => Errors; searchText: (r: Row) => string; rowTitle: (r: Row) => string; tester: { placeholder: string; fn: (d: Data, q: string) => ReactNode } }
function rowsSingleton(o: RowsSingletonOpts) {
  const tid = `${o.id}-try`;
  return defineSingleton({
    route: o.route, id: o.id, area: 'search', section: 'Search configuration', title: o.title, noun: `${o.title.toLowerCase()} set`, lede: o.lede, formTitle: o.title,
    describe: (a, b) => {
      const A = Object.fromEntries((a!.rows as Row[]).map(r => [r.id, r])), B = Object.fromEntries((b.rows as Row[]).map(r => [r.id, r])), out: string[] = [];
      (b.rows as Row[]).forEach(r => { if (!A[r.id]) out.push(`Added: ${o.rowTitle(r)}`); else if (!same(A[r.id], r)) out.push(`Edited: ${o.rowTitle(r)}`); });
      (a!.rows as Row[]).forEach(r => { if (!B[r.id]) out.push(`Removed: ${o.rowTitle(r)}`); });
      return out;
    },
    Editor: ({ working, set, ro }) => <RowsEditor<Row> rows={working.rows} onRows={rows => set({ ...working, rows })} noun={o.noun} caption={o.caption} columns={o.columns} sections={o.sections}
      blank={o.blank} ro={ro} searchText={o.searchText} rowTitle={o.rowTitle} validate={o.validate} />,
    sideStatic: working => <Tester id={tid} placeholder={o.tester.placeholder} fn={o.tester.fn} working={working} />
  });
}
const dupCheck = (key: string, label: string) => (v: Data, others: Row[]): Errors => others.some(r => String(r[key]).trim().toLowerCase() === String(v[key]).trim().toLowerCase()) ? { [key]: `“${v[key]}” already has a ${label}.` } : {};
const SEARCH_PLACES: [string, string][] = [['home', 'Top searches on the home screen'], ['popular', 'Popular searches on Find Care']];
const Listed = ({ ok, yes, no, children }: { ok: boolean; yes: string; no: string; children: ReactNode }) => <>{ok ? <Badge kind="live" text={yes} /> : <Badge kind="hidden" text={no} />}{children}</>;
const topPages = rowsSingleton({
  route: 'search-top', id: 'search-top', title: 'Top and popular searches', noun: 'search term', caption: 'Top and popular searches',
  lede: 'The chips patients tap instead of typing: four Top searches under the Find Care search on the home screen, and Popular searches on the Find Care screen.',
  columns: [
    { key: 'term', label: 'Chip text', sortable: true, render: r => r.term },
    { key: 'where', label: 'Shows in', sortable: true, render: r => (SEARCH_PLACES.find(x => x[0] === r.where) || [, r.where])[1] }],
  sections: [{ fields: [
    { key: 'term', label: 'Chip text', required: true, max: 32, hint: 'What the chip says and searches for, for example “Knee pain”.' },
    { key: 'where', label: 'Shows in', type: 'radio', options: SEARCH_PLACES }] }],
  blank: () => ({ term: '', where: 'home' }),
  validate: (v, others) => others.some(r => r.where === v.where && r.term.trim().toLowerCase() === v.term.trim().toLowerCase()) ? { term: `“${v.term}” is already in this list.` } : {},
  searchText: r => r.term, rowTitle: r => `“${r.term}”`,
  tester: { placeholder: 'for example, knee pain', fn: (d, q) => {
    const rows = d.rows as Row[], home = rows.filter(r => r.where === 'home'), hit = rows.filter(r => r.term.toLowerCase().includes(q));
    const shown = home.slice(0, 4).map(r => r.term);
    return <><Listed ok={!!hit.length} yes="Listed" no="Not listed">{hit.length
      ? <p>“{q}” is {hit.map(r => r.where === 'home' ? (shown.includes(r.term) ? 'a top search on the home screen' : 'a top search, but only the first four show') : 'a popular search on Find Care').join(' and ')}.</p>
      : <p>No chip says “{q}”.</p>}</Listed><p className="muted">Home shows: {shown.join(', ') || 'none'}.</p></>;
  } }
});
const mappingPages = rowsSingleton({
  route: 'search-query-mappings', id: 'search-mappings', title: 'Query mappings', noun: 'mapping', caption: 'Query mappings',
  lede: 'Send a patient phrase straight to a specialty, condition, scope, content or resource. Mapping semantics depend on the search engine, pending confirmation (§10.12).',
  columns: [
    { key: 'phrase', label: 'Patient phrase', sortable: true, render: r => `“${r.phrase}”` },
    { key: 'targetType', label: 'Goes to', sortable: true, render: r => r.targetType },
    { key: 'target', label: 'Target', sortable: true, render: r => r.target }],
  sections: [{ fields: [
    { key: 'phrase', label: 'Patient phrase', required: true, max: 60, hint: 'Lowercase, as patients type it.' },
    { key: 'targetType', label: 'Goes to', type: 'select', options: ['Specialty', 'Condition', 'Scope', 'Content', 'Resource', 'Location'] },
    { key: 'target', label: 'Target', required: true, max: 60 }] }],
  blank: () => ({ phrase: '', targetType: 'Specialty', target: '' }), validate: dupCheck('phrase', 'mapping'),
  searchText: r => `${r.phrase} ${r.target}`, rowTitle: r => `“${r.phrase}”`,
  tester: { placeholder: 'for example, flu shot', fn: (d, q) => { const hit = (d.rows as Row[]).find(r => q.includes(r.phrase.toLowerCase()));
    return <Listed ok={!!hit} yes="Mapped" no="No mapping">{hit ? <p>“{q}” goes to <b>{hit.targetType}: {hit.target}</b>.</p> : <p>The search engine handles “{q}” on its own.</p>}</Listed>; } }
});
const synonymPages = rowsSingleton({
  route: 'search-synonyms', id: 'search-synonyms', title: 'Synonyms', noun: 'synonym', caption: 'Synonyms',
  lede: 'Lay terms and abbreviations that mean a specialty or condition, seeded from the guest prototype’s plain-language search.',
  columns: [
    { key: 'term', label: 'Patients type', sortable: true, render: r => `“${r.term}”` },
    { key: 'to', label: 'Means', sortable: true, render: r => r.to }],
  sections: [{ fields: [
    { key: 'term', label: 'What patients type', required: true, max: 40 },
    { key: 'to', label: 'What it means', required: true, max: 60, hint: 'A specialty or condition name.' }] }],
  blank: () => ({ term: '', to: '' }), validate: dupCheck('term', 'synonym'),
  searchText: r => `${r.term} ${r.to}`, rowTitle: r => `“${r.term}”`,
  tester: { placeholder: 'for example, skin doc near Frisco', fn: (d, q) => {
    const hits = (d.rows as Row[]).filter(r => q.split(/\s+/).join(' ').includes(r.term.toLowerCase())).sort((a, b) => b.term.length - a.term.length);
    return <Listed ok={!!hits.length} yes="Understood" no="No synonym">{hits.length
      ? <p>“{q}” searches for <b>{hits[0].to}</b>{hits.length > 1 ? ` (also matched ${hits.slice(1).map(h => `“${h.term}”`).join(', ')})` : ''}.</p>
      : <p>No synonym matches “{q}”.</p>}</Listed>;
  } }
});
const specialtyPages = rowsSingleton({
  route: 'search-specialties', id: 'search-specialties', title: 'Specialty mapping', noun: 'specialty', caption: 'Specialty mapping',
  lede: 'Each specialty with the everyday words that should find it.',
  columns: [
    { key: 'specialty', label: 'Specialty', sortable: true, render: r => r.specialty },
    { key: 'terms', label: 'Patient terms', render: r => <span className="chips-inline">{(r.terms as string).split(',').map(t => t.trim()).filter(Boolean).map(t => <span key={t} className="tagchip">{t}</span>)}</span>, cls: 'wrap' }],
  sections: [{ fields: [
    { key: 'specialty', label: 'Specialty', required: true, max: 60 },
    { key: 'terms', label: 'Patient terms', type: 'textarea', required: true, max: 300, hint: 'Separate terms with commas.' }] }],
  blank: () => ({ specialty: '', terms: '' }), validate: dupCheck('specialty', 'mapping'),
  searchText: r => `${r.specialty} ${r.terms}`, rowTitle: r => r.specialty,
  tester: { placeholder: 'for example, knee', fn: (d, q) => {
    const hits = (d.rows as Row[]).filter(r => (r.terms as string).toLowerCase().split(',').some(t => t.trim() && q.includes(t.trim())));
    return <Listed ok={!!hits.length} yes="Matched" no="No match">{hits.length ? <p>Finds <b>{hits.map(h => h.specialty).join(', ')}</b>.</p> : <p>No specialty lists “{q}”.</p>}</Listed>;
  } }
});

/* ---- Ranking: only approved parameters ---- */
const rankingPages = defineSingleton({
  route: 'search-ranking', id: 'search-ranking', area: 'search', section: 'Search configuration', title: 'Ranking', noun: 'ranking setting',
  lede: 'How provider results are ordered under Best match. Only the parameters UTSW approved are shown; which of them the search platform really exposes is pending (§10.12).',
  formTitle: 'Best match weights',
  sections: [{ note: 'Weights are relative and must add up to 100.', fields: [
    { key: 'relevance', label: 'Relevance to the search (specialty and condition fit)', type: 'number', min: 0, maxNum: 100, wide: false },
    { key: 'distance', label: 'Distance from the patient', type: 'number', min: 0, maxNum: 100, wide: false },
    { key: 'availability', label: 'Availability (accepting new patients, online scheduling)', type: 'number', min: 0, maxNum: 100, wide: false },
    { key: 'language', label: 'Language and accessibility match', type: 'number', min: 0, maxNum: 100, wide: false },
    { key: 'defaultSort', label: 'Default sort', type: 'select', options: ['Best match', 'Distance', 'Name A–Z', 'Featured'], hint: 'Patients can change the sort: Best match, Distance, Name A–Z, or Featured.' },
    { key: 'featuredLabelled', label: 'Always label featured providers', type: 'switch', readonly: true, hint: 'Required by the guest design: featured providers are always marked and only move up under the Featured sort.' }] }],
  validate: d => { const sum = ['relevance', 'distance', 'availability', 'language'].reduce((s, k) => s + (+d[k] || 0), 0); return sum !== 100 ? { relevance: `The weights add up to ${sum}. Make them add up to 100.` } : {}; },
  side: d => {
    const rows: [string, number][] = [['Relevance', d.relevance], ['Distance', d.distance], ['Availability', d.availability], ['Language and accessibility', d.language]];
    const sum = rows.reduce((s, r) => s + (+r[1] || 0), 0);
    return <><h2 className="side-h">Weight split</h2><BarList rows={rows.map(([label, value]) => ({ label, value: +value || 0 }))} unit="%" max={100} />
      <p className={sum === 100 ? 'muted' : 'err'}>{sum !== 100 && <Icon name="error" size={16} />}<span>Total: {sum} of 100</span></p></>;
  }
});

/* ---- Location-aware configuration ---- */
const LOC_SECS: FormSection[] = [{ fields: [
  { key: 'name', label: 'Facility name', required: true, max: 60 }, { key: 'type', label: 'Type', type: 'select', options: ['Hospital', 'Clinic', 'Building', 'Parking'] },
  { key: 'message', label: 'Arrival message', type: 'textarea', max: 140, hint: 'Shown on the location card, for example where to check in.' },
  { key: 'parking', label: 'Parking information', max: 80 }, { key: 'indoor', label: 'Indoor maps available (from the published wayfinding file)', type: 'switch' },
  { key: 'enabled', label: 'Show location-specific information', type: 'switch' }] }];
const locationPages = defineSingleton({
  route: 'admin-settings-locations', id: 'locations', area: 'locations', section: 'Administrative settings', title: 'Location-aware configuration', noun: 'location setting',
  lede: 'Approved, location-specific information patients see when they open or arrive at a facility. Geofencing and beacons are not MVP features and need discovery.',
  formTitle: 'Facilities',
  describe: (a, b) => (b.rows as Row[]).flatMap(r => { const o = (a!.rows as Row[]).find(x => x.id === r.id); return !o ? [`Added: ${r.name}`] : same(o, r) ? [] : [`Edited: ${r.name}`]; }),
  Editor: ({ working, set, ro, setX }) => <RowsEditor<Row> rows={working.rows} onRows={rows => set({ ...working, rows })} noun="facility" caption="Facilities" ro={ro} rowTitle={r => r.name} searchText={r => `${r.name} ${r.message}`}
    columns={[
      { key: 'name', label: 'Facility', sortable: true, render: r => <span className="cell-2"><span>{r.name}</span><span className="muted">{r.type}</span></span> },
      { key: 'message', label: 'Arrival message', render: r => r.message || <span className="muted">None</span>, cls: 'wrap' },
      { key: 'status', label: 'Status', render: r => <span className="badges col"><Badge kind={r.enabled ? 'visible' : 'hidden'} text={r.enabled ? 'Shown' : 'Hidden'} />{r.indoor ? <Badge kind="live" text="Indoor maps" /> : <Badge kind="hidden" text="No indoor maps" />}</span> }]}
    extraActions={r => <Btn label={`Preview ${r.name}`} icon="smartphone" variant="text" iconOnly data-loc-pv={r.id} onClick={() => { setX({ pvLoc: r.id }); announce(`Preview shows ${r.name}`); }} />}
    sections={LOC_SECS} blank={() => ({ name: '', type: 'Clinic', message: '', parking: '', indoor: false, enabled: true })} validate={(v, others) => dupCheck('name', 'record')(v, others)} />,
  preview: (d, src, x) => {
    const l = (d.rows as Row[]).find(r => r.id === x.pvLoc) || d.rows[0];
    if (!l) return { screen: 'location', layout: layoutFor('guest'), content: { ...appContent(), location: null }, label: 'no facilities' };
    return { screen: 'location', layout: layoutFor('guest'), content: { ...appContent(), location: l.enabled ? l : { ...l, message: '', parking: '' } }, label: `${l.name}, ${src === 'working' ? 'your edits' : src}` };
  }
});

export const configPages: Record<string, Page> = {
  ...colorPages, ...drawerPages, ...entryPages, ...topPages, ...mappingPages, ...synonymPages, ...specialtyPages, ...rankingPages, ...locationPages
};
