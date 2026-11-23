/* MOCK SERVICE LAYER. Async interfaces with simulated latency and optional simulated errors.
   No network requests are made; there are no endpoints or credentials anywhere in this app.
   A real backend replaces the bodies of these functions; screens only call the interfaces. */
import { clone, uid, store } from '../app/util';
import { ROLES, can, canAct, type Area, type Level, type Action, type Role } from '../app/permissions';
import { seedDb } from '../mock/seed';
import { SAMPLE_PASSWORD, pwOk } from '../app/password';
import type { ConfigRecord, ConfigType, Data, Db, Env, Store, User, Notification, Wayfinding, Metric, Point, Settings, ZeroResult, Integration } from '../app/types';
export const MockSettings = { latency: [160, 380] as [number, number], simulateErrors: false };
export class ServiceError extends Error {}
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
export const SCHEMA = 8;
export let DB: Store = null as unknown as Store;
export function loadDb(): void {
  const saved = store.read<Store>();
  DB = saved && saved.db && saved.db.schema === SCHEMA ? saved : { db: seedDb(), session: saved && saved.session && saved.db && saved.db.schema === SCHEMA ? saved.session : null, prefs: (saved && saved.prefs) || {} };
  MockSettings.simulateErrors = !!DB.prefs.simulateErrors;
}
/* Screens re-render after any change to the mock data (see useDb in app/store.ts) */
const listeners = new Set<() => void>();
let dbVersion = 0;
export const onDbChange = (fn: () => void): (() => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const getDbVersion = (): number => dbVersion;
export const notifyDb = (): void => { dbVersion++; listeners.forEach(f => f()); };
export const saveDb = (): void => { store.write(DB); notifyDb(); };
export function resetMockData(): void {
  DB = { db: seedDb(), session: DB.session, prefs: {} };
  MockSettings.simulateErrors = false;
  saveDb();
}
export async function mockCall<T>(name: string, fn: () => T): Promise<T> {
  const [a, b] = MockSettings.latency;
  await wait(a + Math.random() * (b - a));
  if (MockSettings.simulateErrors) throw new ServiceError(`The mock ${name} service returned a simulated error. Turn off “Simulate service errors” in the user menu, then try again.`);
  const out = fn();
  saveDb();
  return clone(out);
}
export const actor = (): string => (DB.session && DB.session.userId) || '';
export const nowIso = (): string => new Date().toISOString();
function needs(area: Area, level: Level): void {
  const role = DB.session && DB.session.role;
  if (!role || !can(role, area, level)) throw new ServiceError('Your role does not allow this action.');
}
interface AuditOpts { targetId?: string | null; targetType?: string | null; environment?: string | null; version?: number | null; comment?: string; before?: unknown; after?: unknown }
export function audit(action: string, target: string, { targetId = null, targetType = null, environment = null, version = null, comment = '', before = null, after = null }: AuditOpts = {}): void {
  DB.db.audit.push({ id: uid('au'), at: nowIso(), by: actor(), action, target, targetId, targetType, environment, version, comment, before: before && clone(before), after: after && clone(after) });
}

/* ---------- Config schema (HANDOVER §6.3) ----------
   supportsRollback is per type; every value is an assumption pending confirmation (§10.17). */
export const CONFIG_TYPES: Record<ConfigType, { label: string; area: Area; supportsRollback: boolean; route: string }> = {
  homeLayout: { label: 'Home screen layout', area: 'homeLayout', supportsRollback: true, route: 'home-layout' },
  campaign: { label: 'Campaign', area: 'campaigns', supportsRollback: true, route: 'home-campaigns' },
  alert: { label: 'Emergency alert', area: 'alerts', supportsRollback: true, route: 'home-alerts' },
  quickLink: { label: 'Quick link', area: 'quickLinks', supportsRollback: true, route: 'home-quick-links' },
  featuredCard: { label: 'Services and resources card', area: 'featuredCards', supportsRollback: true, route: 'home-featured-cards' },
  drawer: { label: 'Menu', area: 'drawer', supportsRollback: true, route: 'content-drawer' },
  globalColors: { label: 'Global colors', area: 'colors', supportsRollback: true, route: 'content-colors' },
  appEntry: { label: 'App entry', area: 'appEntry', supportsRollback: true, route: 'content-app-entry' },
  searchMappings: { label: 'Query mappings', area: 'search', supportsRollback: true, route: 'search-query-mappings' },
  searchSynonyms: { label: 'Synonyms', area: 'search', supportsRollback: true, route: 'search-synonyms' },
  searchSpecialties: { label: 'Specialty mapping', area: 'search', supportsRollback: true, route: 'search-specialties' },
  searchTop: { label: 'Top and popular searches', area: 'search', supportsRollback: true, route: 'search-top' },
  searchRanking: { label: 'Ranking', area: 'search', supportsRollback: true, route: 'search-ranking' },
  segment: { label: 'Audience segment', area: 'audiences', supportsRollback: false, route: 'audiences' },
  locations: { label: 'Location-aware configuration', area: 'locations', supportsRollback: true, route: 'admin-settings-locations' }
};
export const recLink = (r: ConfigRecord): string => CONFIG_TYPES[r.type].route + (['campaign', 'alert', 'quickLink', 'featuredCard', 'segment'].includes(r.type) ? `-${r.id}` : '');
/* What each environment holds */
export const dataAt = (r: ConfigRecord, env: Env | string): Data | null => (env === 'draft' ? r.draft && r.draft.data : env === 'demo' ? r.demo && r.versions[r.demo].data : r.production && r.versions[r.production].data) || null;
export const latestData = (r: ConfigRecord): Data => (dataAt(r, 'draft') || dataAt(r, 'demo') || dataAt(r, 'production')) as Data;
export const recName = (d: Data): string | null => d.title || d.name || null;

function rec(id: string): ConfigRecord { const r = DB.db.records[id]; if (!r) throw new ServiceError('That item no longer exists. It may have been deleted.'); return r; }
function guard(r: ConfigRecord, action: Action): void {
  const role = DB.session && DB.session.role;
  if (!role || !canAct(role, CONFIG_TYPES[r.type].area, action)) throw new ServiceError('Your role does not allow this action.');
}
function logEvent(r: ConfigRecord, action: string, environment: Env, version: number | null, comment?: string, before?: unknown, after?: unknown): void {
  const e = { id: uid('ev'), action, environment, version, by: actor(), at: nowIso(), comment: comment || '' };
  r.events.push(e);
  audit(action, r.name, { targetId: r.id, targetType: r.type, environment, version, comment, before, after });
}

export const ConfigService = {
  get: (id: string) => mockCall('configuration', () => rec(id)),
  list: (type?: ConfigType) => mockCall('configuration', () => Object.values(DB.db.records).filter(r => !type || r.type === type)),
  peek: (id: string): ConfigRecord | null => DB.db.records[id] ? clone(DB.db.records[id]) : null, /* synchronous read for previews and pickers */
  peekAll: (type: ConfigType): ConfigRecord[] => clone(Object.values(DB.db.records).filter(r => r.type === type)),
  create: (type: ConfigType, data: Data, comment?: string) => mockCall('configuration', () => {
    const area = CONFIG_TYPES[type].area; needs(area, 'draft');
    const id = `${type.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}-${Date.now().toString(36)}`;
    const r: ConfigRecord = { id, type, name: recName(data) || CONFIG_TYPES[type].label, versions: {}, production: null, demo: null, draft: null, review: null, nextVersion: 1, events: [] };
    r.draft = { data: clone(data), updatedBy: actor(), updatedAt: nowIso(), comment: comment || '', baseVersion: null };
    DB.db.records[id] = r;
    logEvent(r, 'Created as draft', 'draft', null, comment, null, data);
    return r;
  }),
  remove: (id: string) => mockCall('configuration', () => {
    const r = rec(id); guard(r, 'saveDraft');
    if (r.production || r.demo) throw new ServiceError('Published items can’t be deleted. Turn the item off and publish instead, so the change is versioned.');
    delete DB.db.records[id];
    audit('Deleted draft', r.name, { targetId: id, targetType: r.type, environment: 'draft', before: r.draft && r.draft.data });
    return { id };
  }),
  saveDraft: (id: string, data: Data, comment?: string) => mockCall('configuration', () => {
    const r = rec(id); guard(r, 'saveDraft');
    const before = latestData(r);
    r.draft = { data: clone(data), updatedBy: actor(), updatedAt: nowIso(), comment: comment || '', baseVersion: r.production };
    r.review = null;
    r.name = recName(data) || r.name;
    logEvent(r, 'Draft saved', 'draft', null, comment, before, data);
    return r;
  }),
  discardDraft: (id: string) => mockCall('configuration', () => {
    const r = rec(id); guard(r, 'saveDraft');
    const before = r.draft && r.draft.data;
    r.draft = null; r.review = null;
    const d = latestData(r); if (d) r.name = recName(d) || r.name;
    logEvent(r, 'Draft discarded', 'draft', null, '', before, null);
    return r;
  }),
  requestReview: (id: string, comment?: string) => mockCall('configuration', () => {
    const r = rec(id); guard(r, 'requestReview');
    if (!r.draft) throw new ServiceError('Save a draft before you request a review.');
    r.review = { by: actor(), at: nowIso(), comment: comment || '' };
    logEvent(r, 'Review requested', 'draft', null, comment);
    return r;
  }),
  deployToDemo: (id: string, comment?: string) => mockCall('publishing', () => {
    const r = rec(id); guard(r, 'deployDemo');
    if (!r.draft) throw new ServiceError('There is no saved draft to deploy.');
    const before = dataAt(r, 'demo');
    const v = r.nextVersion++;
    r.versions[v] = { version: v, data: clone(r.draft.data), updatedBy: actor(), updatedAt: nowIso(), comment: comment || r.draft.comment || '' };
    r.demo = v; r.draft = null; r.review = null;
    logEvent(r, 'Deployed to demo', 'demo', v, comment, before, r.versions[v].data);
    return r;
  }),
  requestChanges: (id: string, comment: string) => mockCall('publishing', () => {
    const r = rec(id); guard(r, 'requestChanges');
    if (!r.demo || r.demo === r.production) throw new ServiceError('There is nothing on demo waiting for production.');
    r.draft = { data: clone(r.versions[r.demo].data), updatedBy: actor(), updatedAt: nowIso(), comment: `Changes requested: ${comment}`, baseVersion: r.production, changesRequested: comment };
    logEvent(r, 'Changes requested', 'demo', r.demo, comment);
    return r;
  }),
  publish: (id: string, comment?: string) => mockCall('publishing', () => {
    const r = rec(id); guard(r, 'publish');
    if (!r.demo || r.demo === r.production) throw new ServiceError('Deploy to demo and check it there before you publish.');
    if (DB.db.settings.requirePublishComment && !comment) throw new ServiceError('A comment is required to publish (Administrative settings).');
    const before = dataAt(r, 'production');
    r.production = r.demo;
    logEvent(r, 'Published to production', 'production', r.demo, comment, before, r.versions[r.demo].data);
    return r;
  }),
  publishDirect: (id: string, comment?: string) => mockCall('publishing', () => {
    const r = rec(id); guard(r, 'publish');
    if (!r.draft) throw new ServiceError('There is no saved draft to publish.');
    if (DB.db.settings.requirePublishComment && !comment) throw new ServiceError('A comment is required to publish (Administrative settings).');
    const before = dataAt(r, 'production');
    const v = r.nextVersion++;
    r.versions[v] = { version: v, data: clone(r.draft.data), updatedBy: actor(), updatedAt: nowIso(), comment: comment || r.draft.comment || 'Published directly' };
    r.demo = v; r.production = v; r.draft = null; r.review = null;
    logEvent(r, 'Published directly to production (skipped demo)', 'production', v, comment, before, r.versions[v].data);
    return r;
  }),
  rollback: (id: string, toVersion: number, comment: string) => mockCall('publishing', () => {
    const r = rec(id); guard(r, 'rollback');
    if (!CONFIG_TYPES[r.type].supportsRollback) throw new ServiceError(`${CONFIG_TYPES[r.type].label} does not support rollback.`);
    const old = r.versions[toVersion]; if (!old) throw new ServiceError(`Version ${toVersion} does not exist.`);
    const before = dataAt(r, 'production');
    const v = r.nextVersion++;
    r.versions[v] = { version: v, data: clone(old.data), updatedBy: actor(), updatedAt: nowIso(), comment: `Rollback to v${toVersion}: ${comment}`, rollbackOf: toVersion };
    r.production = v; r.demo = v;
    logEvent(r, `Rolled back to v${toVersion}`, 'production', v, comment, before, old.data);
    return r;
  })
};

/* ---------- Admin users ---------- */
export const UserService = {
  list: () => mockCall('users', () => DB.db.users),
  get: (id: string) => mockCall('users', () => { const u = DB.db.users.find(x => x.id === id); if (!u) throw new ServiceError('That user no longer exists.'); return u; }),
  byId: (id: string | null | undefined): User | null => DB.db.users.find(u => u.id === id) || null,
  name: (id: string | null | undefined): string => { const u = UserService.byId(id); return u ? `${u.first} ${u.last}` : 'Unknown user'; },
  emailTaken: (email: string, exceptId?: string): boolean => DB.db.users.some(u => u.email.toLowerCase() === email.trim().toLowerCase() && u.id !== exceptId),
  create: (d: { first: string; last: string; email: string; role: Role }) => mockCall('users', () => {
    needs('users', 'manage');
    if (UserService.emailTaken(d.email)) throw new ServiceError(`An account already exists for ${d.email}.`);
    const u: User = { id: uid('u'), first: d.first.trim(), last: d.last.trim(), email: d.email.trim().toLowerCase(), role: d.role, status: 'invited', created: nowIso(), lastSignIn: null };
    DB.db.users.push(u);
    audit('User invited', `${u.first} ${u.last}`, { targetId: u.id, targetType: 'user', after: { role: ROLES[u.role].label, status: 'Invited', email: u.email } });
    return u;
  }),
  updateOwnName: (first: string, last: string) => mockCall('users', () => {
    const u = DB.db.users.find(x => x.id === actor()); if (!u) throw new ServiceError('Your account wasn’t found.');
    if (!first || !last) throw new ServiceError('Enter your first and last name.');
    const before = { name: `${u.first} ${u.last}` };
    u.first = first; u.last = last;
    audit('Profile updated', `${first} ${last}`, { targetId: u.id, targetType: 'user', before, after: { name: `${first} ${last}` } });
    return u;
  }),
  update: (id: string, patch: Partial<User>) => mockCall('users', () => {
    needs('users', 'manage');
    const u = DB.db.users.find(x => x.id === id); if (!u) throw new ServiceError('That user no longer exists.');
    if (patch.email && UserService.emailTaken(patch.email, id)) throw new ServiceError(`Another account already uses ${patch.email}.`);
    if (id === actor() && patch.role && patch.role !== u.role) throw new ServiceError('You can’t change your own role. Ask another Super Admin.');
    const before: Record<string, unknown> = {}, after: Record<string, unknown> = {};
    const uu = u as unknown as Record<string, unknown>, pp = patch as Record<string, unknown>;
    Object.keys(patch).forEach(k => { if (uu[k] !== pp[k]) { before[k] = k === 'role' ? ROLES[uu[k] as Role].label : uu[k]; after[k] = k === 'role' ? ROLES[pp[k] as Role].label : pp[k]; uu[k] = pp[k]; } });
    if (Object.keys(after).length) audit(after.role ? 'Role changed' : 'User updated', `${u.first} ${u.last}`, { targetId: id, targetType: 'user', before, after });
    return u;
  }),
  setStatus: (id: string, status: User['status'], comment?: string) => mockCall('users', () => {
    needs('users', 'manage');
    const u = DB.db.users.find(x => x.id === id); if (!u) throw new ServiceError('That user no longer exists.');
    if (id === actor()) throw new ServiceError('You can’t deactivate your own account.');
    const label: Record<User['status'], string> = { active: 'Active', deactivated: 'Deactivated', invited: 'Invited' };
    audit(status === 'deactivated' ? 'User deactivated' : 'User reactivated', `${u.first} ${u.last}`, { targetId: id, targetType: 'user', comment, before: { status: label[u.status] }, after: { status: label[status] } });
    u.status = status;
    return u;
  }),
  resendInvite: (id: string) => mockCall('users', () => {
    needs('users', 'manage');
    const u = DB.db.users.find(x => x.id === id) as User;
    audit('Invitation resent', `${u.first} ${u.last}`, { targetId: id, targetType: 'user' });
    return u;
  }),
  remove: (id: string) => mockCall('users', () => {
    needs('users', 'manage');
    if (id === actor()) throw new ServiceError('You can’t delete your own account.');
    const i = DB.db.users.findIndex(x => x.id === id); if (i < 0) throw new ServiceError('That user no longer exists.');
    const [u] = DB.db.users.splice(i, 1);
    audit('User deleted', `${u.first} ${u.last}`, { targetId: id, targetType: 'user', before: { email: u.email, role: ROLES[u.role].label } });
    return u;
  })
};

/* ---------- Notifications: draft → scheduled or sent; cancel while scheduled ---------- */
export const NOTE_STATUS: Record<Notification['status'], string> = { draft: 'Draft', scheduled: 'Scheduled', sent: 'Sent', cancelled: 'Cancelled' };
/* Each save of a notification keeps a version (its message and delivery fields) */
const NOTE_KEYS = ['title', 'description', 'image', 'imageAlt', 'videoUrl', 'destination', 'sendTo', 'timing', 'scheduledAt'];
const noteSnap = (n: Notification): Data => Object.fromEntries(NOTE_KEYS.map(k => [k, clone((n as unknown as Data)[k])]));
const noteVersions = (n: Notification) => { if (!n.versions) n.versions = [{ version: 1, data: noteSnap(n), at: n.createdAt, by: n.createdBy, comment: 'Created' }]; return n.versions; };
export const NotificationService = {
  list: () => mockCall('notifications', () => { DB.db.notifications.forEach(noteVersions); return DB.db.notifications; }),
  get: (id: string) => mockCall('notifications', () => { const n = DB.db.notifications.find(x => x.id === id); if (!n) throw new ServiceError('That notification no longer exists.'); noteVersions(n); return n; }),
  restore: (id: string, version: number) => mockCall('notifications', () => {
    needs('notifications', 'draft');
    const n = DB.db.notifications.find(x => x.id === id) as Notification, ver = noteVersions(n).find(v => v.version === version);
    if (!ver) throw new ServiceError(`Version ${version} doesn’t exist.`);
    if (n.status === 'draft') {
      Object.assign(n, clone(ver.data), { updatedAt: nowIso() });
      noteVersions(n).push({ version: noteVersions(n).length + 1, data: noteSnap(n), at: nowIso(), by: actor(), comment: `Restored v${version}` });
      audit('Notification restored', n.title, { targetId: id, targetType: 'notification', comment: `Version ${version}` });
      return n;
    }
    /* Sent, scheduled or cancelled: the old version comes back as a new draft */
    const c: Notification = { ...clone(n), ...clone(ver.data), id: uid('n'), title: `${ver.data.title} (copy)`, status: 'draft', createdBy: actor(), createdAt: nowIso(), updatedAt: nowIso(), sentAt: null, stats: null };
    c.versions = [{ version: 1, data: noteSnap(c), at: nowIso(), by: actor(), comment: `From v${version} of “${n.title}”` }];
    DB.db.notifications.unshift(c);
    audit('Notification duplicated', c.title, { targetId: c.id, targetType: 'notification', comment: `From version ${version}` });
    return c;
  }),
  save: (id: string | null, data: Data) => mockCall('notifications', () => {
    needs('notifications', 'draft');
    if (!id) {
      const n = { ...clone(data), id: uid('n'), status: 'draft', createdBy: actor(), createdAt: nowIso(), updatedAt: nowIso(), sentAt: null, stats: null } as Notification;
      n.versions = [{ version: 1, data: noteSnap(n), at: nowIso(), by: actor(), comment: 'Created' }];
      DB.db.notifications.unshift(n as Notification);
      audit('Notification created', n.title, { targetId: n.id, targetType: 'notification', after: data });
      return n;
    }
    const n = DB.db.notifications.find(x => x.id === id) as Notification;
    if (n.status !== 'draft') throw new ServiceError(`${NOTE_STATUS[n.status]} notifications can’t be edited. Duplicate it instead.`);
    const before = clone(n);
    Object.assign(n, clone(data), { status: 'draft', updatedAt: nowIso() });
    noteVersions(n).push({ version: noteVersions(n).length + 1, data: noteSnap(n), at: nowIso(), by: actor(), comment: 'Edited' });
    audit('Notification edited', n.title, { targetId: id, targetType: 'notification', before, after: data });
    return n;
  }),
  schedule: (id: string, comment?: string) => mockCall('notifications', () => {
    needs('notifications', 'publish');
    const n = DB.db.notifications.find(x => x.id === id)!;
    if (n.status !== 'draft') throw new ServiceError('Only drafts can be scheduled or sent.');
    if (n.timing === 'now') { n.status = 'sent'; n.sentAt = nowIso(); n.stats = { delivered: 0, opened: 0, actions: 0 }; }
    else n.status = 'scheduled';
    n.updatedAt = nowIso();
    audit(n.status === 'sent' ? 'Notification sent (simulated)' : 'Notification scheduled', n.title, { targetId: id, targetType: 'notification', comment });
    return n;
  }),
  cancel: (id: string, comment?: string) => mockCall('notifications', () => {
    needs('notifications', 'publish');
    const n = DB.db.notifications.find(x => x.id === id)!;
    if (n.status !== 'scheduled') throw new ServiceError('Only scheduled notifications can be cancelled.');
    n.status = 'cancelled'; n.updatedAt = nowIso();
    audit('Notification cancelled', n.title, { targetId: id, targetType: 'notification', comment });
    return n;
  }),
  duplicate: (id: string) => mockCall('notifications', () => {
    needs('notifications', 'draft');
    const src = DB.db.notifications.find(x => x.id === id) as Notification;
    const n: Notification = { ...clone(src), id: uid('n'), title: `${src.title} (copy)`, status: 'draft', createdBy: actor(), createdAt: nowIso(), updatedAt: nowIso(), sentAt: null, stats: null };
    n.versions = [{ version: 1, data: noteSnap(n), at: nowIso(), by: actor(), comment: `Duplicated from “${src.title}”` }];
    DB.db.notifications.unshift(n);
    audit('Notification duplicated', n.title, { targetId: n.id, targetType: 'notification' });
    return n;
  }),
  remove: (id: string) => mockCall('notifications', () => {
    needs('notifications', 'draft');
    const i = DB.db.notifications.findIndex(x => x.id === id); const n = DB.db.notifications[i];
    if (n.status !== 'draft' && n.status !== 'cancelled') throw new ServiceError('Only drafts and cancelled notifications can be deleted.');
    DB.db.notifications.splice(i, 1);
    audit('Notification deleted', n.title, { targetId: id, targetType: 'notification', before: n });
    return { id };
  })
};

/* ---------- Wayfinding: manual Gozio JSON. The schema checked here is a placeholder until UTSW shares a real export. ---------- */
export const WAY_CATEGORIES = ['Clinic', 'Imaging', 'Lab', 'Pharmacy', 'Restroom', 'Elevator', 'Entrance', 'Parking', 'Food', 'Information', 'Other'];
export interface Validation { ok: boolean; errors: string[]; moreErrors?: number; warnings: string[]; stats: { buildings: number; floors: number; destinations: number; venue?: string; warnings?: number } | null }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateGozio(text: string): Validation {
  const errors: string[] = [], warnings: string[] = [];
  let doc: any;
  try { doc = JSON.parse(text); }
  catch (e) {
    const m = /position (\d+)/.exec((e as Error).message); let where = '';
    if (m) { const pos = +m[1], before = text.slice(0, pos); where = ` at line ${before.split('\n').length}, column ${pos - before.lastIndexOf('\n')}`; }
    return { ok: false, errors: [`The file isn’t valid JSON${where}. Export the file again from Gozio and upload the new copy.`], warnings, stats: null };
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { ok: false, errors: ['The file must contain one JSON object with venue and buildings.'], warnings, stats: null };
  if (!doc.schemaVersion) errors.push('Missing “schemaVersion”.');
  if (!doc.venue || !doc.venue.id || !doc.venue.name) errors.push('Missing “venue” with an id and a name.');
  if (!Array.isArray(doc.buildings) || !doc.buildings.length) errors.push('“buildings” must be a list with at least one building.');
  let floors = 0, dests = 0; const ids = new Set();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Array.isArray(doc.buildings) ? doc.buildings : []).forEach((b: any, bi: number) => {
    const bn = b && b.name ? `“${b.name}”` : `Building ${bi + 1}`;
    if (!b || !b.id || !b.name) errors.push(`${bn} needs an id and a name.`);
    if (!Array.isArray(b && b.floors) || !b.floors.length) { errors.push(`${bn} has no floors.`); return; }
    b.floors.forEach((f: any, fi: number) => {
      floors++;
      const fn = `${bn}, floor ${f && f.name ? `“${f.name}”` : fi + 1}`;
      if (typeof (f && f.level) !== 'number') errors.push(`${fn} needs a numeric “level”.`);
      if (!Array.isArray(f && f.destinations) || !f.destinations.length) { warnings.push(`${fn} has no destinations.`); return; }
      f.destinations.forEach((d: any, di: number) => {
        dests++;
        if (!d || !d.id) errors.push(`${fn}, destination ${di + 1} has no id.`);
        else if (ids.has(d.id)) errors.push(`Destination id “${d.id}” is used more than once.`);
        else ids.add(d.id);
        if (d && !d.name) warnings.push(`${fn}: destination “${d.id}” has no name, so patients can’t search for it.`);
        if (d && d.category && !WAY_CATEGORIES.includes(d.category)) errors.push(`${fn}: “${d.category}” isn’t a known category for “${d.id}”.`);
      });
    });
  });
  return { ok: !errors.length, errors: errors.slice(0, 50), moreErrors: Math.max(0, errors.length - 50), warnings, stats: { buildings: (doc.buildings || []).length, floors, destinations: dests, venue: doc.venue && doc.venue.name } };
}
export const WayfindingService = {
  get: () => mockCall('wayfinding', () => DB.db.wayfinding),
  validate: (text: string) => mockCall('wayfinding validation', () => validateGozio(text)),
  upload: (fileName: string, sizeKb: number, stats: NonNullable<Validation['stats']>, comment: string) => mockCall('wayfinding upload', () => {
    needs('wayfinding', 'publish');
    const w = DB.db.wayfinding, v = Math.max(...w.versions.map(x => x.version)) + 1;
    w.versions.forEach(x => { if (x.status === 'validated') x.status = 'superseded'; });
    w.versions.push({ version: v, fileName, sizeKb, by: actor(), at: nowIso(), status: 'validated', buildings: stats.buildings, floors: stats.floors, destinations: stats.destinations, warnings: stats.warnings || 0, comment });
    w.history.push({ at: nowIso(), by: actor(), action: 'Uploaded and validated', version: v, environment: 'draft', comment });
    audit('Wayfinding file uploaded', fileName, { targetType: 'wayfinding', version: v, environment: 'draft', comment, after: stats });
    return w;
  }),
  publish: (version: number, env: 'demo' | 'production', comment?: string) => mockCall('wayfinding publishing', () => {
    needs('wayfinding', 'publish');
    const w = DB.db.wayfinding, v = w.versions.find(x => x.version === version)!;
    if (env === 'production' && w.demo !== version) throw new ServiceError('Publish this version to demo and check it there first.');
    if (env === 'demo') w.demo = version; else w.production = version;
    w.versions.forEach(x => { x.status = x.version === w.production ? 'production' : x.version === w.demo ? 'demo' : ['validated', 'superseded'].includes(x.status) ? x.status : 'retired'; });
    const action = `${env === 'demo' ? 'Published to demo' : 'Published to production'}`;
    w.history.push({ at: nowIso(), by: actor(), action, version, environment: env, comment: comment || '' });
    audit(`Wayfinding ${action.toLowerCase()}`, v.fileName, { targetType: 'wayfinding', version, environment: env, comment });
    return w;
  }),
  rollback: (version: number, comment?: string) => mockCall('wayfinding publishing', () => {
    needs('wayfinding', 'publish');
    const w = DB.db.wayfinding, from = w.production;
    w.production = version; w.demo = version;
    w.versions.forEach(x => { x.status = x.version === version ? 'production' : x.status === 'production' || x.status === 'demo' ? 'retired' : x.status; });
    w.history.push({ at: nowIso(), by: actor(), action: `Rolled back from v${from}`, version, environment: 'production', comment: comment || '' });
    audit('Wayfinding rolled back', `v${from} → v${version}`, { targetType: 'wayfinding', version, environment: 'production', comment, before: { version: from }, after: { version } });
    return w;
  })
};

/* ---------- Zero-result searches (would come from search analytics) ---------- */
export const ZeroResultService = {
  list: () => mockCall('search analytics', () => DB.db.zeroResults),
  setStatus: (id: string, status: ZeroResult['status']) => mockCall('search analytics', () => {
    needs('search', 'publish');
    const z = DB.db.zeroResults.find(x => x.id === id)!; const before = z.status; z.status = status;
    audit(status === 'dismissed' ? 'Zero-result query dismissed' : 'Zero-result query resolved', z.query, { targetType: 'search', before: { status: before }, after: { status } });
    return z;
  })
};

/* ---------- Analytics: deterministic mock series (clearly labeled in the UI) ---------- */
function prng(seed: string): () => number { let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; }
export const ANALYTICS_END = '2026-10-30';
function series(key: string, days: number, base: number, spread: number, trend = 0, weekly = 0): Point[] {
  const r = prng(key), out: Point[] = [], end = new Date(ANALYTICS_END + 'T12:00:00Z');
  for (let i = 179; i >= 0; i--) {
    const d = new Date(end.getTime() - i * 864e5), dow = d.getUTCDay();
    const v = base + trend * (179 - i) + (r() - .5) * spread + (dow === 0 || dow === 6 ? -weekly : weekly / 3);
    out.push({ x: d.toISOString().slice(0, 10), y: v });
  }
  return out.slice(-days);
}
type MetricDef = Omit<Metric, 'series' | 'value' | 'change'>;
const METRICS: Record<string, MetricDef[]> = {
  adoption: [
    { key: 'dau', label: 'Daily active users', unit: 'count', base: 38000, spread: 3200, trend: 22, weekly: 6000 },
    { key: 'mau', label: 'Monthly active users', unit: 'count', base: 151000, spread: 1500, trend: 170, weekly: 0, smooth: true },
    { key: 'activation', label: 'New-user activation rate', unit: '%', base: 58, spread: 5, trend: .02 },
    { key: 'return30', label: '30-day return rate', unit: '%', base: 44, spread: 3, trend: .015 },
    { key: 'engagement', label: 'Meaningful engagement rate', unit: '%', base: 36, spread: 4, trend: .01 },
    { key: 'taskSuccess', label: 'Patient task success rate', unit: '%', base: 81, spread: 4, trend: .01 }
  ],
  search: [
    { key: 'homeCtr', label: 'Home module click-through rate', unit: '%', base: 27, spread: 4, trend: .01 },
    { key: 'searchSuccess', label: 'Unified search success rate', unit: '%', base: 76, spread: 5, trend: .02 },
    { key: 'zeroRate', label: 'Zero-result search rate', unit: '%', base: 7.8, spread: 1.6, trend: -.008, lowerBetter: true },
    { key: 'profileDiscovery', label: 'Provider profile discovery rate', unit: '%', base: 33, spread: 4, trend: .01 }
  ],
  content: [
    { key: 'articleEng', label: 'Article engagement rate', unit: '%', base: 22, spread: 4, trend: .005 },
    { key: 'resourceAct', label: 'Patient resource action rate', unit: '%', base: 15, spread: 3, trend: .01 },
    { key: 'crashFree', label: 'Crash-free session rate', unit: '%', base: 99.4, spread: .4, trend: .001 },
    { key: 'homeLoad', label: 'Home load time', unit: 's', base: 1.6, spread: .3, trend: -.001, lowerBetter: true }
  ],
  care: [
    { key: 'findCareConv', label: 'Find Care action conversion rate', unit: '%', base: 18, spread: 3, trend: .01 },
    { key: 'wayAdoption', label: 'Wayfinding adoption rate', unit: '%', base: 12, spread: 2.5, trend: .02 }
  ],
  notifications: [
    { key: 'notifConv', label: 'Notification-to-action conversion rate', unit: '%', base: 5.4, spread: 1.4, trend: .004 }
  ]
};
export const AnalyticsService = {
  get: (category: string, days: number): Promise<Metric[]> => mockCall('analytics', () => (METRICS[category] || []).map(m => {
    const all = series(m.key, days * 2, m.base, m.spread, m.trend, m.weekly || 0);
    const cur = all.slice(-days), prev = all.slice(0, days);
    const avg = (a: Point[]) => a.reduce((s, p) => s + p.y, 0) / a.length;
    const value = m.unit === 'count' && m.key === 'mau' ? cur[cur.length - 1].y : avg(cur);
    const pv = m.unit === 'count' && m.key === 'mau' ? prev[prev.length - 1].y : avg(prev);
    return { ...m, series: cur, value, change: pv ? (value - pv) / pv : 0 };
  }))
};

/* ---------- Sign-in: email and password (MOCK) ----------
   No identity service is connected. Passwords are checked against salted SHA-256 hashes kept in this browser's mock data;
   every sample account starts with SAMPLE_PASSWORD. Reset links are tokens kept in the mock data, single use, valid for
   30 minutes. No email is sent: the prototype shows the link on screen. A real backend replaces these bodies. */
export const RESET_TTL_MS = 30 * 60 * 1000;
async function hashPw(userId: string, pw: string): Promise<string> {
  const data = new TextEncoder().encode(`utsw-admin-mock:${userId}:${pw}`);
  if (globalThis.crypto && crypto.subtle) return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(b => b.toString(16).padStart(2, '0')).join('');
  let h = 2166136261; for (const b of data) h = Math.imul(h ^ b, 16777619); return `fnv-${(h >>> 0).toString(16)}`;   /* no Web Crypto (insecure context) */
}
const authData = () => (DB.db.auth = DB.db.auth || { pw: {}, resets: {} });
const userByEmail = (email: string) => DB.db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase()) || null;
async function pwMatches(userId: string, pw: string): Promise<boolean> {
  const stored = authData().pw[userId];
  return stored ? stored === await hashPw(userId, pw) : pw === SAMPLE_PASSWORD;
}
const newToken = () => [...(globalThis.crypto && crypto.getRandomValues ? crypto.getRandomValues(new Uint8Array(16)) : Array.from({ length: 16 }, () => Math.floor(Math.random() * 256)))].map(b => b.toString(16).padStart(2, '0')).join('');
export const AuthService = {
  /* Resolves the user id, or rejects with one message whatever was wrong, so the page never says which part failed */
  login: async (email: string, pw: string): Promise<string> => {
    const u = userByEmail(email);
    const ok = !!u && u.status === 'active' && await pwMatches(u.id, pw);
    return mockCall('sign-in', () => {
      if (!ok || !u) throw new ServiceError('Invalid credentials. Please try again.');
      u.lastSignIn = nowIso();
      audit('Signed in', `${u.first} ${u.last}`, { targetId: u.id, targetType: 'user' });
      return u.id;
    });
  },
  /* Always succeeds for a well-formed address. Returns the simulated email's link token, or null when no active account uses it */
  requestReset: (email: string) => mockCall('password reset', () => {
    const u = userByEmail(email);
    if (!u || u.status !== 'active') return null;
    const token = newToken();
    authData().resets[token] = { userId: u.id, at: Date.now(), used: false };
    audit('Password reset requested', `${u.first} ${u.last}`, { targetId: u.id, targetType: 'user' });
    return token;
  }),
  /* 'ok' with the account's email, or 'expired' (unknown, used or older than 30 minutes) */
  checkReset: (token: string): { state: 'ok' | 'expired'; email: string | null } => {
    const r = authData().resets[token], u = r ? DB.db.users.find(x => x.id === r.userId) : null;
    if (!r || !u) return { state: 'expired', email: null };
    return { state: r.used || Date.now() - r.at > RESET_TTL_MS ? 'expired' : 'ok', email: u.email };
  },
  resetPassword: async (token: string, pw: string) => {
    const r = authData().resets[token];
    const hash = r ? await hashPw(r.userId, pw) : '';
    return mockCall('password reset', () => {
      if (!r || r.used || Date.now() - r.at > RESET_TTL_MS) throw new ServiceError('This password reset link has expired. Request a new link.');
      if (!pwOk(pw)) throw new ServiceError('The new password doesn’t meet the requirements.');
      authData().pw[r.userId] = hash; r.used = true;
      const u = DB.db.users.find(x => x.id === r.userId)!;
      audit('Password reset', `${u.first} ${u.last}`, { targetId: u.id, targetType: 'user' });
      return true;
    });
  },
  changeOwnPassword: async (current: string, next: string) => {
    const id = actor(), ok = await pwMatches(id, current), hash = await hashPw(id, next);
    return mockCall('password change', () => {
      if (!ok) throw new ServiceError('Your current password isn’t right.');
      if (!pwOk(next)) throw new ServiceError('The new password doesn’t meet the requirements.');
      authData().pw[id] = hash;
      const u = DB.db.users.find(x => x.id === id)!;
      audit('Password changed', `${u.first} ${u.last}`, { targetId: id, targetType: 'user' });
      return true;
    });
  }
};

