/* ---------- Collections: a list page plus an editor (new and :id) for each item type ----------
   Used by Campaigns, Emergency alerts, Quick links, Services and resources and Audience segments. Each item is a
   config record with its own Draft → Demo → Production lifecycle and history. */
/* EXTRA_GLYPHS: add expand_more error delete info warning science campaign apps library_books groups */
import { useState, type ReactNode } from 'react';
import type { PageProps, Page } from '../app/App';
import { PageHead } from '../app/Shell';
import { Router } from '../app/router';
import { Session } from '../app/session';
import { can, type Area } from '../app/permissions';
import { useLoad } from '../app/useLoad';
import { ConfigService, DB, dataAt, latestData, recName } from '../services/services';
import { AUDIENCE_ATTRS, destLabel } from '../mock/seed';
import { Badge, Btn, Icon, LoadingState, ErrorState } from '../ui/kit';
import { DataTable, type Column, type TableFilter } from '../ui/DataTable';
import { Form, validateData, describeData, segmentName, type FieldDef, type FormSection, type Errors, type Rule } from '../ui/forms';
import { LifecyclePanel, HistoryCard, EnvBadges, envRank, useLeaveGuard } from '../ui/Lifecycle';
import { PreviewCard, recSources, appContent, layoutFor, colorsFor, type Payload } from '../ui/preview';
import { toast } from '../ui/overlays';
import { FeatureBar } from '../ui/FeatureBar';
import { announce, clone, cx, fmtDateTime, fmtLocal, nowLocal, plural, same, TZ, windowStatus } from '../app/util';
import type { ConfigRecord, ConfigType, Data } from '../app/types';

export const fieldsOf = (sections: FormSection[]): FieldDef[] => sections.flatMap(s => s.fields);
export const lastChange = (r: ConfigRecord): string => { const e = r.events[r.events.length - 1]; return e ? e.at : ''; };
/* Shrinks the errors to those still true for the new data (errors only appear on save) */
export const keepErrors = (errors: Errors, fresh: Errors): Errors => Object.fromEntries(Object.entries(errors).filter(([k]) => fresh[k]));
export const focusSoon = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus());

export interface CollectionCfg {
  route: string; type: ConfigType; area: Area; section: string; title: string; noun: string; newLabel: string; icon: string; cls?: string;
  lede: ReactNode; summary?: (list: ConfigRecord[]) => ReactNode; banner?: ReactNode; formCls?: string; formTitle?: string; editorLede?: ReactNode;
  nameLabel?: string; nameIcon?: (d: Data) => string; nameSub?: (d: Data) => string; defaultSort?: { key: string; dir: 'asc' | 'desc' };
  defaults: () => Data; sections: FormSection[]; validate?: (d: Data) => Errors; describe?: (a: Data | null, b: Data) => string[];
  searchExtra?: (d: Data) => string; columns: { key: string; label: string; sortable?: boolean; sortValue?: (d: Data) => string | number; render: (d: Data, r: ConfigRecord) => ReactNode; cls?: string }[];
  filters?: TableFilter<ConfigRecord>[]; preview?: (d: Data | null, id: string, src: string) => Payload; side?: (d: Data, rec: ConfigRecord | null) => ReactNode;
}

