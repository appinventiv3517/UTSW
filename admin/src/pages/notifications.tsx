/* ---------- Notifications: list, create and edit, details ----------
   Lifecycle: Draft → Scheduled (or Sent when immediate) → Sent; Cancel while scheduled.
   Admins and Super Admins schedule or send; cancel and edit rules are pending UTSW confirmation (§10.14). Sending is simulated. */
/* EXTRA_GLYPHS: add edit_note schedule send save cancel content_copy delete info lock visibility history notifications */
import { useState, type ReactNode } from 'react';
import type { Page, PageProps } from '../app/App';
import { PageHead } from '../app/Shell';
import { Router } from '../app/router';
import { Session } from '../app/session';
import { can } from '../app/permissions';
import { useLoad } from '../app/useLoad';
import { NOTE_STATUS, NotificationService, UserService } from '../services/services';
import { ART } from '../mock/seed';
import { Badge, Btn, ErrorState, Icon, LoadingState } from '../ui/kit';
import { DataTable } from '../ui/DataTable';
import { Form, validateData, describeData, segmentName, segmentOptions, type FormSection, type Errors } from '../ui/forms';
import { ChangeList, useLeaveGuard } from '../ui/Lifecycle';
import { PreviewCard, appContent, layoutFor } from '../ui/preview';
import { confirmDialog, openModal, ModalFrame, toast } from '../ui/overlays';
import { fieldsOf, focusSoon, keepErrors } from './collection';
import { clone, fmtDate, fmtDateTime, fmtLocal, nowLocal, same } from '../app/util';
import type { Data, Notification, NoteVersion } from '../app/types';

const NOTE_BADGE = { draft: 'draft', scheduled: 'demo', sent: 'live', cancelled: 'hidden' };
const NoteBadge = ({ s }: { s: Notification['status'] }) => <Badge kind={NOTE_BADGE[s]} text={NOTE_STATUS[s]} />;
const NOTE_SECTIONS: FormSection[] = [
  { title: 'Message', fields: [
    { key: 'title', label: 'Notification title', required: true, max: 50 },
    { key: 'description', label: 'Notification description', type: 'textarea', required: true, max: 178, hint: 'Push messages are cut off after about 178 characters.' },
    { key: 'image', label: 'Image', type: 'image', hint: 'Shown in rich push and the Inbox. Sample images only.' },
    { key: 'imageAlt', label: 'Image alternative text', required: true, max: 120, show: d => d.image && d.image !== 'none' },
    { key: 'videoUrl', label: 'Video URL', type: 'text', placeholder: 'https://', hint: 'Optional. Allowed video hosts are pending (§10.14).' },
    { key: 'destination', label: 'Opens', type: 'destination', hint: 'Where the app goes when the notification is tapped.' }] },
  { title: 'Delivery', fields: [
    { key: 'sendTo', label: 'Send to', type: 'segment' },
    { key: 'timing', label: 'Send', type: 'radio', options: [['now', 'Instant'], ['scheduled', 'Scheduled']] },
    { key: 'scheduledAt', label: 'Send on (Central Time)', type: 'datetime', required: true, show: d => d.timing === 'scheduled' }] }
];
const noteFields = fieldsOf(NOTE_SECTIONS);
const noteValidate = (d: Data): Errors => (d.timing === 'scheduled' && d.scheduledAt && d.scheduledAt <= nowLocal() ? { scheduledAt: 'Choose a time in the future.' } : {});
const noteData = (n: Notification): Data => Object.fromEntries(noteFields.map(f => [f.key, clone((n as unknown as Data)[f.key])]).concat([['timing', n.timing]]));
const crumbs: [string, string | null][] = [['Notifications', null], ['All notifications', 'notifications']];

