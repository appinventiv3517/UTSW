/* ---------- Audit and versioning, platform operations, administrative settings, audience rules and targeting, zero-result searches ---------- */
/* EXTRA_GLYPHS: difference history info refresh save close task_alt */
import { useState, type ReactNode } from 'react';
import type { Page, PageProps } from '../app/App';
import { PageHead } from '../app/Shell';
import { Router } from '../app/router';
import { Session } from '../app/session';
import { ROLES, PERMISSIONS, LEVEL_LABEL, can, canAct, type Role } from '../app/permissions';
import { useLoad } from '../app/useLoad';
import { AuditService, CONFIG_TYPES, ConfigService, DB, PlatformService, SettingsService, UserService, ZeroResultService, dataAt, latestData, recLink } from '../services/services';
import { AUDIENCE_ATTRS } from '../mock/seed';
import { Badge, Btn, ErrorState, Icon, LoadingState } from '../ui/kit';
import { Select } from '../ui/Select';
import { DataTable } from '../ui/DataTable';
import { Form, segmentName, segmentOptions, type FieldDef, type FormSection } from '../ui/forms';
import { EnvBadges, formModal } from '../ui/Lifecycle';
import { LineChart } from '../ui/charts';
import { confirmDialog, openModal, ModalFrame, toast } from '../ui/overlays';
import { TZ_OPTIONS, lastChange, ruleText, segmentConflicts } from './collection';
import { clone, fmtDate, fmtDateTime, plural, same, uid } from '../app/util';
import type { AuditEntry, ConfigRecord, ConfigType, Data, Integration, ZeroResult } from '../app/types';
import type { Rule } from '../ui/forms';

const OTHER_TYPES: Record<string, string> = { user: 'User', notification: 'Notification', wayfinding: 'Wayfinding', search: 'Search', settings: 'Settings', platform: 'Platform' };
const TYPE_LABEL = (t: string | null) => !t ? '' : (CONFIG_TYPES[t as ConfigType] ? CONFIG_TYPES[t as ConfigType].label : OTHER_TYPES[t] || t);
const Muted = ({ children }: { children: ReactNode }) => <span className="muted">{children}</span>;

/* Before-and-after values, flattened to dotted field names */
function DiffTable({ before, after }: { before: unknown; after: unknown }) {
  type O = Record<string, unknown>;
  const flat = (o: unknown, p = ''): O => !o || typeof o !== 'object' ? { [p || 'value']: o } : Object.entries(o as O).reduce((a: O, [k, v]) => Object.assign(a, v && typeof v === 'object' && !Array.isArray(v) ? flat(v, p ? `${p}.${k}` : k) : { [p ? `${p}.${k}` : k]: v }), {});
  const A = flat(before || {}), B = flat(after || {});
  const keys = [...new Set([...Object.keys(A), ...Object.keys(B)])].filter(k => !same(A[k], B[k]));
  const show = (v: unknown) => v == null ? <Muted>–</Muted> : Array.isArray(v) ? (v.length && typeof v[0] === 'object' ? `${v.length} items` : v.join(', ')) : String(v);
  if (!before && !after) return <p className="muted">No before-and-after detail is recorded for this action.</p>;
  if (!keys.length) return <p className="muted">No field-level differences.</p>;
  return (
    <><div className="tbl-wrap" tabIndex={0} role="region" aria-label="Before and after"><table className="tbl diff"><caption className="vh">Before and after values</caption>
      <thead><tr><th scope="col">Field</th><th scope="col">Before</th><th scope="col">After</th></tr></thead>
      <tbody>{keys.slice(0, 40).map(k => <tr key={k}><th scope="row">{k}</th><td className="wrap">{show(A[k])}</td><td className="wrap">{show(B[k])}</td></tr>)}</tbody></table></div>
      {keys.length > 40 && <p className="muted">And {keys.length - 40} more fields.</p>}</>
  );
}
const Loading = ({ load, retry, text, children }: { load: { status: string; error?: string }; retry: () => void; text: string; children: () => ReactNode }) =>
  <>{load.status === 'loading' ? <LoadingState text={text} /> : load.status === 'error' ? <ErrorState msg={load.error!} onRetry={retry} /> : children()}</>;