export function defineCollection(cfg: CollectionCfg): Record<string, Page> {
  const allFields = fieldsOf(cfg.sections);

  /* ---- List ---- */
  function List(_: PageProps) {
    const canEdit = can(Session.role(), cfg.area, 'draft');
    const [load, retry] = useLoad(() => ConfigService.list(cfg.type));
    const columns: Column<ConfigRecord>[] = [
      { key: 'name', label: cfg.nameLabel || 'Title', sortable: true, sortValue: r => r.name.toLowerCase(), render: r => {
        const d = latestData(r), sub = cfg.nameSub && cfg.nameSub(d);
        const link = <a className="row-link" href={`#${cfg.route}-${r.id}`}>{cfg.nameIcon && <Icon name={cfg.nameIcon(d)} size={20} />}<span>{r.name}</span></a>;
        return sub ? <div className={cx('name-cell', cfg.nameIcon && 'has-ic')}>{link}<span className="name-sub">{sub}</span></div> : link;
      } },
      ...cfg.columns.map(c => ({ ...c, render: (r: ConfigRecord) => c.render(latestData(r), r), sortValue: c.sortValue ? (r: ConfigRecord) => c.sortValue!(latestData(r)) : undefined })),
      { key: 'status', label: 'Publishing', render: r => <EnvBadges r={r} /> },
      { key: 'updated', label: 'Last change', sortable: true, sortValue: lastChange, render: r => <span className="nowrap">{fmtDateTime(lastChange(r))}</span> }
    ];
    return (
      <div className={cx('page', cfg.cls)}>
        <PageHead crumbs={[[cfg.section, null]]} title={cfg.title} lede={cfg.lede}
          actions={canEdit ? <a className="btn btn-primary" href={`#${cfg.route}-new`}><Icon name="add" size={20} /><span className="lbl">{cfg.newLabel}</span></a> : null} />
        <div id="col-body">
          {load.status === 'loading' ? <LoadingState text={`Loading ${cfg.title.toLowerCase()}`} />
            : load.status === 'error' ? <ErrorState msg={load.error} onRetry={retry} />
            : <>
              {cfg.summary && cfg.summary(load.data)}
              <FeatureBar types={[cfg.type]} />
              <section className="card"><div className="card-body" id="col-table">
                <DataTable<ConfigRecord> id="col" caption={cfg.title} noun={cfg.noun} searchPlaceholder={`Search ${cfg.title.toLowerCase()}`}
                  rows={load.data} defaultSort={cfg.defaultSort || { key: 'updated', dir: 'desc' }} rowKey={r => r.id}
                  searchText={r => `${r.name} ${cfg.searchExtra ? cfg.searchExtra(latestData(r)) : ''}`}
                  filters={[
                    { key: 'env', label: 'Publishing', options: [['production', 'Live, nothing pending'], ['demo', 'Waiting on demo'], ['draft', 'Open draft']], match: (r, v) => envRank(r) === v },
                    ...(cfg.filters || [])]}
                  empty={{ icon: cfg.icon, title: `No ${cfg.title.toLowerCase()} yet`, text: canEdit ? `Create the first ${cfg.noun}.` : '' }}
                  columns={columns} />
              </div></section>
            </>}
        </div>
      </div>
    );
  }

  /* ---- Editor ---- */
  const one = cfg.noun, cap = one[0].toUpperCase() + one.slice(1);
  const pre = (i: number) => (i === 0 ? 'f' : `f${i}`);
  function Editor({ route, params }: PageProps) {
    const isNew = route.pattern.endsWith('-new');
    const crumbs: [string, string | null][] = [[cfg.section, null], [cfg.title, cfg.route]];
    const [load, retry] = useLoad(() => isNew ? Promise.resolve(null) : ConfigService.get(params.id!), []);
    if (load.status === 'loading') return <div className={cx('page', cfg.cls)} id="ed-page"><LoadingState text={`Loading the ${cfg.noun}`} /></div>;
    if (load.status === 'error') return <div className={cx('page', cfg.cls)} id="ed-page"><PageHead crumbs={crumbs} title={`${cap} not found`} /><ErrorState msg={load.error} onRetry={retry} /></div>;
    return <EditorBody isNew={isNew} rec0={load.data} crumbs={crumbs} />;
  }
  function EditorBody({ isNew, rec0, crumbs }: { isNew: boolean; rec0: ConfigRecord | null; crumbs: [string, string | null][] }) {
    const [rec, setRec] = useState<ConfigRecord | null>(rec0);
    const [items, setItems] = useState<Data[]>(() => isNew ? [cfg.defaults()] : [clone(latestData(rec0!))]);
    const [itemErrors, setItemErrors] = useState<Errors[]>([{}]);
    const [open, setOpen] = useState(0);
    const [active, setActive] = useState(0);
    const working = items[active];
    const errors = itemErrors[active] || {};
    const ro = !can(Session.role(), cfg.area, 'draft');
    const blank = JSON.stringify(cfg.defaults());
    const base = () => isNew ? cfg.defaults() : latestData(rec!);
    const dirty = isNew ? items.some(d => JSON.stringify(d) !== blank) : !same(working, base());
    const title = isNew && items.length > 1 ? `New ${cfg.title.toLowerCase()} (${items.length})` : recName(working) || (isNew ? cfg.newLabel : cfg.title);
    const secs = cfg.sections.map(s => ({ ...s, fields: s.fields.map(f => ro ? { ...f, readonly: true } : f) }));
    useLeaveGuard(dirty && !ro, `“${title}”`);
    const setItem = (i: number, d: Data) => {
      setItems(xs => xs.map((x, k) => k === i ? d : x));
      setItemErrors(es => es.map((e, k) => k === i && Object.keys(e).length ? keepErrors(e, validateData(allFields, d, cfg.validate)) : e));
    };
    const reset = (data: Data) => { setItems([clone(data)]); setItemErrors([{}]); };
    const validate = () => {
      const errs = items.map(d => validateData(allFields, d, cfg.validate));
      setItemErrors(errs);
      const bad = errs.findIndex(x => Object.keys(x).length);
      if (bad < 0) return true;
      setOpen(bad); setActive(bad);
      if (isNew && items.length > 1) toast(`Fix ${plural(errs.filter(x => Object.keys(x).length).length, one)} before saving. Nothing was saved.`, { kind: 'error', ms: 7000 });
      focusSoon(`${pre(bad)}-errsum`);
      return false;
    };
    const describe = (a: Data | null, b: Data) => cfg.describe ? cfg.describe(a, b) : describeData(a, b, allFields);
    const onSaved = (r: ConfigRecord) => { setRec(r); reset(latestData(r)); };
    /* New items: an accordion, one panel per item, Add more at the bottom. The open panel drives the preview.
       Item 1 keeps the f- ids of the single form; item n uses f<n>-. */
    const openItem = (i: number) => { const o = open === i ? -1 : i; setOpen(o); if (o >= 0) setActive(i); };
    const addItem = () => {
      const n = items.length;
      setItems(xs => [...xs, cfg.defaults()]); setItemErrors(es => [...es, {}]); setOpen(n); setActive(n);
      focusSoon(`${pre(n)}-${allFields[0].key}`); announce(`${cap} ${n + 1} added and opened`);
    };
    const removeItem = (i: number) => {
      const left = items.length - 1, o = Math.min(Math.max(0, i - 1), left - 1);
      setItems(xs => xs.filter((_, k) => k !== i)); setItemErrors(es => es.filter((_, k) => k !== i)); setOpen(o); setActive(o);
      focusSoon(`acc-b${o}`); announce(`${cap} ${i + 1} removed`);
    };
    const create = async () => {
      const recs: ConfigRecord[] = [];
      for (const d of items) { const data = clone(d); if ('order' in data) data.order = ConfigService.peekAll(cfg.type).length + 1; recs.push(await ConfigService.create(cfg.type, data, 'Created in the Admin')); }
      return recs.length === 1 ? recs[0] : { many: recs };
    };
    const form = isNew ? (
      <>
        <div className="acc">{items.map((d, i) => {
          const n = Object.keys(itemErrors[i] || {}).length;
          return (
            <section key={i} className={cx('acc-item', open === i && 'open')} data-i={i}>
              <div className="acc-row"><h3 className="acc-h"><button type="button" className="acc-btn" id={`acc-b${i}`} data-acc={i} aria-expanded={open === i} aria-controls={`acc-p${i}`} onClick={() => openItem(i)}>
                <Icon name="expand_more" size={20} className="acc-chev" /><span className="acc-t">{cap} {i + 1}</span>
                {d.title || d.name ? <span className="acc-name">{d.title || d.name}</span> : <span className="acc-name muted">Untitled</span>}
                {n > 0 && <span className="acc-err"><Icon name="error" size={16} />{plural(n, 'problem')}</span>}</button></h3>
                {items.length > 1 && <Btn label={`Remove ${one} ${i + 1}`} icon="delete" variant="text" size="sm" iconOnly data-acc-rm={i} onClick={() => removeItem(i)} />}</div>
              <div className="acc-panel" id={`acc-p${i}`} role="region" aria-labelledby={`acc-b${i}`} hidden={open !== i}>
                <div id={`acc-f${i}`}><Form sections={secs} data={d} errors={itemErrors[i]} prefix={pre(i)} onChange={x => setItem(i, x)} /></div></div>
            </section>);
        })}</div>
        <div className="acc-more"><Btn label="Add more" icon="add" variant="secondary" data-acc-add="" disabled={items.length >= 10} title={items.length >= 10 ? 'Up to 10 at a time' : undefined} onClick={addItem} />
          <span className="muted small">{items.length > 1 ? `${plural(items.length, one)} will be saved as drafts together.` : `Add more to create several ${cfg.title.toLowerCase()} at once.`}</span></div>
      </>
    ) : <Form sections={secs} data={working} errors={errors} prefix="f" onChange={x => setItem(0, x)} />;
    return (
      <div className={cx('page', cfg.cls)} id="ed-page">
        <PageHead crumbs={crumbs} title={title} lede={cfg.editorLede}
          badges={<span id="ed-badges">{isNew ? <Badge kind="unsaved" text="New" /> : <><EnvBadges r={rec!} />{dirty && <Badge kind="unsaved" />}</>}</span>} />
        {cfg.banner}
        <section className="card lc lc-slim" aria-labelledby="lc-h"><div className="card-body" id="lc">
          <LifecyclePanel area={cfg.area} noun={cfg.noun} rec={rec} getWorking={() => clone(working)} dirty={dirty} isNew={isNew} describe={describe} validate={validate}
            newSaveLabel={items.length > 1 ? `Save ${plural(items.length, one)} as drafts` : 'Save as draft'}
            createdMsg={items.length > 1 ? `${plural(items.length, one)} saved as drafts. Deploy or publish them together from the Publishing bar.` : null}
            create={create}
            onSaved={(r, kind) => {
              if (kind === 'created') { const out = r as unknown as ConfigRecord & { many?: ConfigRecord[] }; Router.clearGuard(); Router.go(out.many ? cfg.route : `${cfg.route}-${out.id}`); return; }
              onSaved(r);
            }}
            onDiscard={() => reset(base())}
            afterDelete={() => { Router.clearGuard(); Router.go(cfg.route); }} />
        </div></section>
        <div className={cx('ed-grid', !(cfg.preview || cfg.side) && 'single')}>
          <section className={cx('card', cfg.formCls)} aria-labelledby="form-h"><div className="card-head"><h2 id="form-h">{cfg.formTitle || 'Details'}</h2>{ro && <div className="card-actions"><Badge kind="fixed" text="View only" /></div>}</div>
            <form className="card-body form" id="ed-form" noValidate onSubmit={e => e.preventDefault()}>{form}</form></section>
          {cfg.preview ? <PreviewCard id="ed-pv" title={`Mobile preview of the ${cfg.noun}`} sources={recSources(rec, dirty, isNew)}
              payload={src => cfg.preview!(src === 'working' ? working : rec && dataAt(rec, src), rec ? rec.id : '__new__', src)} />
            : cfg.side ? <aside className="ed-side"><section className="card"><div className="card-body" id="ed-side">{cfg.side(working, rec)}</div></section></aside> : null}
        </div>
        {!isNew && rec && <HistoryCard rec={rec} describe={describe} onSaved={onSaved} />}
      </div>
    );
  }
  return { [cfg.route]: List, [`${cfg.route}-new`]: Editor, [`${cfg.route}-:id`]: Editor };
}