function NotificationsPage(_: PageProps) {
  const canEdit = can(Session.role(), 'notifications', 'draft');
  const [load, retry] = useLoad(() => NotificationService.list());
  const list = load.status === 'ok' ? load.data : [];
  const c = (k: string) => list.filter(n => n.status === k).length;
  return (
    <div className="page">
      <PageHead crumbs={[['Notifications', null]]} title="All notifications" lede="Push and Inbox messages to app users. Sending is simulated; no push provider is connected."
        actions={canEdit ? <a className="btn btn-primary" href="#notifications-new"><Icon name="add" size={20} /><span className="lbl">Create notification</span></a> : null} />
      <div id="nt-body">
        {load.status === 'loading' ? <LoadingState text="Loading notifications" /> : load.status === 'error' ? <ErrorState msg={load.error} onRetry={retry} /> : <>
          <div className="stat-strip">
            <div className="stat"><Icon name="edit_note" size={20} /><span><b>{c('draft')}</b> {c('draft') === 1 ? 'draft' : 'drafts'}</span></div>
            <div className="stat"><Icon name="schedule" size={20} /><span><b>{c('scheduled')}</b> scheduled</span></div>
            <div className="stat"><Icon name="send" size={20} /><span><b>{c('sent')}</b> sent</span></div></div>
          <section className="card"><div className="card-body" id="nt-table">
            <DataTable<Notification> id="nt" caption="Notifications" noun="notification" rows={list} defaultSort={{ key: 'created', dir: 'desc' }} searchPlaceholder="Search titles and messages" rowKey={n => n.id}
              searchText={n => `${n.title} ${n.description}`}
              filters={[
                { key: 'status', label: 'Status', options: Object.entries(NOTE_STATUS), match: (n, v) => n.status === v },
                { key: 'aud', label: 'Audience', options: segmentOptions(), match: (n, v) => n.sendTo === v }]}
              empty={{ icon: 'notifications', title: 'No notifications yet', text: canEdit ? 'Create the first one.' : '' }}
              columns={[
                { key: 'title', label: 'Title', sortable: true, sortValue: n => n.title.toLowerCase(), render: n => <a className="row-link" href={`#notifications-${n.id}`}>{n.title}</a> },
                { key: 'sendTo', label: 'Audience', render: n => segmentName(n.sendTo) },
                { key: 'when', label: 'Scheduled', sortable: true, sortValue: n => n.scheduledAt || '', render: n => n.timing === 'now' && !n.sentAt ? 'Instant' : <span className="nowrap">{fmtLocal(n.scheduledAt)}</span> },
                { key: 'created', label: 'Created', sortable: true, sortValue: n => n.createdAt, render: n => <span className="nowrap">{fmtDate(n.createdAt)}</span> },
                { key: 'status', label: 'Status', sortable: true, sortValue: n => n.status, render: n => <NoteBadge s={n.status} /> }]} />
          </div></section>
        </>}
      </div>
    </div>
  );
}

