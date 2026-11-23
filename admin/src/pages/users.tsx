/* ---------- Admin management (admin users): list, create, details ----------
   Invitations are simulated: a new user would get an email link to set their own password. */
/* EXTRA_GLYPHS: person_add info group send how_to_reg person_off delete save */
import { useState } from 'react';
import type { Page, PageProps } from '../app/App';
import { PageHead, initials } from '../app/Shell';
import { Router } from '../app/router';
import { Session } from '../app/session';
import { ROLES, can, type Role } from '../app/permissions';
import { useLoad } from '../app/useLoad';
import { DB, UserService } from '../services/services';
import { Badge, Btn, ErrorState, Icon, LoadingState } from '../ui/kit';
import { DataTable } from '../ui/DataTable';
import { Form, validateData, type FieldDef, type Errors } from '../ui/forms';
import { useLeaveGuard } from '../ui/Lifecycle';
import { confirmDialog, toast } from '../ui/overlays';
import { focusSoon } from './collection';
import { fmtDate, fmtDateTime } from '../app/util';
import type { Data, User } from '../app/types';

const USER_STATUS = { active: ['live', 'Active'], invited: ['review', 'Invited'], deactivated: ['hidden', 'Deactivated'] } as const;
const UserBadge = ({ s }: { s: User['status'] }) => <Badge kind={USER_STATUS[s][0]} text={USER_STATUS[s][1]} />;
const fullName = (u: { first: string; last: string }) => `${u.first} ${u.last}`;
const ROLE_OPTS = Object.entries(ROLES).map(([k, r]) => [k, r.label] as [string, string]);
const USER_FIELDS: FieldDef[] = [
  { key: 'first', label: 'First name', required: true, max: 40, wide: false },
  { key: 'last', label: 'Last name', required: true, max: 40, wide: false },
  { key: 'email', label: 'Email address', required: true, max: 80 },
  { key: 'role', label: 'Role', type: 'radio', options: ROLE_OPTS }
];
const userValidate = (d: Data, selfId?: string): Errors => {
  const e: Errors = {};
  if (d.email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(d.email.trim())) e.email = 'Enter an email address like name@utsw.example.';
  else if (d.email && UserService.emailTaken(d.email, selfId)) e.email = `An account already exists for ${d.email.trim().toLowerCase()}.`;
  return e;
};
const crumbs: [string, string | null][] = [['Admin management', null], ['All users', 'users']];

function UsersPage(_: PageProps) {
  const canManage = can(Session.role(), 'users', 'manage');
  const [load, retry] = useLoad(() => UserService.list());
  return (
    <div className="page">
      <PageHead crumbs={[['Admin management', null]]} title="All users" lede="People who can sign in to MyCare Admin, with their role and account status."
        actions={canManage ? <a className="btn btn-primary" href="#users-new"><Icon name="person_add" size={20} /><span className="lbl">Create user</span></a> : null} />
      <div id="us-body">
        {load.status === 'loading' ? <LoadingState text="Loading users" /> : load.status === 'error' ? <ErrorState msg={load.error} onRetry={retry} /> : <>
          {!canManage && <p className="note-line"><Icon name="info" size={20} /><span>Your role can view users. A Super Admin manages accounts.</span></p>}
          <section className="card"><div className="card-body" id="us-table">
            <DataTable<User> id="us" caption="Admin users" alwaysPaginate noun="user" rows={load.data} defaultSort={{ key: 'name', dir: 'asc' }} searchPlaceholder="Search names and emails" rowKey={u => u.id}
              searchText={u => `${fullName(u)} ${u.email}`}
              filters={[
                { key: 'role', label: 'Role', options: ROLE_OPTS, match: (u, v) => u.role === v },
                { key: 'status', label: 'Status', options: Object.entries(USER_STATUS).map(([k, v]) => [k, v[1]] as [string, string]), match: (u, v) => u.status === v }]}
              empty={{ icon: 'group', title: 'No users', text: '' }}
              columns={[
                { key: 'name', label: 'Name', sortable: true, sortValue: u => `${u.last} ${u.first}`.toLowerCase(), render: u => <a className="row-link" href={`#users-${u.id}`}><span className="avatar sm" aria-hidden="true">{initials(u)}</span><span>{fullName(u)}{u.id === Session.current()!.userId && <> <span className="muted">(you)</span></>}</span></a> },
                { key: 'email', label: 'Email', sortable: true, render: u => u.email },
                { key: 'role', label: 'Role', sortable: true, sortValue: u => ROLES[u.role].label, render: u => ROLES[u.role].label },
                { key: 'status', label: 'Status', sortable: true, render: u => <UserBadge s={u.status} /> },
                { key: 'created', label: 'Created', sortable: true, render: u => <span className="nowrap">{fmtDate(u.created)}</span> },
                { key: 'lastSignIn', label: 'Last sign-in', sortable: true, sortValue: u => u.lastSignIn || '', render: u => u.lastSignIn ? <span className="nowrap">{fmtDateTime(u.lastSignIn)}</span> : <span className="muted">Never</span> }]} />
          </div></section>
        </>}
      </div>
    </div>
  );
}