/* Shared field groups */
export const TZ_OPTIONS: [string, string][] = [['America/Chicago', 'Central Time – Dallas (default)'], ['America/New_York', 'Eastern Time'], ['America/Denver', 'Mountain Time'], ['America/Los_Angeles', 'Pacific Time']];
export const scheduleFields: FieldDef[] = [
  { key: 'audience', label: 'Audience', type: 'segment', hint: 'Who sees it. Segments are managed in Audience management.' },
  { key: 'startMode', label: 'Starts', type: 'radio', options: [['now', 'Instant'], ['scheduled', 'Scheduled']], default: 'scheduled',
    hint: 'Instant starts it as soon as it’s published.', onSet: d => { if (d.startMode === 'now') d.start = nowLocal().slice(0, 16); } },
  { key: 'start', label: 'Start', type: 'datetime', required: true, show: d => d.startMode !== 'now' },
  { key: 'end', label: 'End', type: 'datetime', required: true },
  { key: 'timeZone', label: 'Time zone', type: 'select', options: TZ_OPTIONS, hint: 'Pending confirmation: Central is the assumed default.' }
];
export const windowCheck = (d: Data): Errors => d.start && d.end && d.end <= d.start ? { end: 'The end must be after the start.' } : {};
const WINDOW_BADGE = { active: ['live', 'Active now'], upcoming: ['planned', 'Upcoming'], ended: ['hidden', 'Ended'], off: ['hidden', 'Turned off'] } as const;
export const WindowBadge = ({ d }: { d: Data }) => { const [k, l] = WINDOW_BADGE[windowStatus(d)]; return <Badge kind={k} text={l} />; };
export const homePreview = (audience = 'guest', type: string | null = null) => (data: Data | null, id: string, src: string, focus: string, extra: Data = {}): Payload => ({
  screen: 'home', audience, layout: layoutFor(audience), colors: colorsFor('production'), focus,
  content: appContent({ overrides: data && id !== '__new__' ? { [id]: data } : {}, newItem: id === '__new__' && data ? { type: type!, data } : null, audience, ...extra }),
  label: src === 'working' ? 'your edits, not live' : `${src} version`
});
const Sched = ({ d }: { d: Data }) => <div className="cell-stack"><span className="sched">{fmtLocal(d.start, false)} – {fmtLocal(d.end, false)}</span><WindowBadge d={d} /></div>;
const NoteLine = ({ children }: { children: ReactNode }) => <p className="note-line"><Icon name="info" size={20} /><span>{children}</span></p>;
const destCell = (d: Data) => destLabel(d.destination).split('/').flatMap((s, i) => i ? [<wbr key={i} />, `/${s}`] : [s]);
/* Dropdown options from plain strings */
const opts = (xs: string[]): [string, string][] => xs.map(x => [x, x]);

