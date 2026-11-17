/* ---------- Utilities: cloning, ids, dates (AP style, Central Time), device storage, live announcements ---------- */
export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
export const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
let idSeq = 0;
export const uid = (p: string): string => `${p}-${Date.now().toString(36)}${(idSeq++).toString(36)}`;

/* AP style dates and times in Central Time (Dallas): Oct. 30, 2026, 9:41 a.m. CT */
export const AP_MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
export const TZ = 'America/Chicago';
interface TzParts { y: string; m: number; d: string; h: number; min: string; pm: boolean }
function tzParts(iso: string): TzParts {
  const d = new Date(iso);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
    .formatToParts(d).map(x => [x.type, x.value]));
  return { y: p.year, m: +p.month - 1, d: p.day, h: +p.hour, min: p.minute, pm: /p/i.test(p.dayPeriod) };
}
function apTime(p: { h: number; min: string; pm: boolean }): string {
  if (p.min === '00' && p.h === 12) return p.pm ? 'noon' : 'midnight';
  return `${p.h}${p.min === '00' ? '' : ':' + p.min} ${p.pm ? 'p.m.' : 'a.m.'}`;
}
export const fmtDate = (iso: string): string => { const p = tzParts(iso); return `${AP_MONTHS[p.m]} ${p.d}, ${p.y}`; };
export const fmtDateTime = (iso: string): string => { const p = tzParts(iso); return `${AP_MONTHS[p.m]} ${p.d}, ${p.y}, ${apTime(p)} CT`; };

/* Device storage: always wrapped, the page works without it (private windows, previews) */
export const STORE_KEY = 'utsw-admin-mock-v1';
export const store = {
  read<T = unknown>(): T | null { try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null') || null; } catch (e) { return null; } },
  write(v: unknown): void { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch (e) { /* storage unavailable: keep working in memory */ } },
  clear(): void { try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ } }
};
/* Per-browser conveniences (sidebar rail), never required */
export const pref = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k: string, v: string): void { try { localStorage.setItem(k, v); } catch (e) { /* not stored */ } }
};

/* Screen reader announcements (polite) */
export function announce(msg: string): void {
  const el = document.getElementById('sr-live'); if (!el) return;
  el.textContent = '';
  setTimeout(() => { el.textContent = msg; }, 30);
}
const pluralize = (w: string): string => /[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies' : /(s|x|ch|sh)$/.test(w) ? w + 'es' : w + 's';
export const plural = (n: number, one: string, many: string = pluralize(one)): string => `${n} ${n === 1 ? one : many}`;

/* Local Central Time date-times stored as 'YYYY-MM-DDTHH:MM' (what a datetime-local field gives) */
export function nowLocal(): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function fmtLocal(s: string | null | undefined, withYear = true): string {
  if (!s) return '–';
  const [d, tm = '00:00'] = s.split('T'), [y, m, day] = d.split('-').map(Number), [h, min] = tm.split(':').map(Number);
  const p = { h: h % 12 || 12, min: String(min).padStart(2, '0'), pm: h >= 12 };
  return `${AP_MONTHS[m - 1]} ${day}${withYear ? `, ${y}` : ''}, ${h === 12 && !min ? 'noon' : h === 0 && !min ? 'midnight' : apTime(p)}`;
}
export const fmtDay = (s: string): string => { const [, m, d] = s.split('-').map(Number); return `${AP_MONTHS[m - 1]} ${d}`; };
export type WindowStatus = 'off' | 'upcoming' | 'ended' | 'active';
/* Scheduled content status from its window */
export function windowStatus(d: { enabled?: boolean; start?: string; end?: string }): WindowStatus {
  if (d.enabled === false) return 'off';
  const n = nowLocal();
  if (d.start && n < d.start) return 'upcoming';
  if (d.end && n > d.end) return 'ended';
  return 'active';
}
export type Unit = 'count' | '%' | 's' | 'ms';
export const fmtNum = (v: number, unit: Unit | string): string => unit === 'count' ? Math.round(v).toLocaleString('en-US') : unit === '%' ? `${v.toFixed(1)}%` : unit === 's' ? `${v.toFixed(2)} s` : unit === 'ms' ? `${Math.round(v)} ms` : String(v);
export const debounce = <A extends unknown[]>(fn: (...a: A) => void, ms = 150) => { let t: ReturnType<typeof setTimeout>; return (...a: A) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(' ');
