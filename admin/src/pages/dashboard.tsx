/* ---------- Dashboard ----------
   Headline numbers, then what patients see now (a live phone and the facts behind it) beside what's coming up
   and recent activity. Metrics are sample data; the rest reads the mock services.
   Numbers count up and cards ease in – both skipped under reduced motion. */
/* EXTRA_GLYPHS: trending_flat trending_up trending_down event_available bolt favorite add warning history notifications campaign lock */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { PageProps } from '../app/App';
import { PageHead, initials } from '../app/Shell';
import { Session } from '../app/session';
import { can, type Area } from '../app/permissions';
import { useLoad } from '../app/useLoad';
import { AnalyticsService, ConfigService, DB, NotificationService, UserService, WayfindingService, dataAt, latestData, recLink } from '../services/services';
import { ErrorState, Icon, LoadingState } from '../ui/kit';
import { PhoneFrame, appContent, colorsFor, layoutFor } from '../ui/preview';
import { AP_MONTHS, fmtDate, fmtLocal, fmtNum, nowLocal, plural, windowStatus } from '../app/util';
import type { Metric } from '../app/types';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const localDay = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const longDate = (s: string) => { const dt = localDay(s); return `${WEEKDAYS[dt.getUTCDay()]}, ${AP_MONTHS[dt.getUTCMonth()]} ${dt.getUTCDate()}`; };
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${plural(mins, 'minute')} ago`;
  if (mins < 60 * 24) return `${plural(Math.round(mins / 60), 'hour')} ago`;
  if (mins < 60 * 48) return 'Yesterday';
  if (mins < 60 * 24 * 7) return `${Math.round(mins / 1440)} days ago`;
  return fmtDate(iso).replace(/, \d{4}$/, '');
}
/* Change versus the previous period: an arrow and a word as well as color */
export function Delta({ m, onBlue = false }: { m: Metric; onBlue?: boolean }) {
  const pct = m.change * 100, cls = onBlue ? 'delta on-blue' : 'delta';
  if (Math.abs(pct) < .05) return <span className={`${cls} flat`}><Icon name="trending_flat" size={16} />No change</span>;
  const up = pct > 0, good = m.lowerBetter ? !up : up;
  return <span className={`${cls} ${good ? 'good' : 'bad'}`}><Icon name={up ? 'trending_up' : 'trending_down'} size={16} />{up ? '+' : '−'}{Math.abs(pct).toFixed(1)}%<span className="vh">, {good ? 'better' : 'worse'} than the previous 30 days</span></span>;
}
/* Audit actions read as sentences after the person's name */
const VERBS: Record<string, string> = { 'Draft saved': 'saved a draft of', 'Review requested': 'requested a review of', 'Created as draft': 'created', 'Draft discarded': 'discarded the draft of', 'Deleted draft': 'deleted', 'Changes requested': 'requested changes to', 'User invited': 'invited', 'Role changed': 'changed the role of', 'User updated': 'updated', 'Profile updated': 'updated their profile:', 'User deactivated': 'deactivated', 'User reactivated': 'reactivated', 'User deleted': 'deleted the account of', 'Invitation resent': 'resent the invitation to', 'Notification created': 'created the notification', 'Notification edited': 'edited the notification', 'Notification scheduled': 'scheduled', 'Notification cancelled': 'cancelled', 'Notification duplicated': 'duplicated', 'Notification deleted': 'deleted the notification', 'Wayfinding file uploaded': 'uploaded the wayfinding file', 'Administrative settings changed': 'changed', 'Integration check run (simulated)': 'ran a check on' };
/* Sign-in and password events stay in the audit log but not in the activity feed */
const AUTH_ACTIONS = ['Signed in', 'Password reset requested', 'Password reset', 'Password changed'];
const activityVerb = (a: string) => VERBS[a] || a.charAt(0).toLowerCase() + a.slice(1);
/* Each person keeps one avatar style */
const AVATAR_TONES = ['tone-a', 'tone-b', 'tone-c'];
const avatarTone = (id: string) => AVATAR_TONES[[...String(id)].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_TONES.length];

/* A number that counts up to its value */
function CountUp({ value, unit }: { value: number; unit: string }) {
  const [shown, setShown] = useState(reducedMotion() ? value : 0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (reducedMotion()) { setShown(value); return; }
    const t0 = performance.now(), dur = 900; let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      setShown(unit === 'count' ? Math.round(value * e) : value * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, unit]);
  return <span ref={ref} data-count={value} data-unit={unit}>{fmtNum(shown, unit)}</span>;
}
const io = (i: number) => ({ '--i': i } as CSSProperties);

export function DashboardPage(_: PageProps) {
  const role = Session.role()!;
  const quick = ([['home-alerts-new', 'Emergency alert', 'alerts'], ['home-campaigns-new', 'Campaign', 'campaigns'], ['notifications-new', 'Notification', 'notifications']] as [string, string, Area][])
    .filter(q => can(role, q[2], 'draft'));
  const [load, retry] = useLoad(() => Promise.all([ConfigService.list(), Promise.all(['adoption', 'content', 'search'].map(c => AnalyticsService.get(c, 30))), NotificationService.list(), WayfindingService.get()]));
  return (
    <div className="page db">
      <PageHead crumbs={[]} title="Dashboard" lede={longDate(nowLocal())}
        actions={quick.length ? <>{quick.map(([href, label]) => <a key={href} className="btn btn-secondary" href={`#${href}`}><Icon name="add" size={20} /><span className="lbl">{label}</span></a>)}</> : null}
        extra={__DASHBOARD_ONLY__ ? <p className="note-line dash-note"><Icon name="lock" size={20} /><span>Dashboard preview. Other pages aren’t available in this file.</span></p> : null} />
      {load.status !== 'ok' ? <><div className="db-stats" id="db-stats"></div>
        <div id="db" className="db-body">{load.status === 'loading' ? <LoadingState text="Loading the dashboard" /> : <ErrorState msg={load.error} onRetry={retry} />}</div></>
        : <Body data={load.data} />}
    </div>
  );
}