function NewUserPage(_: PageProps) {
  const [d, setD] = useState<Data>({ first: '', last: '', email: '', role: 'marketing' });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  useLeaveGuard(!!(d.first || d.last || d.email), 'the user', { title: 'Leave without creating the user?', body: 'What you entered is lost.' });
  const submit = async () => {
    const errs = validateData(USER_FIELDS, d, x => userValidate(x));
    setErrors(errs);
    if (Object.keys(errs).length) { focusSoon('f-errsum'); return; }
    setBusy(true);
    try { const u = await UserService.create(d as Parameters<typeof UserService.create>[0]); Router.clearGuard(); toast(`Invitation sent to ${u.email} (simulated).`, { kind: 'success' }); Router.go(`users-${u.id}`); }
    catch (err) { setBusy(false); const m = (err as Error).message; setErrors(m.includes('already') ? { email: m } : {}); toast(m, { kind: 'error', ms: 8000 }); }
  };
  return (
    <div className="page">
      <PageHead crumbs={crumbs} title="Create user" lede="The person gets an email invitation (simulated) to set a password, then logs in with their email address and password." />
      <div className="ed-grid single"><section className="card"><div className="card-head"><h2>New user</h2></div>
        <form className="card-body form" id="un" noValidate onSubmit={e => { e.preventDefault(); submit(); }}>
          <Form sections={[{ fields: USER_FIELDS }]} data={d} errors={errors} prefix="f" onChange={setD} />
          <div className="form-actions"><a className="btn btn-text" href="#users"><span className="lbl">Cancel</span></a><Btn label="Create and send invitation" icon="send" variant="primary" type="submit" id="un-go" busy={busy} busyLabel="Creating" /></div>
        </form></section></div>
    </div>
  );
}