function AuditPage(_: PageProps) {
  const [load, retry] = useLoad(() => AuditService.list());
  const details = (r: AuditEntry) => openModal({ wide: true, render: ({ close }) => (
    <ModalFrame title={`${r.action}: ${r.target}`} close={close} actions={<Btn label="Close" variant="primary" data-close="" onClick={close} />}>
      <dl className="facts cols"><dt>When</dt><dd>{fmtDateTime(r.at)}</dd><dt>Actor</dt><dd>{UserService.name(r.by)}</dd>
        <dt>Item</dt><dd>{TYPE_LABEL(r.targetType)}{r.targetId && DB.db.records[r.targetId] ? <> – <a href={`#${recLink(DB.db.records[r.targetId])}`} onClick={close}>open</a></> : null}</dd>
        <dt>Environment</dt><dd>{r.environment ? <Badge kind={r.environment} /> : '–'}{r.version ? ` v${r.version}` : ''}</dd><dt>Comment</dt><dd>{r.comment || 'None'}</dd></dl>
      <h3 className="sub-h">Before and after</h3><DiffTable before={r.before} after={r.after} />
    </ModalFrame>) });
  return (
    <div className="page">
      <PageHead crumbs={[['Audit and versioning', null]]} title="Audit logs" lede="Every administrative action in MyCare Admin: who did it, when, and what changed. Retention is pending confirmation (§10.16)." />
      <div id="au"><Loading load={load} retry={retry} text="Loading the audit log">{() => {
        const rows = load.status === 'ok' ? load.data : [];
        const types = [...new Set(rows.map(r => r.targetType))].filter((t): t is string => !!t);
        return <section className="card"><div className="card-body" id="au-t">
          <DataTable<AuditEntry> id="au" caption="Audit log" noun="entry" rows={rows} defaultSort={{ key: 'at', dir: 'desc' }} searchPlaceholder="Search actions, items and comments" rowKey={r => r.id}
            searchText={r => `${r.action} ${r.target} ${r.comment} ${UserService.name(r.by)}`}
            filters={[
              { key: 'by', label: 'Actor', options: DB.db.users.map(u => [u.id, `${u.first} ${u.last}`] as [string, string]), match: (r, v) => r.by === v },
              { key: 'type', label: 'Item type', options: types.map(t => [t, TYPE_LABEL(t)] as [string, string]), match: (r, v) => r.targetType === v },
              { key: 'env', label: 'Environment', options: [['draft', 'Draft'], ['demo', 'Demo'], ['production', 'Production']], match: (r, v) => r.environment === v }]}
            empty={{ icon: 'history', title: 'No entries yet' }}
            columns={[
              { key: 'at', label: 'When', sortable: true, render: r => <span className="nowrap">{fmtDateTime(r.at)}</span> },
              { key: 'by', label: 'Actor', sortable: true, sortValue: r => UserService.name(r.by), render: r => UserService.name(r.by) },
              { key: 'action', label: 'Action', sortable: true, render: r => r.action },
              { key: 'target', label: 'Item', render: r => <>{r.target}<br /><span className="muted">{TYPE_LABEL(r.targetType)}{r.version ? ` · v${r.version}` : ''}</span></>, cls: 'wrap' },
              { key: 'env', label: 'Environment', render: r => r.environment ? <Badge kind={r.environment} /> : <Muted>–</Muted> },
              { key: 'details', label: 'Details', hideLabel: true, render: r => <Btn label={`Details for ${r.action}`} icon="difference" variant="text" iconOnly data-au={r.id} onClick={() => details(r)} /> }]} />
        </div></section>;
      }}</Loading></div>
    </div>
  );
}