function NoteEditor({ route, params }: PageProps) {
  const isNew = route.pattern === 'notifications-new';
  const [load, retry] = useLoad(() => isNew ? Promise.resolve(null) : NotificationService.get(params.id!));
  if (load.status === 'loading') return <div className="page" id="ne"><LoadingState text="Loading the notification" /></div>;
  if (load.status === 'error') return <div className="page" id="ne"><PageHead crumbs={crumbs} title="Notification not found" /><ErrorState msg={load.error} onRetry={retry} /></div>;
  return <NoteBody n={load.data} isNew={isNew} />;
}
const BLANK: Data = { title: '', description: '', sendTo: 'seg-all', timing: 'scheduled', scheduledAt: '', image: 'none', imageAlt: '', videoUrl: '', destination: { type: 'none', value: '' } };
function NoteBody({ n, isNew }: { n: Notification | null; isNew: boolean }) {
  const role = Session.role()!;
  const [working, setWorking] = useState<Data>(() => n ? noteData(n) : clone(BLANK));
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState<string | null>(null);
  const editable = can(role, 'notifications', 'draft') && (!n || n.status === 'draft');
  const dirty = !same(working, n ? noteData(n) : BLANK);
  const title = working.title || 'Create notification';
  const may = (l: 'draft' | 'publish') => can(role, 'notifications', l);
  useLeaveGuard(dirty && editable, 'this notification', { title: 'Leave without saving?', body: 'Your changes to this notification aren’t saved.' });
  const set = (d: Data) => { setWorking(d); if (Object.keys(errors).length) setErrors(e => keepErrors(e, validateData(noteFields, d, noteValidate))); };
  const reload = (msg: string, go?: string | null) => { Router.clearGuard(); toast(msg, { kind: 'success' }); if (go) Router.go(go); else Router.refresh(); };
  const run = async (k: string, fn: () => Promise<Notification>, msg: string | ((r: Notification) => string), go?: string | null | ((r: Notification) => string | null)) => {
    setBusy(k);
    try { const r = await fn(); reload(typeof msg === 'function' ? msg(r) : msg, typeof go === 'function' ? go(r) : go); }
    catch (err) { setBusy(null); toast((err as Error).message, { kind: 'error', ms: 8000 }); }
  };
  const act = async (k: string) => {
    if (k === 'save') {
      const errs = validateData(noteFields, working, noteValidate); setErrors(errs);
      if (Object.keys(errs).length) { focusSoon('f-errsum'); return; }
      return run(k, () => NotificationService.save(n && n.id, working) as Promise<Notification>, may('publish') ? 'Saved as a draft. Schedule it when it’s ready.' : 'Saved as a draft.', r => isNew ? `notifications-${r.id}` : null);
    }
    if (!n) return;
    if (k === 'schedule') {
      const c = await confirmDialog({ title: n.timing === 'now' ? 'Send this notification now?' : 'Schedule this notification?',
        body: <div className="warn-box"><Icon name="notifications" size={20} /><p>{n.timing === 'now' ? 'It goes out now' : `It goes out on ${fmtLocal(n.scheduledAt)}`} to <b>{segmentName(n.sendTo)}</b> as a push notification and an Inbox message. Sending is simulated in the prototype.</p></div>,
        confirmLabel: n.timing === 'now' ? 'Send now' : 'Schedule', comment: { label: 'Comment', hint: 'Optional' } });
      if (c.ok) run(k, () => NotificationService.schedule(n.id, c.comment), r => r.status === 'sent' ? 'Sent (simulated).' : `Scheduled for ${fmtLocal(r.scheduledAt)}.`);
    }
    if (k === 'cancel') { const c = await confirmDialog({ title: 'Cancel this notification?', body: <p>It won’t be sent. You can duplicate it later to send a new version.</p>, confirmLabel: 'Cancel notification', variant: 'danger', cancelLabel: 'Keep it', comment: { label: 'Reason', required: true } }); if (c.ok) run(k, () => NotificationService.cancel(n.id, c.comment), 'Notification cancelled.'); }
    if (k === 'dup') run(k, () => NotificationService.duplicate(n.id), 'Duplicated as a new draft.', r => `notifications-${r.id}`);
    if (k === 'del') { const c = await confirmDialog({ title: 'Delete this notification?', body: <p>“{n.title}” is deleted for good. The audit log keeps a record.</p>, confirmLabel: 'Delete', variant: 'danger' }); if (c.ok) run(k, () => NotificationService.remove(n.id) as unknown as Promise<Notification>, 'Notification deleted.', 'notifications'); }
  };
  const s = n ? n.status : 'new';
  const acts: ReactNode[] = [];
  const A = (k: string, label: string, icon: string, variant: 'primary' | 'secondary' | 'text', busyLabel: string) => acts.push(<Btn key={k} label={label} icon={icon} variant={variant} size="sm" data-n={k} busy={busy === k} busyLabel={busyLabel} onClick={() => act(k)} />);
  if (editable && (dirty || isNew)) A('save', isNew ? 'Save as draft' : 'Save changes', 'save', 'primary', 'Saving');
  if (s === 'draft' && !dirty && may('publish')) A('schedule', working.timing === 'now' ? 'Send now' : 'Schedule', working.timing === 'now' ? 'send' : 'schedule', 'primary', working.timing === 'now' ? 'Sending' : 'Scheduling');
  if (s === 'scheduled' && may('publish')) A('cancel', 'Cancel notification', 'cancel', 'secondary', 'Cancelling');
  if (n && may('draft')) A('dup', 'Duplicate', 'content_copy', 'text', 'Duplicating');
  if (n && ['draft', 'cancelled'].includes(s) && may('draft')) A('del', 'Delete', 'delete', 'text', 'Deleting');
  const note = s === 'draft' && may('draft') && !may('publish') ? 'An Admin or Super Admin schedules or sends drafts. Who can send is pending confirmation.' : '';
  const when = n && n.status === 'sent' && n.sentAt ? `Sent ${fmtDateTime(n.sentAt)}` : n && n.status === 'scheduled' ? `Sends ${fmtLocal(n.scheduledAt)}` : n && n.status === 'cancelled' ? 'Won’t be sent'
    : dirty || isNew ? 'Save it, then schedule or send it.' : working.timing === 'now' ? 'Sends when you choose Send now.' : working.scheduledAt ? `Set for ${fmtLocal(working.scheduledAt)}` : 'Choose a send time.';
  const secs = NOTE_SECTIONS.map(x => ({ ...x, fields: x.fields.map(f => editable ? f : { ...f, readonly: true }) }));
  return (
    <div className="page" id="ne">
      <PageHead crumbs={crumbs} title={title} badges={<span id="ne-b">{n ? <NoteBadge s={n.status} /> : <Badge kind="unsaved" text="New" />}{n && dirty && <Badge kind="unsaved" />}</span>} />
      <section className="card lc lc-slim" aria-labelledby="lc-h"><div className="card-body" id="ne-lc">
        <div className="lc-row"><h2 id="lc-h" className="lc-row-h" tabIndex={-1}>Status</h2>
          <p className="lc-status">{n ? <NoteBadge s={n.status} /> : <Badge kind="unsaved" text="New – not saved" />}{n && dirty && <Badge kind="unsaved" />}<span>{when}</span><span className="muted">· Sending is simulated</span></p>
          <div className="lc-actions">{acts}</div></div>
        {note && <p className="role-note"><Icon name="info" size={20} /><span>{note}</span></p>}
      </div></section>
      {n && n.stats && <section className="card" aria-labelledby="res-h"><div className="card-head"><h2 id="res-h">Results</h2><div className="card-actions"><Badge kind="mock" /></div></div><div className="card-body"><div className="metric-row">
        {([['Delivered', n.stats.delivered, null], ['Opened', n.stats.opened, n.stats.delivered], ['Took action', n.stats.actions, n.stats.delivered]] as [string, number, number | null][]).map(([l, v, of]) => (
          <div key={l} className="metric"><p className="metric-l">{l}</p><p className="metric-v">{v.toLocaleString('en-US')}</p><p className="metric-c">{of ? `${(v / of * 100).toFixed(1)}% of delivered` : n.sentAt ? `Sent ${fmtDateTime(n.sentAt)}` : ''}</p></div>))}
      </div></div></section>}
      <div className="ed-grid">
        <section className="card" aria-labelledby="form-h"><div className="card-head"><h2 id="form-h">Notification</h2>{!editable && <div className="card-actions"><Badge kind="fixed" text="Locked" /></div>}</div>
          {!editable && n && <p className="note-line in-card"><Icon name="lock" size={20} /><span>{may('draft') ? `${NOTE_STATUS[n.status]} notifications can’t be edited. Duplicate it to send a new version.` : 'Your role can view notifications only.'}</span></p>}
          <form className="card-body form" id="ne-form" noValidate onSubmit={e => e.preventDefault()}><Form sections={secs} data={working} errors={errors} prefix="f" onChange={set} /></form></section>
        <PreviewCard id="ne-pv" title="Mobile preview of the notification" sources={[['working', 'Lock screen', <Badge kind="draft" text="Push notification" />]]}
          payload={() => ({ screen: 'push', layout: layoutFor('guest'), content: { ...appContent(), push: { title: working.title, body: working.description, art: working.image !== 'none' ? ART[working.image as keyof typeof ART] : null, delivery: 'push+inbox',
            when: working.timing === 'scheduled' && working.scheduledAt ? fmtLocal(working.scheduledAt).replace(/, \d{4},.*$/, '') : 'Thursday, Oct. 30' } }, label: 'notification preview' })} />
      </div>
      {n && <Versions n={n} reload={reload} />}
    </div>
  );
}