/* ---- Campaigns (Guest Flow 2 campaign card: label, title, description, badge icon, button) ---- */
const CAMPAIGN_TYPES = ['Seasonal', 'Service', 'Awareness', 'Announcement', 'Event'];
export const campaignPages = defineCollection({
  route: 'home-campaigns', type: 'campaign', area: 'campaigns', section: 'Home Screen', title: 'Campaigns', noun: 'campaign', newLabel: 'New campaign', icon: 'campaign',
  lede: 'Promotional cards in the Campaign banner module. The live campaign shows in the slot the Layout sets; ended campaigns hide themselves. The SOW proposes three to five campaigns for the MVP, pending confirmation.',
  summary: list => { const n = list.length, live = list.filter(r => windowStatus(latestData(r)) === 'active').length;
    return <>{n > 5 && <NoteLine>{n} campaigns – more than the five the SOW proposes.</NoteLine>}{live > 1 && <NoteLine>{live} campaigns are live at once. The home screen shows one at a time: the first one live for the patient’s audience.</NoteLine>}</>; },
  defaults: () => ({ title: '', type: 'Seasonal', tag: '', icon: 'vaccines', description: '', ctaLabel: '', destination: { type: 'screen', value: 'Find Care' }, audience: 'seg-all', start: nowLocal().slice(0, 11) + '08:00', end: '', timeZone: TZ, enabled: true }),
  sections: [
    { title: 'Content', fields: [
      { key: 'tag', label: 'Label above the title', max: 24, hint: 'Short and in capitals on the card, for example “Flu season”.', wide: false },
      { key: 'type', label: 'Campaign type', type: 'select', options: CAMPAIGN_TYPES, wide: false },
      { key: 'title', label: 'Campaign title', required: true, max: 40, hint: 'Fits on two lines next to the badge.' },
      { key: 'description', label: 'Description', type: 'textarea', max: 120, required: true, hint: 'One or two sentences. Say when and where.' },
      { key: 'icon', label: 'Badge icon', type: 'icon', hint: 'Shown in the round glass badge, from the approved icon list.' }] },
    { title: 'Call to action', fields: [
      { key: 'ctaLabel', label: 'Button label', required: true, max: 28 },
      { key: 'destination', label: 'Destination', type: 'destination', required: true, noNone: true }] },
    { title: 'Audience and schedule', note: 'The card hides itself after the end time, so an ended campaign never needs to be turned off by hand.', fields: [...scheduleFields] }
  ],
  validate: d => ({ ...windowCheck(d) }),
  searchExtra: d => `${d.type} ${d.tag} ${d.description}`,
  columns: [
    { key: 'type', label: 'Type', render: d => d.type },
    { key: 'audience', label: 'Audience', render: d => segmentName(d.audience) },
    { key: 'window', label: 'Schedule', sortable: true, sortValue: d => d.start, render: d => <Sched d={d} /> }
  ],
  filters: [{ key: 'type', label: 'Type', options: opts(CAMPAIGN_TYPES), match: (r, v) => latestData(r).type === v }],
  preview: (d, id, src) => homePreview(d && d.audience === 'seg-signedin' ? 'authenticated' : 'guest', 'campaign')(d, id, src, 'campaign')
});