function HistoryPage(_: PageProps) {
  const [load, retry] = useLoad(() => ConfigService.list());
  const versions = (r: ConfigRecord) => {
    const canRb = CONFIG_TYPES[r.type].supportsRollback && canAct(Session.role(), CONFIG_TYPES[r.type].area, 'rollback');
    const rb = async (v: number, close: () => void) => {
      close();
      const c = await confirmDialog({ title: `Roll back ${r.name} to v${v}?`, body: <p>This creates version {r.nextVersion} with the contents of v{v} on demo and production.</p>, confirmLabel: `Roll back to v${v}`, variant: 'danger', comment: { label: 'Reason for the rollback', required: true } });
      if (!c.ok) return;
      try { await ConfigService.rollback(r.id, v, c.comment); toast(`${r.name} rolled back to v${v}.`, { kind: 'success' }); retry(); }
      catch (err) { toast((err as Error).message, { kind: 'error', ms: 8000 }); }
    };
    openModal({ wide: true, render: ({ close }) => (
      <ModalFrame title={`Versions of ${r.name}`} close={close}
        actions={<><a className="btn btn-secondary" href={`#${recLink(r)}`} data-close-nav="" onClick={close}><span className="lbl">Open the editor</span></a><Btn label="Close" variant="primary" data-close="" onClick={close} /></>}>
        <ol className="versions">{Object.values(r.versions).sort((a, b) => b.version - a.version).map(v => (
          <li key={v.version}><div className="v-h"><b>v{v.version}</b> {v.version === r.production && <Badge kind="production" />}{v.version === r.demo && r.demo !== r.production && <Badge kind="demo" />}
            <span className="muted">{fmtDateTime(v.updatedAt)} · {UserService.name(v.updatedBy)}</span>
            {canRb && v.version !== r.production && <Btn label={`Roll back to v${v.version}`} icon="history" variant="text" data-rb={v.version} onClick={() => rb(v.version, close)} />}</div>
            {v.comment && <p>{v.comment}</p>}
            {v.version !== r.production && r.production && <details><summary>Compare with production v{r.production}</summary><DiffTable before={r.versions[r.production].data} after={v.data} /></details>}</li>))}</ol>
        {!CONFIG_TYPES[r.type].supportsRollback && <p className="note-line"><Icon name="info" size={20} /><span>{TYPE_LABEL(r.type)}s don’t support rollback. Edit and publish a new version instead.</span></p>}
      </ModalFrame>) });
  };
  return (
    <div className="page">
      <PageHead crumbs={[['Audit and versioning', null]]} title="Configuration history" lede="Every configuration with its versions. Rollback is offered only for types that support it – all flags are assumptions pending confirmation (§10.17)." />
      <div id="ch"><Loading load={load} retry={retry} text="Loading configurations">{() => {
        const recs = load.status === 'ok' ? load.data : [];
        return <section className="card"><div className="card-body" id="ch-t">
          <DataTable<ConfigRecord> id="ch" caption="Configurations" noun="configuration" rows={recs} defaultSort={{ key: 'updated', dir: 'desc' }} searchText={r => `${r.name} ${TYPE_LABEL(r.type)}`} rowKey={r => r.id}
            filters={[{ key: 'type', label: 'Type', options: [...new Set(recs.map(r => r.type))].map(t => [t, TYPE_LABEL(t)] as [string, string]), match: (r, v) => r.type === v },
              { key: 'rb', label: 'Rollback', options: [['yes', 'Supported'], ['no', 'Not supported']], match: (r, v) => CONFIG_TYPES[r.type].supportsRollback === (v === 'yes') }]}
            empty={{ icon: 'history', title: 'No configurations' }}
            columns={[
              { key: 'name', label: 'Configuration', sortable: true, sortValue: r => r.name.toLowerCase(), render: r => <a className="row-link" href={`#${recLink(r)}`}>{r.name}</a> },
              { key: 'type', label: 'Type', sortable: true, sortValue: r => TYPE_LABEL(r.type), render: r => TYPE_LABEL(r.type) },
              { key: 'versions', label: 'Versions', sortable: true, sortValue: r => Object.keys(r.versions).length, render: r => String(Object.keys(r.versions).length), cls: 'num' },
              { key: 'status', label: 'Publishing', render: r => <EnvBadges r={r} /> },
              { key: 'rb', label: 'Rollback', render: r => CONFIG_TYPES[r.type].supportsRollback ? <Badge kind="pending" text="Supported" /> : <Muted>Not supported</Muted> },
              { key: 'updated', label: 'Last change', sortable: true, sortValue: lastChange, render: r => <span className="nowrap">{fmtDateTime(lastChange(r))}</span> },
              { key: 'v', label: 'Versions', hideLabel: true, render: r => Object.keys(r.versions).length ? <Btn label={`Versions of ${r.name}`} icon="history" variant="text" iconOnly data-ver={r.id} onClick={() => versions(r)} /> : null }]} />
        </div></section>;
      }}</Loading></div>
    </div>
  );
}

