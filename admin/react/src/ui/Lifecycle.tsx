/* ---------- Publishing workflow panel (Draft → Demo → Production), shared by every config editor ---------- */
/* EXTRA_GLYPHS: bolt save rate_review science undo public delete info history visibility */
import { useEffect, useState, type ReactNode } from 'react';
import { Btn, Badge, Icon, Segmented, type BtnVariant } from './kit';
import { DataTable } from './DataTable';
import { confirmDialog, openModal, ModalFrame, toast } from './overlays';
import { Form, validateData, type FormSection, type Errors } from './forms';
import { ConfigService, CONFIG_TYPES, DB, UserService, dataAt } from '../services/services';
import { Session } from '../app/session';
import { Router, Unsaved } from '../app/router';
import { ROLES, canAct, levelOf, type Area, type Action } from '../app/permissions';
import { announce, clone, fmtDateTime } from '../app/util';
import type { ConfigRecord, Data, LifecycleEvent, Version } from '../app/types';

export const ChangeList = ({ items }: { items: string[] }) => items.length
  ? <ul className="changes">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
  : <p className="muted">No differences.</p>;

/* Environment status badges for list rows */
export function EnvBadges({ r }: { r: ConfigRecord }) {
  return (
    <span className="badges">
      {r.production ? <Badge kind="production" text={`Production v${r.production}`} /> : null}
      {r.demo && r.demo !== r.production ? <Badge kind="demo" text={`Demo v${r.demo}`} /> : null}
      {r.draft ? (r.review ? <Badge kind="review" /> : r.draft.changesRequested ? <Badge kind="changes" /> : <Badge kind="draft" />) : null}
    </span>
  );
}
export const envRank = (r: ConfigRecord): string => r.draft ? 'draft' : r.demo !== r.production ? 'demo' : 'production';

/* A page with unsaved changes asks before the person leaves it */
export function useLeaveGuard(dirty: boolean, what: string) {
  useEffect(() => {
    const g = async () => {
      if (!dirty) return true;
      const r = await confirmDialog({ title: 'Leave without saving?', body: <p>Your changes to {what} aren’t saved. If you leave, they’re lost.</p>, confirmLabel: 'Leave page', variant: 'danger', cancelLabel: 'Stay on this page' });
      return r.ok;
    };
    Router.setGuard(g);
    return () => Router.clearGuard(g);
  }, [dirty, what]);
}

export type SavedKind = 'created' | 'save' | 'discardDraft' | 'review' | 'deploy' | 'changes' | 'publish' | 'rollback';
export interface LifecycleProps {
  area: Area; noun: string; rec: ConfigRecord | null; getWorking: () => Data; dirty: boolean; isNew?: boolean;
  describe: (from: Data | null, to: Data) => string[]; validate?: () => boolean; draftOnly?: boolean; title?: string;
  newSaveLabel?: string; createdMsg?: string | null; create?: (d: Data) => Promise<unknown>;
  onSaved: (rec: ConfigRecord, kind: SavedKind) => void; onDiscard: () => void; afterDelete?: () => void;
}
const focusLc = () => requestAnimationFrame(() => document.getElementById('lc-h')?.focus());