/* ---- Emergency alerts (Guest Flow 2): emergency or advisory, pinned above the hero ---- */
const ALERT_LEVELS: [string, string][] = [['emergency', 'Emergency – red banner, can’t be dismissed'], ['advisory', 'Advisory – white banner, patients can dismiss it']];
const LevelBadge = ({ d }: { d: Data }) => d.level === 'advisory' ? <Badge kind="demo" text="Advisory" /> : <Badge kind="changes" text="Emergency" />;
export const alertPages = defineCollection({
  route: 'home-alerts', type: 'alert', area: 'alerts', section: 'Home Screen', title: 'Emergency alerts', noun: 'emergency alert', newLabel: 'New emergency alert', icon: 'warning', cls: 'alert-page',
  lede: 'Urgent safety and service messages pinned to the top of the home screen while they’re active. Use them only for emergencies and disruptions – never for promotions.',
  banner: <div className="alert-banner" role="note"><Icon name="warning" size={24} className="f1" /><div><p className="ab-t">Emergency alerts reach every patient in the audience as soon as they’re active</p><p>Check the wording on demo first. Emergency alerts show before advisories, then the newest first. The first one shows open; the rest fold under “more alerts”.</p></div></div>,
  formCls: 'alert-form', formTitle: 'Alert details',
  nameIcon: d => d.icon,
  defaults: () => ({ level: 'emergency', title: '', type: 'Weather', icon: 'warning', message: '', details: '', where: '', phone: '', audience: 'seg-all', start: nowLocal(), end: '', timeZone: TZ, duration: 'window', dismissible: false, enabled: true }),
  sections: [
    { title: 'Message', fields: [
      { key: 'level', label: 'Alert level', type: 'radio', options: ALERT_LEVELS, onSet: d => { d.dismissible = d.level === 'advisory'; } },
      { key: 'title', label: 'Alert title', required: true, max: 64, hint: 'Shown on the banner. Say what is happening, for example “Garage C entrance closed Oct. 14–16”.' },
      { key: 'type', label: 'Category', type: 'select', options: ['Weather', 'Parking', 'Facility', 'Safety', 'Service disruption', 'Public health'], wide: false },
      { key: 'icon', label: 'Category icon', type: 'alertIcon', wide: false, hint: 'Shown in the full alert. The banner uses the level’s icon.' },
      { key: 'message', label: 'Summary', type: 'textarea', required: true, max: 200, hint: 'Shown when the banner is opened. Say what to do.' },
      { key: 'details', label: 'Full alert', type: 'textarea', rows: 4, max: 600, hint: 'Shown on “Read full alert”, one point per sentence.' },
      { key: 'where', label: 'Where it applies', max: 80, hint: 'For example “All outpatient clinics”.' },
      { key: 'phone', label: 'Phone number for questions', max: 20, wide: false }] },
    { title: 'Audience and timing', fields: [
      { key: 'duration', label: 'Display duration', type: 'select', wide: false, options: [['window', 'For the whole active window'], ['1h', '1 hour after a patient first sees it'], ['4h', '4 hours after first seen'], ['24h', '24 hours after first seen']], hint: 'Meaning pending confirmation (§10.6).' },
      ...scheduleFields,
      { key: 'dismissible', label: 'Patients can dismiss it', type: 'switch', show: d => d.level === 'advisory', hint: 'Emergency alerts stay until they end.' }] }
  ],
  validate: d => ({ ...windowCheck(d), ...(d.phone && !/^[0-9()+\-. ]{7,20}$/.test(d.phone) ? { phone: 'Enter a phone number, for example 214-555-0100.' } : {}) }),
  searchExtra: d => `${d.type} ${d.message} ${d.where}`,
  columns: [
    { key: 'level', label: 'Level', sortable: true, sortValue: d => d.level === 'advisory' ? 1 : 0, render: d => <LevelBadge d={d} /> },
    { key: 'type', label: 'Category', render: d => d.type },
    { key: 'window', label: 'Active window', sortable: true, sortValue: d => d.start, render: d => <Sched d={d} /> }
  ],
  filters: [{ key: 'level', label: 'Level', options: [['emergency', 'Emergency'], ['advisory', 'Advisory']], match: (r, v) => (latestData(r).level || 'emergency') === v }],
  preview: (d, id, src) => homePreview('guest', 'alert')(d, id, src, 'alerts')
});