/* ---- Platform operations (simulated; scope requires discovery) ---- */
const INTEG: Record<string, [string, string]> = { simulated: ['simulated', 'Simulated – not connected'], manual: ['pending', 'Manual process'] };
function IntegrationsPage(_: PageProps) {
  const canRun = can(Session.role(), 'platform', 'publish');
  const [load, retry, setList] = useLoad(() => PlatformService.integrations());
  const [busy, setBusy] = useState<string | null>(null);
  const check = async (id: string, list: Integration[]) => {
    setBusy(id);
    try { const i = await PlatformService.check(id); setBusy(null); setList(list.map(x => x.id === i.id ? i : x)); toast(`${i.name}: still simulated – nothing to connect to yet.`); requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-chk="${i.id}"]`)?.focus()); }
    catch (err) { setBusy(null); toast((err as Error).message, { kind: 'error', ms: 8000 }); }
  };
  return (
    <div className="page">
      <PageHead crumbs={[['Platform operations', null]]} title="Integration status" lede="The systems MyCare Admin depends on. Nothing is connected in the prototype, so every status is simulated. Credential management is out of scope." />
      <div id="pi"><Loading load={load} retry={retry} text="Checking integrations">{() => {
        const list = load.status === 'ok' ? load.data : [];
        return <div className="integ-grid">{list.map(i => (
          <section key={i.id} className="card integ" aria-labelledby={`ig-${i.id}`}><div className="card-body">
            <h2 id={`ig-${i.id}`} className="side-h">{i.name}</h2><p className="muted">{i.purpose}</p><Badge kind={INTEG[i.status][0]} text={INTEG[i.status][1]} />
            <p>{i.detail}</p><p className="muted small">{i.lastCheck ? `Last checked ${fmtDateTime(i.lastCheck)} (simulated)` : 'Not checked yet'}</p>
            {canRun && <Btn label="Run check" icon="refresh" variant="secondary" data-chk={i.id} aria-label={`Run check on ${i.name}`} busy={busy === i.id} busyLabel="Checking" onClick={() => check(i.id, list)} />}
          </div></section>))}</div>;
      }}</Loading></div>
    </div>
  );
}
function MonitoringPage(_: PageProps) {
  const [load, retry] = useLoad(() => PlatformService.monitoring(30));
  type Inc = { at: string; title: string; severity: string; status: string; minutes: number };
  return (
    <div className="page">
      <PageHead crumbs={[['Platform operations', null]]} title="Operational monitoring" badges={<Badge kind="mock" />} lede="Errors and performance for the configuration the app loads. Sample data; advanced observability tooling needs discovery and approval." />
      <div id="pm"><Loading load={load} retry={retry} text="Loading monitoring">{() => {
        if (load.status !== 'ok') return null;
        const m = load.data;
        return <>
          <div className="two-col">
            <section className="card"><div className="card-head"><h2>Configuration fetch errors</h2></div><div className="card-body"><p className="chart-sub">Percent of app launches, last 30 days</p><div id="pm-err"><LineChart points={m.errors} unit="%" label="Configuration fetch errors" zeroBase /></div></div></section>
            <section className="card"><div className="card-head"><h2>Configuration fetch time</h2></div><div className="card-body"><p className="chart-sub">Median, last 30 days · lower is better</p><div id="pm-lat"><LineChart points={m.latency} unit="ms" label="Configuration fetch time" /></div></div></section></div>
          <section className="card"><div className="card-head"><h2>Incidents</h2></div><div className="card-body" id="pm-inc">
            <DataTable<Inc> id="inc" caption="Incidents" noun="incident" rows={m.incidents} defaultSort={{ key: 'at', dir: 'desc' }} searchText={i => i.title} rowKey={i => i.at} empty={{ title: 'No incidents' }}
              columns={[{ key: 'at', label: 'Started', sortable: true, render: i => fmtDateTime(i.at) }, { key: 'title', label: 'Incident', render: i => i.title, cls: 'wrap' },
                { key: 'severity', label: 'Severity', render: i => <Badge kind={i.severity === 'Moderate' ? 'review' : 'pending'} text={i.severity} /> }, { key: 'minutes', label: 'Duration', sortable: true, render: i => `${i.minutes} min`, cls: 'num' },
                { key: 'status', label: 'Status', render: i => <Badge kind="live" text={i.status} /> }]} />
          </div></section>
        </>;
      }}</Loading></div>
    </div>
  );
}

/* ---- Administrative settings ---- */
const SETTINGS_FIELDS: FieldDef[] = [
  { key: 'sessionTimeout', label: 'Sign out after inactivity', type: 'select', options: [['15', '15 minutes'], ['30', '30 minutes'], ['60', '60 minutes']], hint: 'Pending the approved UTSW timeout.' },
  { key: 'timeZone', label: 'Default time zone for schedules', type: 'select', options: TZ_OPTIONS },
  { key: 'requirePublishComment', label: 'Require a comment to publish to production', type: 'switch' },
  { key: 'previewDefault', label: 'Default preview appearance', type: 'radio', options: [['light', 'Light'], ['dark', 'Dark']] }
];
const AREA_NAMES: Record<string, string> = { dashboard: 'Dashboard', analytics: 'Analytics', homeLayout: 'Home layout', quickLinks: 'Quick links', featuredCards: 'Services and resources', drawer: 'Menu', appEntry: 'App entry', campaigns: 'Campaigns', alerts: 'Emergency alerts', colors: 'Global colors', search: 'Search', audiences: 'Audiences', wayfinding: 'Wayfinding', notifications: 'Notifications', users: 'Users', audit: 'Audit and versioning', platform: 'Platform operations', adminSettings: 'Administrative settings', locations: 'Location-aware configuration' };
function SettingsPage(_: PageProps) {
  const [load, retry] = useLoad(() => SettingsService.get());
  return (
    <div className="page">
      <PageHead crumbs={[['Administrative settings', null]]} title="Approved settings" lede="Settings for MyCare Admin itself. Changes apply right away and are recorded in the audit log." />
      <div id="as"><Loading load={load} retry={retry} text="Loading settings">{() => load.status === 'ok' ? <SettingsBody s={load.data} /> : null}</Loading></div>
    </div>
  );
}
function SettingsBody({ s }: { s: Data }) {
  const ro = !can(Session.role(), 'adminSettings', 'publish');
  const [d, setD] = useState<Data>({ ...s, sessionTimeout: String(s.sessionTimeout) });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await SettingsService.save({ ...d, sessionTimeout: +d.sessionTimeout }); toast('Settings saved.', { kind: 'success' }); }
    catch (err) { toast((err as Error).message, { kind: 'error', ms: 8000 }); }
    setBusy(false);
  };
  return (
    <div className="ed-grid">
      <section className="card"><div className="card-head"><h2>Settings</h2>{ro && <div className="card-actions"><Badge kind="fixed" text="View only" /></div>}</div>
        <form className="card-body form" id="as-f" noValidate onSubmit={e => { e.preventDefault(); save(); }}>
          <Form sections={[{ fields: SETTINGS_FIELDS.map(x => ro ? { ...x, readonly: true } : x) }]} data={d} prefix="f" onChange={setD} />
          {!ro && <div className="form-actions"><Btn label="Save settings" icon="save" variant="primary" type="submit" id="as-save" busy={busy} busyLabel="Saving" /></div>}
        </form></section>
      <aside className="ed-side"><section className="card"><div className="card-head"><h2>Roles and permissions</h2><div className="card-actions"><Badge kind="pending" text="Proposed" /></div></div><div className="card-body">
        <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Permission matrix"><table className="tbl matrix"><caption className="vh">Permission matrix, proposed</caption>
          <thead><tr><th scope="col">Area</th>{Object.values(ROLES).map(r => <th key={r.label} scope="col">{r.label}</th>)}</tr></thead>
          <tbody>{Object.entries(PERMISSIONS.areas).map(([a, lv]) => <tr key={a}><th scope="row">{AREA_NAMES[a] || a}</th>{(Object.keys(ROLES) as Role[]).map(r => <td key={r}>{LEVEL_LABEL[lv[r]]}</td>)}</tr>)}</tbody></table></div>
        <p className="muted">Pending UTSW confirmation. The matrix lives in one place so the confirmed version replaces it without screen changes.</p></div></section></aside>
    </div>
  );
}

/* ---- Segment rules: every rule, conflicts, and a tester ---- */
const matchRule = (ru: Rule, p: Data) => { const v = p[ru.attr]; if (ru.op === 'is') return v === ru.value; if (ru.op === 'is not') return v !== ru.value; if (ru.op === 'at least') return +v >= +ru.value; if (ru.op === 'below') return +v < +ru.value; return false; };
const matches = (d: Data, p: Data) => !d.rules.length || (d.match === 'all' ? d.rules.every((r: Rule) => matchRule(r, p)) : d.rules.some((r: Rule) => matchRule(r, p)));
function RulesPage(_: PageProps) {
  const [load, retry] = useLoad(() => ConfigService.list('segment'));
  const [person, setPerson] = useState<Data>({ signedIn: 'Guest', language: 'English', region: 'Dallas', locationShared: 'On', platform: 'iOS', appVersion: '5.2' });
  const pf: FieldDef[] = Object.entries(AUDIENCE_ATTRS).map(([k, a]) => ({ key: k, label: a.label, type: 'select', options: a.values, wide: false }));
  type RuleRow = { id: string; seg: ConfigRecord; d: Data; ru: Rule | null; i: number };
  return (
    <div className="page">
      <PageHead crumbs={[['Audience management', null]]} title="Segment rules" lede="Every eligibility rule across segments, checked for conflicts, and a tester to see which segments a person would fall into." />
      <div id="sr"><Loading load={load} retry={retry} text="Loading rules">{() => {
        const segs = load.status === 'ok' ? load.data : [];
        const rows: RuleRow[] = segs.flatMap(r => { const d = latestData(r); return d.rules.length ? d.rules.map((ru: Rule, i: number) => ({ id: `${r.id}-${i}`, seg: r, d, ru, i })) : [{ id: r.id, seg: r, d, ru: null, i: 0 }]; });
        const hits = segs.filter(r => matches(latestData(r), person));
        return <div className="ed-grid">
          <section className="card"><div className="card-head"><h2>All rules</h2></div><div className="card-body" id="sr-t">
            <DataTable<RuleRow> id="sr" caption="Segment rules" noun="rule" rows={rows} searchText={r => `${r.seg.name} ${r.ru ? ruleText(r.ru) : ''}`} rowKey={r => r.id} empty={{ title: 'No rules' }}
              filters={[{ key: 'attr', label: 'Attribute', options: Object.entries(AUDIENCE_ATTRS).map(([k, a]) => [k, a.label] as [string, string]), match: (r, v) => !!r.ru && r.ru.attr === v }]}
              columns={[
                { key: 'seg', label: 'Segment', sortable: true, sortValue: r => r.seg.name, render: r => <a className="row-link" href={`#audiences-${r.seg.id}`}>{r.seg.name}</a> },
                { key: 'rule', label: 'Rule', render: r => r.ru ? ruleText(r.ru) : <Muted>No rules – everyone</Muted>, cls: 'wrap' },
                { key: 'match', label: 'Combine', render: r => r.d.rules.length > 1 ? (r.d.match === 'all' ? 'All rules' : 'Any rule') : <Muted>–</Muted> },
                { key: 'check', label: 'Check', render: r => segmentConflicts(r.d).length ? <Badge kind="error" text="Conflict" /> : <Badge kind="live" text="OK" /> }]} />
          </div></section>
          <aside className="ed-side"><section className="card"><div className="card-head"><h2>Test a person</h2></div><div className="card-body">
            <p className="muted">Pick attributes for a sample person. Nothing about real users is looked up.</p>
            <form id="sr-p" className="form" noValidate onSubmit={e => e.preventDefault()}><Form sections={[{ fields: pf }]} data={person} prefix="p" onChange={setPerson} /></form>
            <div id="sr-out" role="status" className="tester-out"><h3 className="sub-h">In {plural(hits.length, 'segment')}</h3>
              <ul className="plain">{segs.map(r => <li key={r.id}>{hits.includes(r) ? <Badge kind="live" text="In" /> : <Badge kind="hidden" text="Out" />} <a href={`#audiences-${r.id}`}>{latestData(r).name}</a></li>)}</ul></div>
          </div></section></aside>
        </div>;
      }}</Loading></div>
    </div>
  );
}