export function LifecyclePanel(o: LifecycleProps) {
  const role = Session.role()!;
  const [busy, setBusy] = useState<string | null>(null);
  const r = o.rec, d = o.dirty, isNew = !!o.isNew;
  const may = (a: Action) => canAct(role, o.area, a);
  const demoAhead = (x: ConfigRecord | null) => !!x && !!x.demo && x.demo !== x.production;
  const lastEvent = (x: ConfigRecord, env: string, version?: number | null) => [...x.events].reverse().find(e => e.environment === env && (version == null || e.version === version));
  const when = (e?: LifecycleEvent) => e ? `${fmtDateTime(e.at)} by ${UserService.name(e.by)}` : '';
  useEffect(() => { Unsaved.on = d || isNew; return () => { Unsaved.on = false; }; }, [d, isNew]);

  const hasDraft = !!(r && r.draft), draftOnly = !!o.draftOnly;
  const next = d || isNew ? 'save' : hasDraft ? (may('deployDemo') ? 'deploy' : 'review') : demoAhead(r) ? 'publish' : null;
  const v = (k: string): BtnVariant => (k === next ? 'primary' : 'secondary');
  const reason: Record<string, string> = {};
  const acts: ReactNode[] = [];
  const add = (key: string, label: string, variant: BtnVariant, ok: boolean, why: string, icon: string) => {
    acts.push(<Btn key={key} label={label} icon={icon} variant={variant} size="sm" data-lc={key} aria-disabled={ok ? undefined : true} aria-describedby={ok ? undefined : `why-${key}`}
      busy={busy === key} busyLabel={BUSY[key]} onClick={() => act(key, ok)} />);
    if (!ok) reason[key] = why;
  };
  if (!isNew && d) acts.push(<Btn key="discard" label="Discard changes" variant="text" size="sm" data-lc="discard" onClick={() => act('discard', true)} />);
  else if (hasDraft && may('saveDraft')) acts.push(<Btn key="discardDraft" label="Discard draft" variant="text" size="sm" data-lc="discardDraft" busy={busy === 'discardDraft'} busyLabel="Discarding draft" onClick={() => act('discardDraft', true)} />);
  if (r && !r.production && !r.demo && may('saveDraft')) acts.push(<Btn key="delete" label="Delete" icon="delete" variant="text" size="sm" data-lc="delete" busy={busy === 'delete'} busyLabel="Deleting" onClick={() => act('delete', true)} />);
  if (may('saveDraft')) add('save', isNew ? (o.newSaveLabel || 'Save as draft') : 'Save draft', v('save'), d || isNew, 'There are no unsaved changes to save.', 'save');
  if (!isNew && r && may('requestReview') && !may('deployDemo')) add('review', r.review ? 'Review requested' : 'Request review', v('review'), hasDraft && !d && !r.review,
    d ? 'Save the draft before you request a review.' : r.review ? 'A review is already requested for this draft.' : 'Save a draft first, then request a review.', 'rate_review');
  if (!isNew && !draftOnly && may('deployDemo')) add('deploy', 'Deploy to demo', v('deploy'), hasDraft && !d, d ? 'Save the draft first. Demo only takes saved drafts.' : 'Save a draft first. Demo only takes saved drafts.', 'science');
  if (!isNew && !draftOnly && may('requestChanges') && demoAhead(r)) acts.push(<Btn key="changes" label="Request changes" icon="undo" variant="secondary" size="sm" data-lc="changes" busy={busy === 'changes'} busyLabel="Requesting changes" onClick={() => act('changes', true)} />);
  if (!isNew && !draftOnly && may('publish') && hasDraft) add('direct', 'Publish directly', 'secondary', !d, 'Save the draft first. Only saved drafts can be published.', 'bolt');
  if (!isNew && !draftOnly && may('publish')) add('publish', 'Publish to production', v('publish'), demoAhead(r), r && r.production ? `Production v${r.production} already matches demo. Deploy a new version to demo first.` : 'Deploy to demo and check it there first.', 'public');
  const lvl = levelOf(role, o.area);
  const note = lvl === 'view' ? `You can view this ${o.noun}. Your role, ${ROLES[role].label}, can’t change it.`
    : !may('deployDemo') ? `As ${ROLES[role].label}, you can save drafts and request a review. An Admin or Super Admin deploys to demo and publishes.`
    : !may('publish') ? `As ${ROLES[role].label}, you can deploy to demo. An Admin or Super Admin publishes to production.` : '';
  const draftBadge = (saved: string) => r!.draft!.changesRequested ? <Badge kind="changes" /> : r!.review ? <Badge kind="review" /> : <Badge kind="draft" text={saved} />;
  const status = !draftOnly ? null : d || isNew ? <><Badge kind="unsaved" text={isNew ? 'New – not saved' : 'Unsaved changes'} /><span>Save a draft, then deploy it from the Publishing bar.</span></>
    : hasDraft ? <>{draftBadge('Saved draft')}<span>{when(lastEvent(r!, 'draft'))}. Deploy it with the other drafts from the Publishing bar.</span></>
    : <>{r!.production ? <Badge kind="production" text={`Production v${r!.production}`} /> : null}{demoAhead(r) ? <Badge kind="demo" text={`Demo v${r!.demo}`} /> : null}<span>No open draft. Edit below to start one.</span></>;
  /* Full mode, same row: where the newest changes are, as three tags */
  const chips = <>{d || isNew ? <Badge kind="unsaved" text={isNew ? 'New – not saved' : 'Unsaved changes'} /> : hasDraft ? draftBadge('Saved draft') : <span className="muted">No open draft</span>}{' '}
    {r && r.demo ? <Badge kind="demo" text={`Demo v${r.demo}`} /> : null}{r && r.production ? <Badge kind="production" text={`Production v${r.production}`} /> : <span className="muted">Not published</span>}</>;

  async function act(key: string, ok: boolean) {
    if (!ok) { toast(reason[key]); return; }
    const run = async (fn: () => Promise<unknown>, msg: string, kind: SavedKind) => {
      setBusy(key);
      try { const rec = await fn(); setBusy(null); o.onSaved(rec as ConfigRecord, kind); toast(msg, { kind: 'success' }); announce(msg); if (kind !== 'created') focusLc(); }
      catch (err) { setBusy(null); toast((err as Error).message, { kind: 'error', ms: 8000 }); }
    };
    const needComment = !!DB.db.settings.requirePublishComment;
    const pubComment = { label: 'Comment', required: needComment, hint: needComment ? 'Required by Administrative settings.' : 'Optional. Shown in the change history.' };
    if (key === 'save') {
      if (o.validate && !o.validate()) { toast('Fix the highlighted fields, then save again.', { kind: 'error' }); return; }
      if (isNew) return run(() => o.create!(o.getWorking()), o.createdMsg || `Draft saved. The ${o.noun} isn’t on demo or production yet.`, 'created');
      return run(() => ConfigService.saveDraft(r!.id, o.getWorking(), ''), 'Draft saved. It isn’t on demo or production yet.', 'save');
    }
    if (!r) return;
    if (key === 'discard') {
      const base = r.draft ? r.draft.data : dataAt(r, 'production') || dataAt(r, 'demo');
      const c = await confirmDialog({ title: 'Discard unsaved changes?', body: <><p>The editor goes back to {r.draft ? 'your saved draft' : `production v${r.production}`}. These changes are lost:</p><ChangeList items={o.describe(base, o.getWorking())} /></>, confirmLabel: 'Discard changes', variant: 'danger', cancelLabel: 'Keep editing' });
      if (c.ok) { o.onDiscard(); announce('Changes discarded'); focusLc(); }
      return;
    }
    if (key === 'discardDraft') {
      const c = await confirmDialog({ title: 'Discard the saved draft?', body: <p>The draft is deleted{r.production ? ` and the editor goes back to production v${r.production}` : ''}. Demo and production don’t change.</p>, confirmLabel: 'Discard draft', variant: 'danger' });
      if (c.ok) run(() => ConfigService.discardDraft(r.id), 'Draft discarded.', 'discardDraft');
      return;
    }
    if (key === 'delete') {
      const c = await confirmDialog({ title: `Delete this ${o.noun}?`, body: <p>“{r.name}” has never been published, so it’s deleted for good. The audit log keeps a record.</p>, confirmLabel: `Delete ${o.noun}`, variant: 'danger' });
      if (!c.ok) return;
      setBusy('delete');
      try { await ConfigService.remove(r.id); toast(`Deleted “${r.name}”.`, { kind: 'success' }); o.afterDelete && o.afterDelete(); }
      catch (err) { setBusy(null); toast((err as Error).message, { kind: 'error', ms: 8000 }); }
      return;
    }
    if (key === 'review') {
      const c = await confirmDialog({ title: 'Request a review?', body: <p>An Admin or Super Admin checks the draft and deploys it to demo. The request shows on their Dashboard.</p>, confirmLabel: 'Request review', comment: { label: 'Note for the reviewer', hint: 'Optional' } });
      if (c.ok) run(() => ConfigService.requestReview(r.id, c.comment), 'Review requested.', 'review');
      return;
    }
    if (key === 'deploy') {
      const c = await confirmDialog({ title: `Deploy to demo as v${r.nextVersion}?`, wide: true,
        body: <><p>The saved draft becomes version {r.nextVersion} in the demo environment, for checking on demo devices. {r.production ? `Production stays on v${r.production}, so patients see no change.` : 'Nothing is in production yet.'}</p>
          <h3 className="sub-h">Changes from {r.demo ? `demo v${r.demo}` : 'empty'}</h3><ChangeList items={o.describe(dataAt(r, 'demo'), r.draft!.data)} /></>,
        confirmLabel: 'Deploy to demo', comment: { label: 'Comment', hint: 'Optional. Shown in the change history.', value: r.draft!.comment || '' } });
      if (c.ok) run(() => ConfigService.deployToDemo(r.id, c.comment), `Deployed to demo as v${r.nextVersion}. Production is unchanged.`, 'deploy');
      return;
    }
    if (key === 'changes') {
      const c = await confirmDialog({ title: `Request changes to demo v${r.demo}?`, body: <p>The demo version goes back to a draft with your comment, so it can be fixed and deployed again. Production doesn’t change.</p>, confirmLabel: 'Request changes', comment: { label: 'What needs to change', required: true } });
      if (c.ok) run(() => ConfigService.requestChanges(r.id, c.comment), 'Changes requested. The demo version is back in draft.', 'changes');
      return;
    }
    if (key === 'direct') {
      const c = await confirmDialog({ title: `Publish the draft directly as v${r.nextVersion}?`, wide: true,
        body: <><div className="warn-box"><Icon name="bolt" size={20} /><p>This skips demo: the draft goes straight to production, where patients see it, without a check on test devices. In this prototype, publishing is simulated.</p></div>
          <h3 className="sub-h">Changes from {r.production ? `production v${r.production}` : 'nothing published'}</h3><ChangeList items={o.describe(dataAt(r, 'production'), r.draft!.data)} /></>,
        confirmLabel: 'Publish directly', variant: 'danger', comment: pubComment });
      if (c.ok) run(() => ConfigService.publishDirect(r.id, c.comment), `Published the draft directly to production as v${r.nextVersion}.`, 'publish');
      return;
    }
    if (key === 'publish') {
      const c = await confirmDialog({ title: `Publish v${r.demo} to production?`, wide: true,
        body: <><div className="warn-box"><Icon name="public" size={20} /><p>Production is what patients see in the MyCare app. In this prototype, publishing is simulated.</p></div>
          <h3 className="sub-h">Changes from {r.production ? `production v${r.production}` : 'nothing published'}</h3><ChangeList items={o.describe(dataAt(r, 'production'), r.versions[r.demo!].data)} />
          {(r.draft || o.dirty) && <p className="muted">Your open draft isn’t included. Only the version checked on demo is published.</p>}</>,
        confirmLabel: `Publish v${r.demo}`, comment: pubComment });
      if (c.ok) run(() => ConfigService.publish(r.id, c.comment), `Published v${r.demo} to production.`, 'publish');
    }
  }
  return (
    <>
      <div className="lc-row"><h2 id="lc-h" className="lc-row-h" tabIndex={-1}>{draftOnly ? 'Draft' : (o.title || 'Publishing')}</h2>
        <p className="lc-status">{draftOnly ? status : chips}</p>{acts.length > 0 && <div className="lc-actions">{acts}</div>}</div>
      {Object.entries(reason).map(([k, t]) => <span key={k} className="vh" id={`why-${k}`}>{t}</span>)}
      {note && <p className="role-note"><Icon name="info" size={20} /><span>{note} Permissions are proposed, pending confirmation.</span></p>}
    </>
  );
}
const BUSY: Record<string, string> = { save: 'Saving draft', review: 'Requesting review', deploy: 'Deploying to demo', direct: 'Publishing', publish: 'Publishing' };

