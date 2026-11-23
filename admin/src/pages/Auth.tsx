/* ---------- Sign-in, forgot password and reset password, and the signed-out pages ----------
   Follows the Admin Login design: a UTSW Blue brand panel beside a card.
   Log in → (Forgot password → Link sent → reset link → Create new password → Password reset) or Link expired.
   MOCK: AuthService checks passwords in this browser's mock data. No email is sent; the reset link is shown on screen. */
/* EXTRA_GLYPHS: database warning visibility visibility_off chevron_left check_circle cancel radio_button_unchecked logout timer_off mail */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { AuthService, DB } from '../services/services';
import { Session } from '../app/session';
import { Router, DEFAULT_ROUTE, PUBLIC_ROUTES } from '../app/router';
import { LOGO_REVERSED } from '../app/assets';
import { EMAIL_RE, PW_RULES, SAMPLE_PASSWORD, pwOk } from '../app/password';
import { Badge, Btn, Icon } from '../ui/kit';
import { announce, cx } from '../app/util';

const setTitle = (t: string) => { document.title = `${t} – MyCare Admin (prototype)`; };
const focusId = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus());

function AuthLayout({ children, wide }: { children: ReactNode; wide?: boolean }) {
  useEffect(() => { if (Router.loaded) document.getElementById('page-h')?.focus(); }, []);
  return (
    <div className="auth">
      <div className="auth-brand"><div className="auth-brand-in">
        <img className="auth-logo" src={LOGO_REVERSED} alt="UTSW MyCare" width={280} />
        <p className="auth-welcome">Welcome to MyCare Admin</p>
      </div></div>
      <main id="main" className="auth-main" tabIndex={-1}>
        <div className={cx('auth-card', wide && 'wide')}>{children}</div>
        <p className="auth-flag"><Icon name="database" size={20} /><span>Prototype – mock data, not connected to MyCare</span></p>
      </main>
    </div>
  );
}
const SimNote = ({ children }: { children: ReactNode }) => <div className="sim-note"><Badge kind="simulated" /><div>{children}</div></div>;
const BackToLogin = () => <a className="auth-back" href="#login"><Icon name="chevron_left" size={20} />Back to login</a>;
/* Status screens: a round icon, a heading, a line of text and one action */
function Status({ ok, title, text, children }: { ok: boolean; title: string; text: ReactNode; children: ReactNode }) {
  useEffect(() => { setTitle(title); announce(title); }, [title]);
  return (
    <AuthLayout>
      <div className="auth-status">
        <span className={cx('auth-st-ic', ok ? 'ok' : 'bad')} aria-hidden="true"><Icon name={ok ? 'check_circle' : 'cancel'} size={32} /></span>
        <h1 id="page-h" tabIndex={-1}>{title}</h1><p className="auth-lede">{text}</p>
      </div>
      {children}
    </AuthLayout>
  );
}