function UserPage({ params }: PageProps) {
  const [load, retry] = useLoad(() => UserService.get(params.id!));
  if (load.status === 'loading') return <div className="page" id="ud"><LoadingState text="Loading the user" /></div>;
  if (load.status === 'error') return <div className="page" id="ud"><PageHead crumbs={crumbs} title="User not found" /><ErrorState msg={load.error} onRetry={retry} /></div>;
  return <UserBody u={load.data} />;
}
function UserBody({ u }: { u: User }) {
  const me = u.id === Session.current()!.userId, manage = can(Session.role(), 'users', 'manage');
  const [d, setD] = useState<Data>({ first: u.first, last: u.last, email: u.email, role: u.role });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState<string | null>(null);
  const dirty = d.first !== u.first || d.last !== u.last || d.email !== u.email || d.role !== u.role;
  useLeaveGuard(dirty, 'this user', { title: 'Leave without saving?', body: 'Your changes to this user aren’t saved.' });
  const activity = DB.db.audit.filter(a => a.by === u.id || a.targetId === u.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  /* The email address is the sign-in, so it can't be changed here */
  const fields = USER_FIELDS.map(f => (!manage || f.key === 'email' || (me && f.key === 'role')) ? { ...f, readonly: true } : f);
  const save = async () => {
    if (!dirty) { toast('There are no changes to save.'); return; }
    const errs = validateData(USER_FIELDS, d, x => userValidate(x, u.id));
    setErrors(errs);
    if (Object.keys(errs).length) { focusSoon('f-errsum'); return; }
    if (d.role !== u.role) { const c = await confirmDialog({ title: `Change role to ${ROLES[d.role as Role].label}?`, body: <p>{fullName(u)} goes from {ROLES[u.role].label} to {ROLES[d.role as Role].label}. What they can see and do changes the next time they open a page.</p>, confirmLabel: 'Change role' }); if (!c.ok) return; }
    setBusy('save');
    try { await UserService.update(u.id, { ...d, email: d.email.trim().toLowerCase() }); Router.clearGuard(); toast('Changes saved.', { kind: 'success' }); Router.refresh(); }
    catch (err) { setBusy(null); toast((err as Error).message, { kind: 'error', ms: 8000 }); }
  };
  const run = async (k: string, fn: () => Promise<unknown>, msg: string, go?: string) => {
    setBusy(k);
    try { await fn(); Router.clearGuard(); toast(msg, { kind: 'success' }); if (go) Router.go(go); else Router.refresh(); }
    catch (err) { setBusy(null); toast((err as Error).message, { kind: 'error', ms: 8000 }); }
  };
  const act = async (k: string) => {
    if (k === 'resend') { const c = await confirmDialog({ title: `Resend the invitation to ${fullName(u)}?`, body: <p>{u.email} gets a new invitation email with a link to set a password. The earlier link stops working.</p>, confirmLabel: 'Resend invitation' }); if (c.ok) run(k, () => UserService.resendInvite(u.id), `Invitation sent again to ${u.email} (simulated).`); }
    if (k === 'deactivate') { const c = await confirmDialog({ title: `Deactivate ${fullName(u)}?`, body: <p>They can’t sign in until the account is reactivated. Their history stays in the audit log.</p>, confirmLabel: 'Deactivate', variant: 'danger', comment: { label: 'Reason', required: true } }); if (c.ok) run(k, () => UserService.setStatus(u.id, 'deactivated', c.comment), `${fullName(u)} is deactivated.`); }
    if (k === 'reactivate') { const c = await confirmDialog({ title: `Reactivate ${fullName(u)}?`, body: <p>They can sign in again as {ROLES[u.role].label}.</p>, confirmLabel: 'Reactivate' }); if (c.ok) run(k, () => UserService.setStatus(u.id, 'active', ''), `${fullName(u)} is active again.`); }
    if (k === 'delete') { const c = await confirmDialog({ title: `Delete ${fullName(u)}’s account?`, body: <p>This removes the account for good. Consider deactivating instead – deletion vs. deactivation is pending confirmation (§10.16). The audit log keeps their past actions.</p>, confirmLabel: 'Delete account', variant: 'danger' }); if (c.ok) run(k, () => UserService.remove(u.id), `${fullName(u)}’s account is deleted.`, 'users'); }
  };
  const B = { busyLabel: '', variant: 'secondary' as const };
  return (
    <div className="page" id="ud">
      <PageHead crumbs={crumbs} title={fullName(u)} badges={<UserBadge s={u.status} />} />
      <div className="ed-grid">
        <div className="ed-main">
          <section className="card"><div className="card-head"><h2>Profile and role</h2>{!manage && <div className="card-actions"><Badge kind="fixed" text="View only" /></div>}</div>
            <form className="card-body form" id="ud-form" noValidate onSubmit={e => { e.preventDefault(); save(); }}>
              <Form sections={[{ fields }]} data={d} errors={errors} prefix="f" onChange={setD} />
              {manage && <div className="form-actions"><Btn label="Save changes" icon="save" variant="primary" type="submit" id="ud-save" busy={busy === 'save'} busyLabel="Saving" /></div>}
            </form></section>
          <section className="card"><div className="card-head"><h2>Recent activity</h2></div><div className="card-body">
            {activity.length ? <><ul className="activity">{activity.map(a => <li key={a.id}><span className="act-w">{fmtDateTime(a.at)}</span><span>{a.by === u.id ? '' : `${UserService.name(a.by)}: `}{a.action} – {a.target}</span></li>)}</ul>
              <p><a className="text-link" href="#audit">Open the audit log</a></p></> : <p className="muted">No activity yet.</p>}</div></section>
        </div>
        <aside className="ed-side"><section className="card"><div className="card-body">
          <h2 className="side-h">Account</h2>
          <dl className="facts"><dt>Status</dt><dd><UserBadge s={u.status} /></dd><dt>Created</dt><dd>{fmtDateTime(u.created)}</dd><dt>Last sign-in</dt><dd>{u.lastSignIn ? fmtDateTime(u.lastSignIn) : 'Never'}</dd></dl>
          {manage && <div className="stack-acts">
            {u.status === 'invited' && <Btn {...B} label="Resend invitation" icon="send" data-u="resend" busy={busy === 'resend'} busyLabel="Sending" onClick={() => act('resend')} />}
            {u.status === 'deactivated' ? <Btn {...B} label="Reactivate account" icon="how_to_reg" data-u="reactivate" busy={busy === 'reactivate'} busyLabel="Reactivating" onClick={() => act('reactivate')} />
              : me ? null : <Btn {...B} label="Deactivate account" icon="person_off" data-u="deactivate" busy={busy === 'deactivate'} busyLabel="Deactivating" onClick={() => act('deactivate')} />}
            {me ? <p className="muted">You can’t deactivate, delete or change the role of your own account.</p> : <Btn label="Delete account" icon="delete" variant="danger" data-u="delete" busy={busy === 'delete'} busyLabel="Deleting" onClick={() => act('delete')} />}
          </div>}
        </div></section></aside>
      </div>
    </div>
  );
}

export const userPages: Record<string, Page> = { users: UsersPage, 'users-new': NewUserPage, 'users-:id': UserPage };