/* ---- Quick links (Guest Flow 2: four MyChart tasks in a 2 × 2 grid) ---- */
const QL_MAX = 4;
export const quickLinkPages = defineCollection({
  route: 'home-quick-links', type: 'quickLink', area: 'quickLinks', section: 'Home Screen', title: 'Quick links', noun: 'quick link', newLabel: 'New quick link', icon: 'apps',
  lede: 'The four tiles in the Quick links module, in a 2 × 2 grid with the icon left of a two-line label. In the guest design all four open MyChart; the Admin never edits MyChart content.',
  summary: list => { const on = list.filter(r => latestData(r).enabled !== false).length; return on > QL_MAX ? <NoteLine>{on} quick links are on. The home screen shows the first {QL_MAX} by position.</NoteLine> : null; },
  nameIcon: d => d.icon, defaultSort: { key: 'order', dir: 'asc' },
  defaults: () => ({ title: '', icon: 'chat', iconAlt: '', destination: { type: 'mychart', value: 'Messages' }, requiresSignIn: true, order: Math.min(ConfigService.peekAll('quickLink').length + 1, QL_MAX), enabled: true }),
  sections: [{ title: 'Tile', fields: [
    { key: 'title', label: 'Title', required: true, max: 26, hint: 'Fits on two lines next to the icon.' },
    { key: 'icon', label: 'Icon', type: 'icon' },
    { key: 'iconAlt', label: 'Icon alternative text', max: 60, hint: 'Leave empty when the title already says it – the icon is then decorative.' },
    { key: 'destination', label: 'Destination', type: 'destination', required: true, noNone: true },
    { key: 'requiresSignIn', label: 'Opens MyChart sign-in first', type: 'switch', hint: 'Guests go to MyChart sign-in, then to the task. Screen readers hear “opens MyChart”.' },
    { key: 'order', label: 'Position', type: 'number', min: 1, maxNum: QL_MAX, wide: false, hint: 'Reading order: 1 and 2 on top, 3 and 4 below.' }] }],
  validate: d => d.destination.type === 'mychart' && !d.requiresSignIn ? { requiresSignIn: 'MyChart destinations need sign-in. Turn on “Opens MyChart sign-in first”.' } as Errors : {},
  columns: [
    { key: 'destination', label: 'Destination', render: destCell, cls: 'dest' },
    { key: 'order', label: 'Position', sortable: true, sortValue: d => d.order, render: d => <span className="ord-chip">{d.order}</span>, cls: 'ord' },
    { key: 'signin', label: 'Sign-in', render: d => d.requiresSignIn ? <Badge kind="fixed" text="MyChart" /> : <span className="muted">Open</span> }
  ],
  preview: (d, id, src) => homePreview('guest', 'quickLink')(d, id, src, 'tiles')
});