/* ---- Targeting: assign segments to campaigns and alerts (saved as drafts on each item) ---- */
function TargetingPage(_: PageProps) {
  const [load, retry, setRecs] = useLoad(async () => (await ConfigService.list()).filter(r => r.type === 'campaign' || r.type === 'alert'));
  const [busy, setBusy] = useState<string | null>(null);
  const opts = segmentOptions();
  const change = async (r: ConfigRecord, v: string, recs: ConfigRecord[]) => {
    setBusy(r.id);
    try {
      const nr = await ConfigService.saveDraft(r.id, { ...clone(latestData(r)), audience: v }, `Audience changed to ${segmentName(v)}`);
      setBusy(null); setRecs(recs.map(x => x.id === nr.id ? nr : x));
      toast(`${r.name}: draft saved with audience ${segmentName(v)}. Deploy it to demo from the item.`, { kind: 'success' });
      requestAnimationFrame(() => document.getElementById(`tg-${r.id}-dd`)?.focus());
    } catch (err) { setBusy(null); toast((err as Error).message, { kind: 'error', ms: 8000 }); }
  };
  return (
    <div className="page">
      <PageHead crumbs={[['Audience management', null]]} title="Targeting" lede="Which segment each campaign and emergency alert targets. A change saves a draft on that item, which then goes through demo and production as usual." />
      <div id="tg"><Loading load={load} retry={retry} text="Loading targeting">{() => {
        const recs = load.status === 'ok' ? load.data : [];
        return <>
          <section className="card"><div className="card-body" id="tg-t">
            <DataTable<ConfigRecord> id="tg" caption="Targeting" noun="item" rows={recs} searchText={r => r.name} defaultSort={{ key: 'name', dir: 'asc' }} rowKey={r => r.id} empty={{ title: 'Nothing to target' }}
              filters={[{ key: 'type', label: 'Type', options: [['campaign', 'Campaigns'], ['alert', 'Emergency alerts']], match: (r, v) => r.type === v }]}
              columns={[
                { key: 'name', label: 'Item', sortable: true, sortValue: r => r.name.toLowerCase(), render: r => <><a className="row-link" href={`#${recLink(r)}`}>{r.name}</a><br /><span className="muted">{TYPE_LABEL(r.type)}</span></> },
                { key: 'seg', label: 'Segment', render: r => can(Session.role(), CONFIG_TYPES[r.type].area, 'draft')
                  ? <><label className="vh" htmlFor={`tg-${r.id}-dd`} id={`tg-${r.id}-lbl`}>Segment for {r.name}</label>
                    <Select id={`tg-${r.id}`} className="input input-sm" labelId={`tg-${r.id}-lbl`} options={opts} value={latestData(r).audience} disabled={busy === r.id} data={{ tg: r.id }} onChange={v => change(r, v, recs)} /></>
                  : segmentName(latestData(r).audience) },
                { key: 'live', label: 'In production', render: r => { const d = dataAt(r, 'production'); return d ? segmentName(d.audience) : <Muted>Not published</Muted>; } },
                { key: 'status', label: 'Publishing', render: r => <EnvBadges r={r} /> }]} />
          </div></section>
          <p className="note-line"><Icon name="info" size={20} /><span>Home module visibility by segment and notification targeting are set on the Home screen layout (per audience) and on each notification.</span></p>
        </>;
      }}</Loading></div>
    </div>
  );
}