function Versions({ n, reload }: { n: Notification; reload: (msg: string, go?: string | null) => void }) {
  const canD = can(Session.role(), 'notifications', 'draft');
  const [busy, setBusy] = useState<number | null>(null);
  const versions = n.versions || [];
  const view = (v: NoteVersion) => {
    const cur = versions[versions.length - 1];
    openModal({ wide: true, render: ({ close }) => (
      <ModalFrame title={`Version ${v.version}`} close={close} actions={<Btn label="Close" variant="text" data-close="" onClick={close} />}>
        <dl className="facts cols"><dt>Saved</dt><dd>{fmtDateTime(v.at)} by {UserService.name(v.by)}</dd><dt>Title</dt><dd>{v.data.title}</dd><dt>Description</dt><dd>{v.data.description}</dd>
          <dt>Send</dt><dd>{v.data.timing === 'now' ? 'Instant' : fmtLocal(v.data.scheduledAt)}</dd><dt>Audience</dt><dd>{segmentName(v.data.sendTo)}</dd></dl>
        <h3 className="sub-h">{v === cur ? 'This is the current version' : `Compared with the current version (v${cur.version})`}</h3>{v === cur ? null : <ChangeList items={describeData(cur.data, v.data, noteFields)} />}
      </ModalFrame>) });
  };
  const restore = async (ver: number) => {
    const asDraft = n.status === 'draft';
    const c = await confirmDialog({ title: asDraft ? `Restore version ${ver}?` : `Use version ${ver} as a new draft?`,
      body: <p>{asDraft ? `The draft goes back to the message and delivery settings of version ${ver}. That becomes version ${versions.length + 1}; nothing is lost.` : `“${n.title}” is ${NOTE_STATUS[n.status].toLowerCase()} and can’t change, so version ${ver} comes back as a new draft you can edit and schedule.`}</p>,
      confirmLabel: asDraft ? 'Restore' : 'Create draft' });
    if (!c.ok) return;
    setBusy(ver);
    try { const r = await NotificationService.restore(n.id, ver); reload(asDraft ? `Version ${ver} restored.` : 'New draft created from that version.', asDraft ? null : `notifications-${r.id}`); }
    catch (err) { setBusy(null); toast((err as Error).message, { kind: 'error', ms: 8000 }); }
  };
  return (
    <section className="card" aria-labelledby="nv-h"><div className="card-head"><h2 id="nv-h" tabIndex={-1}>Versions</h2></div><div className="card-body" id="ne-ver">
      <DataTable<NoteVersion> id="nv" caption="Notification versions" noun="version" rows={versions} defaultSort={{ key: 'v', dir: 'desc' }} rowKey={v => String(v.version)}
        searchText={v => `v${v.version} ${v.comment} ${UserService.name(v.by)}`} empty={{ icon: 'history', title: 'No versions yet' }}
        columns={[
          { key: 'v', label: 'Version', sortable: true, sortValue: v => v.version, render: v => <><span className="ord-chip">v{v.version}</span>{v.version === versions.length && <> <span className="muted small">Current</span></>}</>, cls: 'ord' },
          { key: 'at', label: 'Saved', sortable: true, render: v => <span className="nowrap">{fmtDateTime(v.at)}</span> },
          { key: 'by', label: 'By', render: v => UserService.name(v.by) },
          { key: 'comment', label: 'Comment', render: v => v.comment || '', cls: 'wrap' },
          { key: 'acts', label: 'Actions', hideLabel: true, render: v => <span className="row-acts">
            <Btn label="View" icon="visibility" variant="text" size="sm" data-nview={v.version} aria-label={`View version ${v.version}`} onClick={() => view(v)} />
            {canD && v.version !== versions.length && <Btn label={n.status === 'draft' ? 'Restore' : 'Use as new draft'} icon={n.status === 'draft' ? 'history' : 'content_copy'} variant="text" size="sm" data-nrestore={v.version}
              aria-label={`${n.status === 'draft' ? 'Restore' : 'Use as a new draft:'} version ${v.version}`} busy={busy === v.version} busyLabel="Restoring" onClick={() => restore(v.version)} />}</span> }]} />
    </div></section>
  );
}

export const notificationPages: Record<string, Page> = { notifications: NotificationsPage, 'notifications-new': NoteEditor, 'notifications-:id': NoteEditor };
