/* ---------- Sign-in and system pages ----------
   SIMULATED SSO and MFA. No identity provider is connected and no credentials are collected or stored.
   The real flow (SAML or OIDC, the approved MFA mechanism) replaces these screens' service calls only. */
/* EXTRA_GLYPHS: database login phonelink_lock check logout timer_off */
import { useEffect, useState, type ReactNode } from 'react';
import { DB, UserService } from '../services/services';
import { Session } from '../app/session';
import { Router, DEFAULT_ROUTE, PUBLIC_ROUTES } from '../app/router';
import { ROLES } from '../app/permissions';
import { LOGO_HORIZONTAL } from '../app/assets';
import { initials } from '../app/Shell';
import { Badge, Btn, Icon } from '../ui/kit';

function AuthLayout({ children }: { children: ReactNode }) {
  useEffect(() => { if (Router.loaded) document.getElementById('page-h')?.focus(); }, []);
  return (
    <div className="auth">
      <main id="main" className="auth-main" tabIndex={-1}>
        <div className="auth-card"><img className="auth-logo" src={LOGO_HORIZONTAL} alt="UTSW MyCare" width={232} />{children}</div>
        <p className="auth-flag"><Icon name="database" size={20} /><span>Prototype – mock data, not connected to MyCare</span></p>
      </main>
    </div>
  );
}
const SimNote = ({ children }: { children: ReactNode }) => <p className="sim-note"><Badge kind="simulated" /><span>{children}</span></p>;

function Login() {
  const [step, setStep] = useState<'start' | 'idp'>('start');
  const users = DB.db.users.filter(u => u.status === 'active');
  const [pick, setPick] = useState(users[0]?.id || '');
  useEffect(() => { document.title = 'Sign in – MyCare Admin (prototype)'; }, []);
  useEffect(() => { if (step === 'idp') document.getElementById('page-h')?.focus(); }, [step]);
  if (step === 'start') return (
    <AuthLayout>
      <h1 id="page-h" tabIndex={-1}>MyCare Admin</h1>
      <p className="auth-lede">Manage the MyCare app’s home screen, content and notifications. Sign in with your UT Southwestern account.</p>
      <Btn label="Sign in with UTSW SSO" icon="login" variant="primary" size="lg" id="sso" onClick={() => setStep('idp')} />
      <SimNote>No identity provider is connected. Next, you pick a sample account to sign in as.</SimNote>
    </AuthLayout>
  );
  return (
    <AuthLayout>
      <h1 id="page-h" tabIndex={-1}>Choose a sample account</h1>
      <p className="auth-lede">This step stands in for the UTSW identity provider. Each account has one of the planned roles.</p>
      <form id="idp" className="idp" noValidate onSubmit={e => { e.preventDefault(); Session.begin(pick); location.hash = 'mfa'; }}>
        <fieldset><legend className="vh">Sample accounts</legend>
          {users.map(u => (
            <label key={u.id} className="acct" htmlFor={`acct-${u.id}`}><input type="radio" name="acct" id={`acct-${u.id}`} value={u.id} checked={pick === u.id} onChange={() => setPick(u.id)} />
              <span className="avatar" aria-hidden="true">{initials(u)}</span><span className="acct-t"><span className="acct-n">{u.first} {u.last}</span><span className="acct-r">{ROLES[u.role].label} · {u.email}</span></span></label>))}
        </fieldset>
        <div className="auth-acts"><Btn label="Back" variant="text" id="idp-back" onClick={() => setStep('start')} /><Btn label="Continue" variant="primary" type="submit" size="lg" /></div>
      </form>
      <SimNote>Sample accounts only. There is no username or password.</SimNote>
    </AuthLayout>
  );
}

function Mfa() {
  const [busy, setBusy] = useState(false);
  useEffect(() => { document.title = 'Verify it’s you – MyCare Admin (prototype)'; if (!Session.pending) location.hash = 'login'; }, []);
  const u = UserService.byId(Session.pending);
  if (!u) return null;
  const approve = async () => {
    setBusy(true);
    await new Promise(r => setTimeout(r, 400));
    Session.complete();
    const to = Router.returnTo && !PUBLIC_ROUTES.includes(Router.returnTo) ? Router.returnTo : DEFAULT_ROUTE;
    Router.returnTo = null;
    location.hash = to;
  };
  return (
    <AuthLayout>
      <h1 id="page-h" tabIndex={-1}>Verify it’s you</h1>
      <p className="auth-lede">We sent a sign-in request to the approved MFA app for {u.first} {u.last}. Approve it to continue.</p>
      <div className="mfa-wait"><Icon name="phonelink_lock" size={32} /><p>Waiting for approval</p></div>
      <div className="auth-acts">
        <Btn label="Cancel" variant="text" id="mfa-cancel" onClick={() => { Session.pending = null; location.hash = 'login'; }} />
        <Btn label="Approve (simulated)" icon="check" variant="primary" size="lg" id="mfa-ok" busy={busy} busyLabel="Signing in" onClick={approve} />
      </div>
      <SimNote>The approval happens here instead of on a phone. The real MFA mechanism is pending UTSW confirmation.</SimNote>
    </AuthLayout>
  );
}

function Exit({ title, text, icon }: { title: string; text: string; icon: string }) {
  useEffect(() => { document.title = `${title} – MyCare Admin (prototype)`; }, [title]);
  return (
    <AuthLayout>
      <div className="exit-ic"><Icon name={icon} size={32} /></div><h1 id="page-h" tabIndex={-1}>{title}</h1><p className="auth-lede">{text}</p>
      <a className="btn btn-primary btn-lg" href="#login"><span className="lbl">Sign in again</span></a>
    </AuthLayout>
  );
}

export function PublicPage({ name }: { name: string }) {
  if (name === 'login') return <Login />;
  if (name === 'mfa') return <Mfa />;
  if (name === 'signed-out') return <Exit title="You’re signed out" text="You signed out of MyCare Admin. Unsaved changes were not kept." icon="logout" />;
  return <Exit title="Your session ended" icon="timer_off"
    text={`For security, MyCare Admin signs you out after ${(DB.db.settings && DB.db.settings.sessionTimeout) || 30} minutes without activity. Sign in again to continue. Unsaved changes were not kept.`} />;
}
