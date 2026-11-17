/* ---------- My profile ----------
   The signed-in person can change their own first and last name. Everything else on the account (email, role,
   status, dates) is shown read only: role and status are changed by a Super Admin in Admin management, and the
   email comes from the UTSW identity provider.
   PASSWORD – SIMULATED. Sign-in is UTSW SSO, so the real password lives with the identity provider (pending, §10.1).
   This form only checks what is typed against the sample rules; nothing is sent or stored, and the fields are
   cleared as soon as the check finishes. */
/* EXTRA_GLYPHS: person lock badge visibility visibility_off info save error */
import { useState } from 'react';
import type { PageProps } from '../app/App';
import { PageHead, initials } from '../app/Shell';
import { Session } from '../app/session';
import { ROLES } from '../app/permissions';
import { UserService } from '../services/services';
import { Badge, Btn, Icon } from '../ui/kit';
import { toast } from '../ui/overlays';
import { focusSoon } from './collection';
import { announce, cx, fmtDate, fmtDateTime } from '../app/util';

const PW_MIN = 12;
const Err = ({ id, msg }: { id: string; msg: string }) => <p className="err" id={id} hidden={!msg}>{msg && <><Icon name="error" size={16} /><span>{msg}</span></>}</p>;

export function ProfilePage(_: PageProps) {
  const u = Session.user()!, role = Session.role()!;
  /* ---- Name ---- */
  const [saved, setSaved] = useState({ first: u.first, last: u.last });
  const [name, setName] = useState({ first: u.first, last: u.last });
  const [nameErr, setNameErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const v = { first: name.first.trim(), last: name.last.trim() };
  const dirty = v.first !== saved.first || v.last !== saved.last;
  const setField = (k: 'first' | 'last', x: string) => { setName(n => ({ ...n, [k]: x })); if (x.trim()) setNameErr(e => ({ ...e, [k]: '' })); };
  const saveName = async () => {
    const m: Record<string, string> = {};
    (['first', 'last'] as const).forEach(k => { m[k] = !v[k] ? `Enter your ${k} name.` : /[<>]/.test(v[k]) ? 'Use letters, spaces, hyphens or apostrophes.' : ''; });
    setNameErr(m);
    const bad = (['first', 'last'] as const).find(k => m[k]);
    if (bad) { focusSoon(`pf-${bad}`); return; }
    setBusy(true);
    try { await UserService.updateOwnName(v.first, v.last); setSaved(v); setBusy(false); toast('Your name is saved.', { kind: 'success' }); announce('Your name is saved.'); }
    catch (err) { setBusy(false); toast((err as Error).message, { kind: 'error', ms: 8000 }); }
  };
  /* ---- Password (simulated) ---- */
  const [pw, setPw] = useState({ cur: '', new: '', cnf: '' });
  const [show, setShow] = useState({ cur: false, new: false, cnf: false });
  const [pwErr, setPwErr] = useState<Record<string, string>>({});
  const [pwBusy, setPwBusy] = useState(false);
  const rules = { len: pw.new.length >= PW_MIN, mix: /[a-z]/i.test(pw.new) && /\d/.test(pw.new), diff: !!pw.new && pw.new !== pw.cur };
  const changePw = async () => {
    const m: Record<string, string> = {
      cur: !pw.cur ? 'Enter your current password.' : '',
      new: !pw.new ? 'Enter a new password.' : !rules.len ? `Use at least ${PW_MIN} characters.` : !rules.mix ? 'Use letters and at least one number.' : !rules.diff ? 'Choose a password different from your current one.' : '',
      cnf: !pw.cnf ? 'Enter the new password again.' : pw.cnf !== pw.new ? 'The passwords don’t match.' : ''
    };
    setPwErr(m);
    const bad = ['cur', 'new', 'cnf'].find(k => m[k]);
    if (bad) { focusSoon(`pw-${bad}`); return; }
    setPwBusy(true);
    await new Promise(res => setTimeout(res, 500));
    setPw({ cur: '', new: '', cnf: '' }); setShow({ cur: false, new: false, cnf: false }); setPwBusy(false);
    toast('Password change simulated. Nothing was sent or stored; your real password is managed by your UTSW account.', { kind: 'success', ms: 7000 });
    announce('Password change simulated.');
    focusSoon('pw-h');
  };
  const PW_FIELDS: ['cur' | 'new' | 'cnf', string, string][] = [['cur', 'Current password', 'current-password'], ['new', 'New password', 'new-password'], ['cnf', 'Confirm new password', 'new-password']];
  return (
    <div className="page profile">
      <PageHead crumbs={[]} title="My profile" lede="Change your name and password. Your email, role and account status are managed for you." />
      <div className="pf-grid">
        <section className="card" aria-labelledby="pf-h">
          <div className="card-head"><h2 id="pf-h">Profile</h2></div>
          <form className="card-body form" id="pf-form" noValidate onSubmit={e => { e.preventDefault(); saveName(); }}>
            <div className="pf-me"><span className="avatar lg" aria-hidden="true" id="pf-av">{initials(saved)}</span>
              <div><p className="pf-name" id="pf-name">{saved.first} {saved.last}</p><p className="muted">{u.email}</p></div></div>
            <div className="form-grid">{(['first', 'last'] as const).map(k => (
              <div key={k} className={cx('field', nameErr[k] && 'has-error')} id={`pf-${k}-w`}><label htmlFor={`pf-${k}`}>{k === 'first' ? 'First name' : 'Last name'} <span className="req">(required)</span></label>
                <input className="input" id={`pf-${k}`} name={k === 'first' ? 'given-name' : 'family-name'} autoComplete={k === 'first' ? 'given-name' : 'family-name'} maxLength={40} value={name[k]} required
                  aria-describedby={`pf-${k}-err`} aria-invalid={nameErr[k] ? true : undefined} onChange={e => setField(k, e.target.value)} />
                <Err id={`pf-${k}-err`} msg={nameErr[k] || ''} /></div>))}
            </div>
            <dl className="facts pf-facts">
              <div><dt>Email</dt><dd>{u.email}</dd></div>
              <div><dt>Role</dt><dd><span className="role-tag">{ROLES[role].label}</span></dd></div>
              <div><dt>Status</dt><dd>{u.status === 'active' ? 'Active' : u.status}</dd></div>
              <div><dt>Member since</dt><dd>{fmtDate(u.created)}</dd></div>
              <div><dt>Last sign-in</dt><dd>{u.lastSignIn ? fmtDateTime(u.lastSignIn) : 'Never'}</dd></div>
            </dl>
            <p className="role-note"><Icon name="info" size={20} /><span>Only your name can be changed here. A Super Admin changes roles and status in Admin management; your email comes from your UTSW account.</span></p>
            <div className="form-acts"><Btn label="Save name" icon="save" variant="primary" type="submit" id="pf-save" disabled={!dirty} busy={busy} busyLabel="Saving" /></div>
          </form>
        </section>
        <section className="card" aria-labelledby="pw-h">
          <div className="card-head"><h2 id="pw-h" tabIndex={-1}>Password</h2><div className="card-actions"><Badge kind="simulated" text="Simulated" /></div></div>
          <form className="card-body form" id="pw-form" noValidate onSubmit={e => { e.preventDefault(); changePw(); }}>
            <p className="note-line"><Icon name="lock" size={20} /><span>You sign in with UTSW SSO, so your real password belongs to your UTSW account. This prototype only checks the form: nothing is sent or stored.</span></p>
            {PW_FIELDS.map(([k, l, ac]) => (
              <div key={k} className={cx('field', pwErr[k] && 'has-error')} id={`pw-${k}-w`}><label htmlFor={`pw-${k}`}>{l} <span className="req">(required)</span></label>
                <div className="pw-wrap"><input className="input" type={show[k] ? 'text' : 'password'} id={`pw-${k}`} autoComplete={ac} required aria-describedby={`${k === 'new' ? 'pw-rules ' : ''}pw-${k}-err`}
                  aria-invalid={pwErr[k] ? true : undefined} value={pw[k]} onChange={e => setPw(p => ({ ...p, [k]: e.target.value }))} />
                  <button type="button" className="pw-eye btn btn-text btn-icon" data-eye={`pw-${k}`} aria-label={`${show[k] ? 'Hide' : 'Show'} ${l.toLowerCase()}`} aria-pressed={show[k]}
                    onClick={() => setShow(s => ({ ...s, [k]: !s[k] }))}><Icon name={show[k] ? 'visibility_off' : 'visibility'} size={20} /></button></div>
                <Err id={`pw-${k}-err`} msg={pwErr[k] || ''} /></div>))}
            <ul className="pw-rules" id="pw-rules" aria-label="Password rules">
              <li data-rule="len" className={cx(rules.len && 'met')}>At least {PW_MIN} characters</li>
              <li data-rule="mix" className={cx(rules.mix && 'met')}>Letters and at least one number</li>
              <li data-rule="diff" className={cx(rules.diff && 'met')}>Different from your current password</li></ul>
            <div className="form-acts"><Btn label="Change password" icon="lock" variant="primary" type="submit" id="pw-go" busy={pwBusy} busyLabel="Checking" /></div>
          </form>
        </section>
      </div>
    </div>
  );
}