type Loaded = [Awaited<ReturnType<typeof ConfigService.list>>, Metric[][], Awaited<ReturnType<typeof NotificationService.list>>, Awaited<ReturnType<typeof WayfindingService.get>>];
function Body({ data: [recs, metrics, notes, way] }: { data: Loaded }) {
  const role = Session.role()!;
  const flat = metrics.flat(), pick = (k: string) => flat.find(m => m.key === k)!;
  const now = nowLocal();
  const live = recs.filter(r => r.type === 'alert').map(r => ({ r, d: dataAt(r, 'production') })).filter(x => x.d && x.d.enabled && windowStatus(x.d) === 'active');
  const liveCamp = recs.filter(r => r.type === 'campaign').map(r => ({ r, d: dataAt(r, 'production') })).find(x => x.d && x.d.enabled && windowStatus(x.d) === 'active');
  const guest = recs.find(r => r.id === 'home-layout-guest');
  const prodWay = way.versions.find(v => v.version === way.production);
  const in30 = (() => { const d = localDay(now); d.setUTCDate(d.getUTCDate() + 30); return d.toISOString().slice(0, 10); })();
  const soon = (s?: string) => !!s && s > now && s.slice(0, 10) <= in30;
  const upcoming = [
    ...notes.filter(n => n.status === 'scheduled' && soon(n.scheduledAt)).map(n => ({ at: n.scheduledAt, icon: 'notifications', what: 'Notification sends', t: n.title, href: `notifications-${n.id}` })),
    ...recs.filter(r => r.type === 'campaign').flatMap(r => { const d = latestData(r); return [
      ...(soon(d.start) ? [{ at: d.start as string, icon: 'campaign', what: 'Campaign starts', t: r.name, href: recLink(r) }] : []),
      ...(soon(d.end) && windowStatus(d) === 'active' ? [{ at: d.end as string, icon: 'campaign', what: 'Campaign ends', t: r.name, href: recLink(r) }] : [])]; }),
    ...recs.filter(r => r.type === 'alert').map(r => ({ r, d: latestData(r) })).filter(x => x.d.enabled && soon(x.d.start)).map(x => ({ at: x.d.start as string, icon: 'warning', what: 'Emergency alert starts', t: x.r.name, href: recLink(x.r) }))
  ].sort((a, b) => a.at.localeCompare(b.at)).slice(0, 4);
  const recent = [...DB.db.audit].filter(a => !AUTH_ACTIONS.includes(a.action)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4);
  const heroStats = ['dau', 'mau', 'searchSuccess', 'crashFree'].map(pick);
  const statLinks = ['analytics-adoption', 'analytics-adoption', 'analytics-search', 'analytics-content'];
  return (
    <>
      {/* Headline numbers */}
      <div className="db-stats" id="db-stats">{heroStats.map((m, i) => (
        <a key={m.key} className="db-stat" href={`#${statLinks[i]}`}><span className="db-stat-l">{m.label}</span><span className="db-stat-v"><CountUp value={m.value} unit={m.unit} /></span><span className="db-stat-f"><Delta m={m} /></span></a>))}</div>
      <div id="db" className="db-body">
        {live.length > 0 && <section className="db-live db-in" style={io(0)} aria-labelledby="dl-h"><span className="db-live-ic"><Icon name="warning" size={20} className="f1" /></span><h2 id="dl-h" className="vh">Live emergency alerts</h2>
          <ul>{live.map(x => <li key={x.r.id}><span className="db-live-k"><i className="pulse white" aria-hidden="true"></i>Live now</span><a href={`#home-alerts-${x.r.id}`}>{x.d!.title}</a><span className="db-live-t">until {fmtLocal(x.d!.end).split(', ').pop()}</span></li>)}</ul></section>}
        <div className="db-grid">
          <section className="card db-card db-now db-in ga-n" style={io(1)} aria-labelledby="dn-h">
            <div className="db-card-head"><h2 id="dn-h"><i className="pulse" aria-hidden="true"></i>Right now in the app</h2><a className="text-link small" href="#home-layout">Edit layout</a></div>
            <div className="db-now-body">
              <div className="db-phone" id="db-phone"><PhoneFrame title="What patients see on the guest home screen now"
                payload={{ screen: 'home', audience: 'guest', layout: layoutFor('guest'), colors: colorsFor('production'), content: appContent({ audience: 'guest' }), label: 'production guest home, live now' }} /></div>
              <ul className="db-facts">
                <li><span className="db-f-k">Campaign showing</span><span className="db-f-v">{liveCamp ? <a href={`#${recLink(liveCamp.r)}`}>{liveCamp.r.name}</a> : 'None'}</span></li>
                <li><span className="db-f-k">Emergency alerts</span><span className="db-f-v">{live.length ? `${plural(live.length, 'alert')} live` : 'None live'}</span></li>
                <li><span className="db-f-k">Guest layout</span><span className="db-f-v"><a href="#home-layout">Version {guest?.production}</a></span></li>
                <li><span className="db-f-k">Indoor maps</span><span className="db-f-v"><a href="#wayfinding">Version {prodWay?.version}</a></span></li>
              </ul>
            </div>
          </section>
          <section className="card db-card db-in ga-u" style={io(2)} aria-labelledby="du-h">
            <div className="db-card-head"><h2 id="du-h">Coming up</h2><span className="muted small">Next 30 days</span></div>
            {upcoming.length ? <ol className="db-time">{upcoming.map((x, i) => { const d = localDay(x.at); return (
              <li key={i}><span className="db-date-tile" aria-hidden="true"><span>{AP_MONTHS[d.getUTCMonth()].replace('.', '')}</span><b>{d.getUTCDate()}</b></span>
                <span className="db-q-t"><span className="db-q-k"><Icon name={x.icon} size={16} />{x.what}</span><a href={`#${x.href}`}>{x.t}</a><span className="muted">{WEEKDAYS[d.getUTCDay()]}, {fmtLocal(x.at).split(', ').pop()}</span></span></li>); })}</ol>
              : <div className="db-empty"><Icon name="event_available" size={24} /><p>Nothing scheduled in the next 30 days.</p></div>}
          </section>
          <section className="card db-card db-in ga-a" style={io(3)} aria-labelledby="dr-h">
            <div className="db-card-head"><h2 id="dr-h">Recent activity</h2>{can(role, 'audit', 'view') && <a className="text-link small" href="#audit">Audit log</a>}</div>
            {!recent.length && <div className="db-empty"><Icon name="history" size={24} /><p>No activity yet. Changes and publishing appear here.</p></div>}
            <ul className="db-feed" hidden={!recent.length}>{recent.map(a => { const who = UserService.byId(a.by); return (
              <li key={a.id}><span className={`avatar sm ${avatarTone(a.by)}`} aria-hidden="true">{who ? initials(who) : '?'}</span>
                <span className="db-feed-t"><span><b>{UserService.name(a.by)}</b> {activityVerb(a.action)}</span><span className="db-feed-o">{a.target}</span></span>
                <time className="db-feed-w" dateTime={a.at}>{ago(a.at)}</time></li>); })}</ul>
          </section>
        </div>
      </div>
    </>
  );
}
