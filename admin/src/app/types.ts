/* ---------- Shared types: configuration records, their lifecycle, and the other mock collections ---------- */
import type { Role } from './permissions';

export type Env = 'draft' | 'demo' | 'production';
export type ConfigType = 'homeLayout' | 'campaign' | 'alert' | 'quickLink' | 'featuredCard' | 'drawer' | 'globalColors' | 'appEntry'
  | 'searchMappings' | 'searchSynonyms' | 'searchSpecialties' | 'searchTop' | 'searchRanking' | 'segment' | 'locations'
  | 'facilityWhy' | 'facilityNearby' | 'facilityPlaces' | 'wayfinding3d';

export interface Version<T = Data> { version: number; data: T; updatedBy: string; updatedAt: string; comment: string; rollbackOf?: number }
export interface Draft<T = Data> { data: T; updatedBy: string; updatedAt: string; comment: string; baseVersion: number | null; changesRequested?: string }
export interface Review { by: string; at: string; comment: string }
export interface LifecycleEvent { id: string; action: string; environment: Env | null; version: number | null; by: string; at: string; comment: string }
/* Config data differs per type (layout, campaign, alert…), so records carry a loosely typed data object */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Data = Record<string, any>;
export interface ConfigRecord<T = Data> {
  id: string; type: ConfigType; name: string;
  versions: Record<number, Version<T>>; production: number | null; demo: number | null;
  draft: Draft<T> | null; review: Review | null; nextVersion: number; events: LifecycleEvent[];
}

export interface Destination { type: 'screen' | 'mychart' | 'url' | 'phone' | 'none'; value: string }
export interface LayoutModule { id: string; on: boolean }
export interface LayoutData { head: string[]; modules: LayoutModule[] }

export interface User { id: string; first: string; last: string; email: string; role: Role; status: 'active' | 'invited' | 'deactivated'; created: string; lastSignIn: string | null }
export interface NoteVersion { version: number; data: Data; at: string; by: string; comment: string }
export interface Notification {
  id: string; title: string; description: string; sendTo: string; timing: 'now' | 'scheduled'; scheduledAt: string; image: string; imageAlt: string; videoUrl: string;
  destination: Destination; status: 'draft' | 'scheduled' | 'sent' | 'cancelled'; createdBy: string; createdAt: string; updatedAt: string; sentAt: string | null;
  stats: { delivered: number; opened: number; actions: number } | null; versions?: NoteVersion[];
}
export interface WayVersion { version: number; fileName: string; sizeKb: number; by: string; at: string; status: string; buildings: number; floors: number; destinations: number; comment: string; warnings: number }
export interface WayHistory { at: string; by: string; action: string; version: number; environment: string; comment: string }
export interface Wayfinding { production: number | null; demo: number | null; versions: WayVersion[]; history: WayHistory[] }
export interface Integration { id: string; name: string; purpose: string; status: string; detail: string; lastCheck?: string }
export interface Settings { sessionTimeout: number; timeZone: string; requirePublishComment: boolean; previewDefault: string; [k: string]: unknown }
export interface AuditEntry { id: string; at: string; by: string; action: string; target: string; targetId: string | null; targetType: string | null; environment: string | null; version: number | null; comment: string; before: unknown; after: unknown }
export interface ZeroResult { id: string; query: string; count: number; lastSeen: string; status: 'open' | 'resolved' | 'dismissed' }

export interface Db {
  schema: number; records: Record<string, ConfigRecord>; users: User[]; notifications: Notification[]; wayfinding: Wayfinding;
  integrations: Integration[]; settings: Settings; audit: AuditEntry[]; zeroResults: ZeroResult[];
  /* MOCK sign-in data: salted SHA-256 password hashes (only for passwords changed from the sample one) and reset links */
  auth?: { pw: Record<string, string>; resets: Record<string, ResetLink> };
}
export interface ResetLink { userId: string; at: number; used: boolean }
export interface SessionState { userId: string; role: Role; startedAt: number; lastActive: number }
export interface Store { db: Db; session: SessionState | null; prefs: { simulateErrors?: boolean; [k: string]: unknown } }

export interface Point { x: string; y: number }
export interface Metric { key: string; label: string; unit: string; base: number; spread: number; trend: number; weekly?: number; lowerBetter?: boolean; smooth?: boolean; series: Point[]; value: number; change: number }