/* ---------- Change history: versions and events, with rollback where the type supports it ---------- */
export function HistoryCard({ rec, describe, onSaved, hostId = 'hist' }: { rec: ConfigRecord; describe: (a: Data | null, b: Data) => string[]; onSaved: (rec: ConfigRecord) => void; hostId?: string }) {
  const [view, setView] = useState<'versions' | 'events'>('versions');
  const [busyV, setBusyV] = useState<number | null>(null);
  const type = CONFIG_TYPES[rec.type];
  const canRb = type.supportsRollback && canAct(Session.role(), type.area, 'rollback');
  const rollback = async (version: number, fromRow: boolean) => {
    const r = rec;
    const c = await confirmDialog({ title: `Roll back to v${version}?`, wide: true,
      body: <><p>This creates version {r.nextVersion} with the contents of v{version} and puts it on demo and production. Production v{r.production} stays in the history.</p>
        <h3 className="sub-h">Changes from production v{r.production}</h3><ChangeList items={describe(dataAt(r, 'production'), r.versions[version].data)} /></>,
      confirmLabel: `Roll back to v${version}`, variant: 'danger', comment: { label: 'Reason for the rollback', required: true } });
    if (!c.ok) return;
    if (fromRow) setBusyV(version);
    try {
      const out = await ConfigService.rollback(r.id, version, c.comment); setBusyV(null); onSaved(out);
      toast(`Rolled back. Production is now v${out.production}, a copy of v${version}.`, { kind: 'success' });
      requestAnimationFrame(() => document.getElementById(`${hostId}-h`)?.focus());
    } catch (err) { setBusyV(null); toast((err as Error).message, { kind: 'error', ms: 8000 }); }
  };
  /* Versions: every saved version, where it is now, what it changes, and a way back to it */
  const where = (v: number) => <>{rec.production === v ? <Badge kind="production" text="In production" /> : null}{rec.demo === v && rec.demo !== rec.production ? <Badge kind="demo" text="On demo" /> : null}
    {rec.versions[v].rollbackOf ? <Badge kind="pending" text={`Copy of v${rec.versions[v].rollbackOf}`} /> : null}</>;
  const hasWhere = (v: number) => rec.production === v || (rec.demo === v && rec.demo !== rec.production) || !!rec.versions[v].rollbackOf;
  const viewVersion = (v: number) => {
    const ver = rec.versions[v], ok = canRb && v !== rec.production;
    openModal({ wide: true, render: ({ close }) => (
      <ModalFrame title={`Version ${v}`} close={close}
        actions={<><Btn label="Close" variant="text" data-close="" onClick={close} />{ok && <Btn label={`Roll back to v${v}`} icon="history" variant="danger" data-vrb={v} onClick={() => { close(); rollback(v, false); }} />}</>}>
        <dl className="facts cols"><dt>Saved</dt><dd>{fmtDateTime(ver.updatedAt)} by {UserService.name(ver.updatedBy)}</dd><dt>Comment</dt><dd>{ver.comment || <span className="muted">None</span>}</dd>
          <dt>Where</dt><dd>{hasWhere(v) ? where(v) : <span className="muted">Not on demo or production</span>}</dd></dl>
        <h3 className="sub-h">{v === rec.production ? 'This is the version in production' : `Compared with production v${rec.production}`}</h3>
        {v === rec.production ? null : <ChangeList items={describe(dataAt(rec, 'production'), ver.data)} />}
      </ModalFrame>) });
  };
  return (
    <section className="card" aria-labelledby={`${hostId}-h`}>
      <div className="card-head"><h2 id={`${hostId}-h`} tabIndex={-1}>History</h2>
        <div className="card-actions"><Segmented id={`${hostId}-view`} label="Show" options={[['versions', 'Versions'], ['events', 'Change history']]} value={view} onChange={setView} /></div></div>
      <div className="card-body">
        <div id={`${hostId}-v`} hidden={view !== 'versions'}>
          <DataTable<Version> id={`${hostId}v`} caption="Versions" noun="version" searchPlaceholder="Search versions and comments"
            rows={Object.values(rec.versions)} defaultSort={{ key: 'version', dir: 'desc' }} rowKey={x => String(x.version)}
            searchText={x => `v${x.version} ${x.comment || ''} ${UserService.name(x.updatedBy)}`}
            empty={{ icon: 'history', title: 'No versions yet', text: 'A version is made each time a draft goes to demo.' }}
            columns={[
              { key: 'version', label: 'Version', sortable: true, render: x => <span className="ord-chip">v{x.version}</span>, cls: 'ord' },
              { key: 'saved', label: 'Saved', sortable: true, sortValue: x => x.updatedAt, render: x => <span className="nowrap">{fmtDateTime(x.updatedAt)}</span> },
              { key: 'by', label: 'By', render: x => UserService.name(x.updatedBy) },
              { key: 'comment', label: 'Comment', render: x => x.comment || <span className="muted">None</span>, cls: 'wrap' },
              { key: 'where', label: 'Where', render: x => <span className="badges">{where(x.version)}</span> },
              { key: 'acts', label: 'Actions', hideLabel: true, render: x => <span className="row-acts">
                <Btn label="View" icon="visibility" variant="text" size="sm" data-vview={x.version} aria-label={`View version ${x.version}`} onClick={() => viewVersion(x.version)} />
                {canRb && x.version !== rec.production && <Btn label="Roll back" icon="history" variant="text" size="sm" data-rollback={x.version} aria-label={`Roll back to version ${x.version}`} busy={busyV === x.version} busyLabel="Rolling back" onClick={() => rollback(x.version, true)} />}</span> }
            ]} />
        </div>
        <div id={hostId} hidden={view !== 'events'}>
          <DataTable<LifecycleEvent> id={hostId} caption="Change history" noun="change" searchPlaceholder="Search events, people and comments"
            rows={rec.events} defaultSort={{ key: 'at', dir: 'desc' }} rowKey={e => e.id}
            searchText={e => `${e.action} ${UserService.name(e.by)} ${e.comment} v${e.version || ''}`}
            filters={[
              { key: 'env', label: 'Environment', options: [['draft', 'Draft'], ['demo', 'Demo'], ['production', 'Production']], match: (e, x) => e.environment === x },
              { key: 'by', label: 'Changed by', options: DB.db.users.map(u => [u.id, `${u.first} ${u.last}`] as [string, string]), match: (e, x) => e.by === x }
            ]}
            empty={{ icon: 'history', title: 'No changes yet', text: 'Saved drafts, deployments and publications appear here.' }}
            columns={[
              { key: 'at', label: 'When', sortable: true, render: e => <span className="nowrap">{fmtDateTime(e.at)}</span> },
              { key: 'action', label: 'Event', sortable: true, render: e => e.action },
              { key: 'environment', label: 'Environment', render: e => <Badge kind={e.environment} /> },
              { key: 'version', label: 'Version', sortable: true, sortValue: e => e.version || 0, render: e => e.version ? `v${e.version}` : <span className="muted">–</span>, cls: 'num' },
              { key: 'by', label: 'By', render: e => UserService.name(e.by) },
              { key: 'comment', label: 'Comment', render: e => e.comment || <span className="muted">None</span>, cls: 'wrap' },
              { key: 'acts', label: 'Actions', hideLabel: true, render: e => canRb && e.environment === 'production' && e.version && e.version !== rec.production && rec.versions[e.version]
                ? <Btn label={`Roll back to v${e.version}`} icon="history" variant="text" data-rollback={e.version} busy={busyV === e.version} busyLabel="Rolling back" onClick={() => rollback(e.version!, true)} /> : null }
            ]} />
        </div>
      </div>
    </section>
  );
}