/* A text field in the design's style; password fields get a show/hide button */
function AuthField({ id, label, type = 'text', value, onChange, placeholder, autoComplete, invalid, describedby, error }: {
  id: string; label: string; type?: 'text' | 'email' | 'password'; value: string; onChange: (v: string) => void; placeholder: string; autoComplete: string; invalid?: boolean; describedby?: string; error?: string }) {
  const [show, setShow] = useState(false);
  const pw = type === 'password';
  const desc = [describedby, error && `${id}-err`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('field', (invalid || error) && 'has-error')}>
      <label htmlFor={id}>{label}</label>
      <div className={cx(pw && 'pw-wrap')}>
        <input className="input" id={id} name={id} type={pw && !show ? 'password' : pw ? 'text' : type} value={value} placeholder={placeholder} autoComplete={autoComplete}
          spellCheck={false} aria-invalid={invalid || !!error || undefined} aria-describedby={desc} onChange={e => onChange(e.target.value)} />
        {pw && <button type="button" className="pw-eye btn btn-text btn-icon" aria-label={`${show ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={show}
          onClick={() => setShow(!show)}><Icon name={show ? 'visibility_off' : 'visibility'} size={20} /></button>}
      </div>
      {error && <p className="err" id={`${id}-err`}><Icon name="error" size={16} /><span>{error}</span></p>}
    </div>
  );
}

/* ---------- Log in ---------- */
function Login() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setTitle('Log in'); if (Session.current()) location.hash = DEFAULT_ROUTE; }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !pw || busy) return;
    setBusy(true);
    try {
      const id = await AuthService.login(email, pw);
      Session.start(id);
      const to = Router.returnTo && !PUBLIC_ROUTES.includes(Router.returnTo) && !Router.returnTo.startsWith('reset-') ? Router.returnTo : DEFAULT_ROUTE;
      Router.returnTo = null;
      location.hash = to;
    } catch {
      setBusy(false); setFailed(true); setPw('');
      focusId('login-err');
    }
  };
  const users = DB.db.users.filter(u => u.status === 'active');
  return (
    <AuthLayout>
      <div className="auth-head"><h1 id="page-h" tabIndex={-1}>Welcome back</h1><p className="auth-lede">Log in to the UTSW MyCare Admin Portal.</p></div>
      {failed && <div className="auth-alert" role="alert" id="login-err" tabIndex={-1}><Icon name="warning" size={20} /><span>Invalid credentials. Please try again.</span></div>}
      <form className="auth-form" id="login-form" noValidate onSubmit={submit}>
        <AuthField id="login-email" label="Email address" type="email" value={email} onChange={v => { setEmail(v); }} placeholder="Enter your email address" autoComplete="username" invalid={failed} describedby={failed ? 'login-err' : undefined} />
        <AuthField id="login-pw" label="Password" type="password" value={pw} onChange={setPw} placeholder="Enter your password" autoComplete="current-password" invalid={failed} describedby={failed ? 'login-err' : undefined} />
        <Btn label="Log in" variant="primary" size="lg" type="submit" id="login-go" className="auth-submit" disabled={!email.trim() || !pw} busy={busy} busyLabel="Logging in" />
      </form>
      <a className="auth-link" href="#forgot-password" id="forgot-link">Forgot password?</a>
      <SimNote>
        <p>Mock accounts only. Every active sample account uses the password <code>{SAMPLE_PASSWORD}</code> until you reset it.</p>
        <ul className="sim-accts">{users.slice(0, 3).map(u => (
          <li key={u.id}><button type="button" className="text-link" data-fill={u.id} aria-label={`Fill in ${u.email} and the sample password`} onClick={() => { setEmail(u.email); setPw(SAMPLE_PASSWORD); setFailed(false); }}>{u.email}</button></li>))}</ul>
      </SimNote>
    </AuthLayout>
  );
}

/* ---------- Forgot password → Link sent ---------- */
function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ token: string | null } | null>(null);
  useEffect(() => { setTitle('Forgot password'); }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || busy) return;
    if (!EMAIL_RE.test(email.trim())) { setErr('Enter a valid email address.'); focusId('fp-email'); return; }
    setBusy(true);
    try { const token = await AuthService.requestReset(email); setSent({ token }); }
    catch (x) { setBusy(false); setErr((x as Error).message); }
  };
  if (sent) return (
    <Status ok title="Link sent" text="If an account uses that address, we’ve sent it a password reset link. Check your inbox and follow the instructions to create a new password.">
      <a className="btn btn-primary btn-lg auth-submit" href="#login" id="fp-back"><span className="lbl">Back to login</span></a>
      <SimNote>
        {sent.token ? <p>No email is sent in this prototype. <a className="text-link" href={`#reset-${sent.token}`} id="fp-open">Open the reset link</a> (valid for 30 minutes, once).</p>
          : <p>No email is sent in this prototype, and no active account uses that address, so there’s no link to open.</p>}
        <p><a className="text-link" href="#reset-expired-sample" id="fp-expired">See an expired link</a></p>
      </SimNote>
    </Status>
  );
  return (
    <AuthLayout>
      <BackToLogin />
      <div className="auth-head left"><h1 id="page-h" tabIndex={-1}>Forgot password</h1><p className="auth-lede">Enter your registered email address and we’ll send you a link to reset your password.</p></div>
      <form className="auth-form" id="fp-form" noValidate onSubmit={submit}>
        <AuthField id="fp-email" label="Email address" type="email" value={email} onChange={v => { setEmail(v); if (err) setErr(''); }} placeholder="Enter your email address" autoComplete="username" error={err} />
        <Btn label="Send reset link" variant="primary" size="lg" type="submit" id="fp-go" className="auth-submit" disabled={!email.trim()} busy={busy} busyLabel="Sending" />
      </form>
    </AuthLayout>
  );
}

