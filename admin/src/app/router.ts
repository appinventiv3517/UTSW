/* ---------- Hash router with session and role guards ----------
   Public routes: login, mfa, signed-out, expired. Everything else needs the simulated session,
   and a role that can view the page's area; otherwise the access-denied view shows in place.
   A page with unsaved changes sets a guard; leaving it asks first. */
import { useSyncExternalStore } from 'react';
import { ROUTES, type RouteDef } from './nav';
import { getDbVersion, onDbChange } from '../services/services';

export const DEFAULT_ROUTE = 'dashboard';
export const PUBLIC_ROUTES = ['login', 'mfa', 'signed-out', 'expired'];

export function matchRoute(name: string): { route: RouteDef; params: { id?: string } } | null {
  const exact = ROUTES.find(r => r.pattern === name);
  if (exact) return { route: exact, params: {} };
  for (const r of ROUTES) {
    if (!r.pattern.endsWith('-:id')) continue;
    const pre = r.pattern.slice(0, -3);
    if (name.startsWith(pre) && name.length > pre.length && !ROUTES.some(x => x.pattern === name)) return { route: r, params: { id: name.slice(pre.length) } };
  }
  return null;
}

/* Route state: the hash name plus a counter that remounts the page on refresh */
interface RouteState { name: string; nonce: number; refresh: boolean }
let state: RouteState = { name: location.hash.slice(1) || DEFAULT_ROUTE, nonce: 0, refresh: false };
const subs = new Set<() => void>();
const set = (next: RouteState) => { state = next; subs.forEach(f => f()); };
export type Guard = () => Promise<boolean>;

export const Router = {
  guardFn: null as Guard | null,
  returnTo: null as string | null,
  loaded: false,
  get current(): string { return state.name; },
  setGuard(fn: Guard): void { this.guardFn = fn; },
  clearGuard(fn?: Guard): void { if (!fn || this.guardFn === fn) this.guardFn = null; },
  async canLeave(): Promise<boolean> { return this.guardFn ? await this.guardFn() : true; },
  go(name: string, { force = false } = {}): void {
    if (force) this.clearGuard();
    if (location.hash.slice(1) === name) this.resolve(); else location.hash = name;
  },
  /* Re-render the current page from fresh data, keeping focus where it is */
  refresh(): void { set({ name: state.name, nonce: state.nonce + 1, refresh: true }); },
  /* Show a route without adding a history entry (redirects) */
  replace(name: string): void { history.replaceState(null, '', `#${name}`); set({ name, nonce: state.nonce + 1, refresh: false }); },
  resolve(): void { set({ name: location.hash.slice(1) || DEFAULT_ROUTE, nonce: state.nonce + 1, refresh: false }); },
  async onHash(): Promise<void> {
    const next = location.hash.slice(1) || DEFAULT_ROUTE;
    if (this.guardFn && next !== state.name) {
      const ok = await this.guardFn();
      if (!ok) { history.replaceState(null, '', `#${state.name}`); return; }
      this.clearGuard();
    }
    this.resolve();
  }
};
window.addEventListener('hashchange', () => { void Router.onHash(); });

export const useRoute = (): RouteState => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, () => state);
/* Re-render whenever the mock data changes (any service call, sign-in, role switch) */
export const useDb = (): number => useSyncExternalStore(onDbChange, getDbVersion);

/* Unsaved changes on the page now: the Publishing bar and the browser's leave warning read it */
export const Unsaved = { on: false };
