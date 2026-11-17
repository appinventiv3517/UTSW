/* ---------- Simulated SSO session ----------
   SIMULATED: no identity provider is connected. The real flow (SAML or OIDC, MFA, timeout) is pending UTSW (HANDOVER §8).
   There is never a username and password form. */
import { DB, saveDb, UserService } from '../services/services';
import { ROLES, type Role } from './permissions';
import type { User, SessionState } from './types';

/* Idle timeout from Administrative settings (30 minutes by default – placeholder until UTSW confirms it) */
const SESSION_IDLE_MS = (): number => ((DB.db.settings && DB.db.settings.sessionTimeout) || 30) * 60 * 1000;
export const Session = {
  current: (): SessionState | null => DB.session,
  /* Step 1: the person picks a sample account on the simulated identity-provider screen */
  pending: null as string | null,
  begin(userId: string): void { this.pending = userId; },
  /* Step 2: simulated MFA approval starts the session */
  complete(): boolean {
    const u = UserService.byId(this.pending); if (!u) return false;
    DB.session = { userId: u.id, role: u.role, startedAt: Date.now(), lastActive: Date.now() };
    this.pending = null; saveDb(); return true;
  },
  touch(): void { if (DB.session) { DB.session.lastActive = Date.now(); } },
  expired(): boolean { return !!DB.session && Date.now() - DB.session.lastActive > SESSION_IDLE_MS(); },
  /* Prototype only: lets reviewers see each role without three sign-ins */
  switchRole(role: Role): void { if (DB.session && ROLES[role]) { DB.session.role = role; saveDb(); } },
  end(): void { DB.session = null; saveDb(); },
  role: (): Role | null => (DB.session && DB.session.role) || null,
  user: (): User | null => (DB.session && UserService.byId(DB.session.userId)) || null
};
