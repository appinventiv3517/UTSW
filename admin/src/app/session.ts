/* ---------- Session (email and password sign-in, MOCK) ----------
   AuthService checks the email and password; this keeps who is signed in, their role and the idle timeout. */
import { DB, saveDb, UserService } from '../services/services';
import { ROLES, type Role } from './permissions';
import type { User, SessionState } from './types';

/* Idle timeout from Administrative settings (30 minutes by default – placeholder until UTSW confirms it) */
const SESSION_IDLE_MS = (): number => ((DB.db.settings && DB.db.settings.sessionTimeout) || 30) * 60 * 1000;
export const Session = {
  current: (): SessionState | null => DB.session,
  /* Starts the session once AuthService accepted the email and password */
  start(userId: string): boolean {
    const u = UserService.byId(userId); if (!u) return false;
    DB.session = { userId: u.id, role: u.role, startedAt: Date.now(), lastActive: Date.now() };
    saveDb(); return true;
  },
  touch(): void { if (DB.session) { DB.session.lastActive = Date.now(); } },
  expired(): boolean { return !!DB.session && Date.now() - DB.session.lastActive > SESSION_IDLE_MS(); },
  /* Prototype only: lets reviewers see each role without three sign-ins */
  switchRole(role: Role): void { if (DB.session && ROLES[role]) { DB.session.role = role; saveDb(); } },
  end(): void { DB.session = null; saveDb(); },
  role: (): Role | null => (DB.session && DB.session.role) || null,
  user: (): User | null => (DB.session && UserService.byId(DB.session.userId)) || null
};