/* ---------- Reset link → Create new password → Password reset, or Link expired ---------- */
function ResetPassword({ token }: { token: string }) {
  const [check] = useState(() => AuthService.checkReset(token));
  const [pw, setPw] = useState('');
  const [cnf, setCnf] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [expired, setExpired] = useState(check.state === 'expired');
  const [resent, setResent] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  useEffect(() => { if (!expired && !done) setTitle('Create new password'); }, [expired, done]);
  const mismatch = cnf.length > 0 && cnf.length >= pw.length && cnf !== pw;
  const ready = pwOk(pw) && cnf === pw;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    try { await AuthService.resetPassword(token, pw); setDone(true); }
    catch { setBusy(false); setExpired(true); }
  };
  const resend = async () => {
    if (!check.email) { location.hash = 'forgot-password'; return; }
    setResending(true);
    try { setResent(await AuthService.requestReset(check.email)); } finally { setResending(false); }
  };
  if (done) return (
    <Status ok title="Password reset" text="Your password is updated. Log in with your new password.">
      <a className="btn btn-primary btn-lg auth-submit" href="#login" id="rp-login"><span className="lbl">Back to login</span></a>
    </Status>
  );
  if (resent !== null) return (
    <Status ok title="Link sent" text="We’ve sent a new password reset link to your email address. Check your inbox and follow the instructions to create a new password.">
      <a className="btn btn-primary btn-lg auth-submit" href="#login"><span className="lbl">Back to login</span></a>
      <SimNote><p>No email is sent in this prototype. <a className="text-link" href={`#reset-${resent}`} id="rp-open">Open the new reset link</a></p></SimNote>
    </Status>
  );
  if (expired) return (
    <Status ok={false} title="Link expired" text="This password reset link has expired or was already used. Request a new link to reset your password.">
      <Btn label="Resend reset link" variant="primary" size="lg" id="rp-resend" className="auth-submit" busy={resending} busyLabel="Sending" onClick={resend} />
      <a className="auth-link" href="#login">Back to login</a>
    </Status>
  );
  return (
    <AuthLayout>
      <div className="auth-head left"><h1 id="page-h" tabIndex={-1}>Create new password</h1><p className="auth-lede">Create a secure password for your administrator account{check.email ? <>, <b>{check.email}</b></> : ''}.</p></div>
      <form className="auth-form" id="rp-form" noValidate onSubmit={submit}>
        <AuthField id="rp-new" label="New password" type="password" value={pw} onChange={setPw} placeholder="Enter new password" autoComplete="new-password" describedby="rp-rules" />
        <Requirements id="rp-rules" pw={pw} />
        <AuthField id="rp-cnf" label="Confirm new password" type="password" value={cnf} onChange={setCnf} placeholder="Confirm new password" autoComplete="new-password"
          error={mismatch ? 'The passwords don’t match.' : ''} />
        <Btn label="Create password" variant="primary" size="lg" type="submit" id="rp-go" className="auth-submit" disabled={!ready} busy={busy} busyLabel="Saving" />
      </form>
    </AuthLayout>
  );
}

/* Requirement list: each line turns green with a check once it's met (an icon and a word, not color alone) */
export function Requirements({ id, pw }: { id: string; pw: string }) {
  return (
    <div className="pw-req" id={id}>
      <p className="pw-req-h">Password requirements:</p>
      <ul>{PW_RULES.map(r => { const met = r.test(pw); return (
        <li key={r.key} data-rule={r.key} className={cx(met && 'met')}><Icon name={met ? 'check_circle' : 'radio_button_unchecked'} size={16} />
          <span>{r.label}<span className="vh">{met ? ' – met' : ' – not met yet'}</span></span></li>); })}</ul>
    </div>
  );
}

function Exit({ title, text, icon }: { title: string; text: string; icon: string }) {
  useEffect(() => { setTitle(title); }, [title]);
  return (
    <AuthLayout>
      <div className="auth-status"><span className="auth-st-ic info" aria-hidden="true"><Icon name={icon} size={32} /></span><h1 id="page-h" tabIndex={-1}>{title}</h1><p className="auth-lede">{text}</p></div>
      <a className="btn btn-primary btn-lg auth-submit" href="#login"><span className="lbl">Log in again</span></a>
    </AuthLayout>
  );
}

export function PublicPage({ name }: { name: string }) {
  if (name === 'login') return <Login />;
  if (name === 'forgot-password') return <ForgotPassword />;
  if (name.startsWith('reset-')) return <ResetPassword token={name.slice('reset-'.length)} />;
  if (name === 'signed-out') return <Exit title="You’re logged out" text="You logged out of MyCare Admin. Unsaved changes were not kept." icon="logout" />;
  return <Exit title="Your session ended" icon="timer_off"
    text={`For security, MyCare Admin logs you out after ${(DB.db.settings && DB.db.settings.sessionTimeout) || 30} minutes without activity. Log in again to continue. Unsaved changes were not kept.`} />;
}