/* ---- Services and resources cards (type featuredCard; Guest Flow 2) ---- */
const RESOURCE_CATEGORIES = ['Wayfinding', 'Video visits', 'Resources', 'Billing', 'Care options'];
export const resourcePages = defineCollection({
  route: 'home-featured-cards', type: 'featuredCard', area: 'featuredCards', section: 'Home Screen', title: 'Services and resources', noun: 'resource card', newLabel: 'New resource card', icon: 'library_books',
  lede: 'Swipeable cards in the Services and resources module: a Blue art panel with the card’s icon, a category label, a title, and one line of help.',
  nameIcon: d => d.icon, nameSub: d => d.subtitle, defaultSort: { key: 'order', dir: 'asc' },
  defaults: () => ({ category: 'Resources', title: '', subtitle: '', icon: 'article', iconAlt: '', destination: { type: 'screen', value: 'Find Care' }, order: ConfigService.peekAll('featuredCard').length + 1, enabled: true }),
  sections: [{ title: 'Card', fields: [
    { key: 'category', label: 'Category label', type: 'select', options: RESOURCE_CATEGORIES, wide: false, hint: 'The small label above the title.' },
    { key: 'title', label: 'Title', required: true, max: 32 },
    { key: 'subtitle', label: 'One line of help', max: 64, required: true },
    { key: 'icon', label: 'Icon', type: 'icon', hint: 'Shown large on the Blue art panel.' },
    { key: 'iconAlt', label: 'Icon alternative text', max: 60, hint: 'Leave empty when the title already says it.' },
    { key: 'destination', label: 'Destination', type: 'destination', required: true, noNone: true },
    { key: 'order', label: 'Position', type: 'number', min: 1, maxNum: 12, wide: false }] }],
  columns: [
    { key: 'category', label: 'Category', render: d => d.category || '–' },
    { key: 'destination', label: 'Destination', render: destCell, cls: 'dest' },
    { key: 'order', label: 'Position', sortable: true, sortValue: d => d.order, render: d => <span className="ord-chip">{d.order}</span>, cls: 'ord' }
  ],
  filters: [{ key: 'category', label: 'Category', options: opts(RESOURCE_CATEGORIES), match: (r, v) => latestData(r).category === v }],
  preview: (d, id, src) => homePreview('guest', 'featuredCard')(d, id, src, 'services')
});