/* ---------- Modal form: resolves the edited data, or null when cancelled ---------- */
function FormModalBody({ title, sections, data, validate, confirmLabel, note, close, resolve }: {
  title: string; sections: FormSection[]; data: Data; validate?: (d: Data) => Errors; confirmLabel: string; note?: ReactNode; close: () => void; resolve: (d: Data) => void }) {
  const [d, setD] = useState<Data>(() => clone(data));
  const [errors, setErrors] = useState<Errors>({});
  useEffect(() => { document.querySelector<HTMLElement>('dialog[open] #mf input:not([type=hidden]), dialog[open] #mf .dd-btn, dialog[open] #mf textarea')?.focus(); }, []);
  const fs = sections.flatMap(s => s.fields);
  const submit = () => {
    const errs = validateData(fs, d, validate);
    setErrors(errs);
    if (Object.keys(errs).length) { requestAnimationFrame(() => document.getElementById('m-errsum')?.focus()); return; }
    resolve(d); close();
  };
  return (
    <ModalFrame title={title} close={close} onSubmit={submit}
      actions={<><Btn label="Cancel" variant="text" data-close="" onClick={close} /><Btn label={confirmLabel} variant="primary" type="submit" /></>}>
      {note}<div id="mf"><Form sections={sections} data={d} errors={errors} prefix="m" onChange={setD} /></div>
    </ModalFrame>
  );
}
export function formModal({ title, sections, data, validate, confirmLabel = 'Save', note }: { title: string; sections: FormSection[]; data: Data; validate?: (d: Data) => Errors; confirmLabel?: string; note?: ReactNode }): Promise<Data | null> {
  return new Promise(resolve => {
    let done = false;
    openModal({ wide: true, onClose: () => { if (!done) resolve(null); },
      render: ({ close }) => <FormModalBody title={title} sections={sections} data={data} validate={validate} confirmLabel={confirmLabel} note={note} close={close} resolve={x => { done = true; resolve(x); }} /> });
  });
}