export const AuditService = { list: () => mockCall('audit', () => DB.db.audit) };
export const PlatformService = {
  integrations: () => mockCall('platform', () => DB.db.integrations),
  check: (id: string) => mockCall('platform', () => { const i = DB.db.integrations.find(x => x.id === id)!; i.lastCheck = nowIso(); audit('Integration check run (simulated)', i.name, { targetType: 'platform' }); return i; }),
  monitoring: (days: number) => mockCall('platform', () => ({
    errors: series('errs', days, 0.42, .3, 0).map(p => ({ x: p.x, y: Math.max(0.05, p.y) })),
    latency: series('lat', days, 420, 90, -.2).map(p => ({ x: p.x, y: Math.round(p.y) })),
    incidents: [
      { at: '2026-10-22T03:10:00Z', title: 'Configuration fetch slow on Android (sample)', severity: 'Minor', status: 'Resolved', minutes: 38 },
      { at: '2026-10-09T15:42:00Z', title: 'MedBlog feed timeout (sample)', severity: 'Minor', status: 'Resolved', minutes: 12 },
      { at: '2026-09-30T11:05:00Z', title: 'Push delivery delayed (sample)', severity: 'Moderate', status: 'Resolved', minutes: 74 }
    ]
  }))
};
export const SettingsService = {
  get: () => mockCall('settings', () => DB.db.settings),
  save: (data: Partial<Settings>) => mockCall('settings', () => {
    needs('adminSettings', 'publish');
    const before = clone(DB.db.settings); Object.assign(DB.db.settings, data);
    audit('Administrative settings changed', 'Administrative settings', { targetType: 'settings', before, after: DB.db.settings });
    return DB.db.settings;
  })
};