/* ---- Audience segments ---- */
type AttrKey = keyof typeof AUDIENCE_ATTRS;
export const ruleText = (r: Rule): string => `${AUDIENCE_ATTRS[r.attr as AttrKey].label} ${r.op} ${r.value}`;
export const segmentSummary = (d: Data): string => !d.rules.length ? 'Everyone who uses MyCare' : `People where ${d.rules.map(ruleText).join(d.match === 'all' ? ' and ' : ' or ')}`;
export function segmentConflicts(d: Data): string[] {
  if (d.match !== 'all') return [];
  const out: string[] = [], by: Record<string, Set<string>> = {};
  (d.rules as Rule[]).forEach(r => { if (r.op === 'is') (by[r.attr] = by[r.attr] || new Set()).add(r.value); });
  Object.entries(by).forEach(([a, vals]) => { if (vals.size > 1) out.push(`${AUDIENCE_ATTRS[a as AttrKey].label} can’t be ${[...vals].join(' and ')} at the same time, so nobody matches. Use “Any rule” or remove one.`); });
  return out;
}
export const segmentUsers = (id: string): [string, string, string][] => [
  ...ConfigService.peekAll('campaign').filter(r => latestData(r).audience === id).map(r => ['Campaign', r.name, `home-campaigns-${r.id}`] as [string, string, string]),
  ...ConfigService.peekAll('alert').filter(r => latestData(r).audience === id).map(r => ['Emergency alert', r.name, `home-alerts-${r.id}`] as [string, string, string]),
  ...DB.db.notifications.filter(n => n.sendTo === id && !['sent', 'cancelled'].includes(n.status)).map(n => ['Notification', n.title, `notifications-${n.id}`] as [string, string, string])
];
export const segmentPages = defineCollection({
  route: 'audiences', type: 'segment', area: 'audiences', section: 'Audience management', title: 'Audience segments', noun: 'segment', newLabel: 'New segment', icon: 'groups', nameLabel: 'Segment',
  lede: 'Groups of app users that campaigns, alerts and notifications can target. Only approved, non-clinical attributes are available – no PHI.',
  defaults: () => ({ name: '', description: '', match: 'all', rules: [{ attr: 'signedIn', op: 'is', value: 'Guest' }], reach: 0 }),
  sections: [{ title: 'Segment', fields: [
    { key: 'name', label: 'Segment name', required: true, max: 40 },
    { key: 'description', label: 'Description', type: 'textarea', max: 160 },
    { key: 'match', label: 'Include people who match', type: 'radio', options: [['all', 'All rules'], ['any', 'Any rule']] },
    { key: 'rules', label: 'Eligibility rules', type: 'rules', hint: 'Attributes and values are pending UTSW approval (§10.13).' }] }],
  validate: d => { const c = segmentConflicts(d); return c.length ? { rules: c[0] } : {}; },
  describe: (a, b) => !a ? ['New segment'] : [
    ...(a.name !== b.name ? [`Name: “${a.name}” → “${b.name}”`] : []), ...(a.description !== b.description ? ['Description is edited'] : []),
    ...(a.match !== b.match || !same(a.rules, b.rules) ? [`Rules: ${segmentSummary(a)} → ${segmentSummary(b)}`] : [])],
  searchExtra: d => d.description,
  columns: [
    { key: 'rules', label: 'Who’s included', render: d => <span className="wrap-txt">{segmentSummary(d)}</span>, cls: 'wrap' },
    { key: 'reach', label: 'Estimated reach', sortable: true, sortValue: d => d.reach, render: d => d.reach ? <>{d.reach.toLocaleString('en-US')} <span className="muted">(sample)</span></> : <span className="muted">Estimated after publishing</span>, cls: 'num' }
  ],
  side: (d, rec) => {
    const used = rec ? segmentUsers(rec.id) : [], conf = segmentConflicts(d);
    return <>
      <h2 className="side-h">Who’s in this segment</h2><p>{segmentSummary(d)}.</p>
      {conf.length > 0 && <p className="err"><Icon name="error" size={16} /><span>{conf[0]}</span></p>}
      <p className="side-k">Estimated reach</p><p className="side-v">{d.reach ? `${d.reach.toLocaleString('en-US')} people` : 'Calculated after publishing'} <span className="muted">(sample)</span></p>
      <p className="side-k">Used by</p>{used.length ? <ul className="plain">{used.map(([t, n, href]) => <li key={href}><span className="muted">{t}:</span> <a href={`#${href}`}>{n}</a></li>)}</ul> : <p className="muted">Nothing targets this segment yet. Assign it in Targeting.</p>}
      <p><a className="text-link" href="#audiences-rules"><Icon name="science" size={20} />Test a person against every segment</a></p>
    </>;
  }
});