/* ---- Zero-result queries → add a synonym or mapping, or dismiss ---- */
const SPECIALTY_LIST = (): string[] => { const r = ConfigService.peek('search-specialties'); return r ? latestData(r).rows.map((x: Data) => x.specialty) : []; };
const ZR_BADGE: Record<string, [string, string]> = { open: ['review', 'Open'], resolved: ['live', 'Fixed'], dismissed: ['hidden', 'Dismissed'] };
function ZeroResultsPage(_: PageProps) {
  const canFix = can(Session.role(), 'search', 'publish');
  const [load, retry] = useLoad(() => ZeroResultService.list());
  const fix = async (z: ZeroResult, syn: boolean) => {
    const recId = syn ? 'search-synonyms' : 'search-mappings';
    const sections: FormSection[] = syn ? [{ fields: [{ key: 'term', label: 'What patients type', required: true, max: 40 }, { key: 'to', label: 'What it means', required: true, max: 60, type: 'select', options: SPECIALTY_LIST() }] }]
      : [{ fields: [{ key: 'phrase', label: 'Patient phrase', required: true, max: 60 }, { key: 'targetType', label: 'Goes to', type: 'select', options: ['Specialty', 'Condition', 'Scope', 'Content', 'Resource', 'Location'] }, { key: 'target', label: 'Target', required: true, max: 60 }] }];
    const d = await formModal({ title: syn ? `Add a synonym for “${z.query}”` : `Add a mapping for “${z.query}”`, sections, data: syn ? { term: z.query, to: SPECIALTY_LIST()[0] } : { phrase: z.query, targetType: 'Specialty', target: '' }, confirmLabel: 'Save to draft',
      note: <p className="muted">This saves a draft of {syn ? 'Synonyms' : 'Query mappings'}. Deploy it to demo and publish it from that page.</p> });
    if (!d) return;
    try {
      const r = ConfigService.peek(recId)!, data = clone(latestData(r)); data.rows.push({ ...d, id: uid('r') });
      await ConfigService.saveDraft(recId, data, `Fix zero-result search “${z.query}”`);
      await ZeroResultService.setStatus(z.id, 'resolved');
      toast(`Saved to the ${syn ? 'Synonyms' : 'Query mappings'} draft.`, { kind: 'success', action: 'Open', onAction: () => Router.go(syn ? 'search-synonyms' : 'search-query-mappings') });
      retry();
    } catch (err) { toast((err as Error).message, { kind: 'error', ms: 8000 }); }
  };
  const dismiss = async (z: ZeroResult) => { try { await ZeroResultService.setStatus(z.id, 'dismissed'); toast(`Dismissed “${z.query}”.`); retry(); } catch (err) { toast((err as Error).message, { kind: 'error' }); } };
  return (
    <div className="page">
      <PageHead crumbs={[['Search configuration', null]]} title="Zero-result queries" badges={<Badge kind="mock" />} lede="Searches that returned nothing in the last 30 days. Add a synonym or mapping so they find something next time. The data source is pending (§10.12)." />
      <div id="zr"><Loading load={load} retry={retry} text="Loading searches">{() => (
        <section className="card"><div className="card-body" id="zr-t">
          <DataTable<ZeroResult> id="zr" caption="Zero-result queries" noun="query" rows={load.status === 'ok' ? load.data : []} defaultSort={{ key: 'count', dir: 'desc' }} searchText={z => z.query} initialFilters={{ status: 'open' }} rowKey={z => z.id}
            filters={[{ key: 'status', label: 'Status', options: [['open', 'Open'], ['resolved', 'Fixed'], ['dismissed', 'Dismissed']], match: (z, v) => z.status === v }]}
            empty={{ icon: 'task_alt', title: 'No zero-result searches', text: '' }}
            columns={[
              { key: 'query', label: 'Search', sortable: true, render: z => `“${z.query}”` },
              { key: 'count', label: 'Times searched', sortable: true, render: z => z.count.toLocaleString('en-US'), cls: 'num' },
              { key: 'lastSeen', label: 'Last seen', sortable: true, render: z => fmtDate(z.lastSeen) },
              { key: 'status', label: 'Status', render: z => <Badge kind={ZR_BADGE[z.status][0]} text={ZR_BADGE[z.status][1]} /> },
              { key: 'acts', label: 'Actions', hideLabel: true, render: z => canFix && z.status === 'open' ? <span className="row-acts">
                <Btn label="Add synonym" variant="text" data-z="syn" data-id={z.id} onClick={() => fix(z, true)} />
                <Btn label="Add mapping" variant="text" data-z="map" data-id={z.id} onClick={() => fix(z, false)} />
                <Btn label={`Dismiss “${z.query}”`} icon="close" variant="text" iconOnly data-z="dismiss" data-id={z.id} onClick={() => dismiss(z)} /></span> : null }]} />
        </div></section>)}</Loading></div>
    </div>
  );
}

export const adminPages: Record<string, Page> = {
  audit: AuditPage, 'audit-history': HistoryPage, 'platform-integrations': IntegrationsPage, 'platform-monitoring': MonitoringPage,
  'admin-settings': SettingsPage, 'audiences-rules': RulesPage, 'audiences-targeting': TargetingPage, 'search-zero-results': ZeroResultsPage
};
