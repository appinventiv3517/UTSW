/* ---------- Analytics and reporting ----------
   MOCK DATA: deterministic sample series. No analytics source is connected and metric definitions are pending (§10.15).
   The presentation reads only AnalyticsService, so a real source replaces the service, not these pages. */
/* EXTRA_GLYPHS: database monitoring edit apps search login newspaper campaign library_books feed */
import { useState } from 'react';
import type { Page, PageProps } from '../app/App';
import { PageHead } from '../app/Shell';
import { useLoad } from '../app/useLoad';
import { AnalyticsService, ANALYTICS_END, DB } from '../services/services';
import { STATIC_CONTENT } from '../mock/seed';
import { Badge, EmptyState, ErrorState, Icon, LoadingState, Segmented } from '../ui/kit';
import { Select } from '../ui/Select';
import { DataTable } from '../ui/DataTable';
import { BarList, LineChart, MetricTile } from '../ui/charts';
import { layoutFor } from '../ui/preview';
import { fmtDate, fmtDay } from '../app/util';
import type { Notification } from '../app/types';

const ANALYTICS_PAGES: Record<string, { cat: string; title: string; chart: string }> = {
  'analytics-adoption': { cat: 'adoption', title: 'Adoption and engagement', chart: 'dau' },
  'analytics-search': { cat: 'search', title: 'Search', chart: 'searchSuccess' },
  'analytics-content': { cat: 'content', title: 'Content', chart: 'articleEng' },
  'analytics-care': { cat: 'care', title: 'Care and wayfinding', chart: 'findCareConv' },
  'analytics-notifications': { cat: 'notifications', title: 'Notifications', chart: 'notifConv' }
};
/* The date range and the charted metric are remembered while the Admin is open */
let analyticsDays = 30;
const chosenMetric: Record<string, string> = {};
const MockNote = () => <p className="note-line"><Icon name="database" size={20} /><span>Sample data for the prototype. No analytics source is connected, and metric definitions are pending UTSW confirmation.</span></p>;

const articleRows = (days: number) => STATIC_CONTENT.blog.map((f, i) => ({ t: f.t, kick: f.cat, views: [18420, 15230, 12110, 9870, 7640][i] * days / 30, read: [252, 296, 351, 188, 247][i] }));
type Art = ReturnType<typeof articleRows>[number];
function Extra({ cat, days }: { cat: string; days: number }) {
  if (cat === 'search') {
    const z = [...DB.db.zeroResults].filter(x => x.status === 'open').sort((a, b) => b.count - a.count).slice(0, 6);
    return <section className="card"><div className="card-head"><h2>Top zero-result searches</h2><div className="card-actions"><a className="text-link" href="#search-zero-results">Fix them</a></div></div>
      <div className="card-body">{z.length ? <BarList rows={z.map(x => ({ label: `“${x.query}”`, value: x.count }))} /> : <p className="muted">No open zero-result searches.</p>}</div></section>;
  }
  if (cat === 'content') return (
    <section className="card"><div className="card-head"><h2>MedBlog articles</h2></div><div className="card-body" id="an-art">
      <DataTable<Art> id="art" caption="MedBlog articles" noun="article" rows={articleRows(days)} defaultSort={{ key: 'views', dir: 'desc' }} searchText={r => `${r.t} ${r.kick}`} rowKey={r => r.t}
        empty={{ title: 'No articles' }}
        columns={[{ key: 't', label: 'Article', render: r => r.t, cls: 'wrap' }, { key: 'kick', label: 'Topic', render: r => r.kick },
          { key: 'views', label: 'Views', sortable: true, render: r => Math.round(r.views).toLocaleString('en-US'), cls: 'num' },
          { key: 'read', label: 'Avg. reading time', sortable: true, render: r => `${Math.floor(r.read / 60)} min ${String(r.read % 60).padStart(2, '0')} s`, cls: 'num' }]} />
    </div></section>
  );
  if (cat === 'care') {
    const b = ([['Clements University Hospital', 9120], ['Zale Lipshy Pavilion', 6340], ['Sample Outpatient Building', 4210], ['UTSW RedBird (sample)', 1180]] as [string, number][]).map(([label, v]) => ({ label, value: Math.round(v * days / 30) }));
    return <section className="card"><div className="card-head"><h2>Top buildings</h2></div><div className="card-body"><BarList rows={b} /></div></section>;
  }
  if (cat === 'notifications') return (
    <section className="card"><div className="card-head"><h2>Sent notifications</h2></div><div className="card-body" id="an-notes">
      <DataTable<Notification> id="ann" caption="Sent notifications" noun="notification" rows={DB.db.notifications.filter(n => n.stats && n.stats.delivered)} defaultSort={{ key: 'conv', dir: 'desc' }} searchText={n => n.title} rowKey={n => n.id}
        empty={{ icon: 'notifications', title: 'No sent notifications', text: '' }}
        columns={[{ key: 'title', label: 'Notification', render: n => <a className="row-link" href={`#notifications-${n.id}`}>{n.title}</a> }, { key: 'sent', label: 'Sent', render: n => fmtDate(n.sentAt!) },
          { key: 'delivered', label: 'Delivered', sortable: true, sortValue: n => n.stats!.delivered, render: n => n.stats!.delivered.toLocaleString('en-US'), cls: 'num' },
          { key: 'opened', label: 'Opened', sortable: true, sortValue: n => n.stats!.opened / n.stats!.delivered, render: n => `${(n.stats!.opened / n.stats!.delivered * 100).toFixed(1)}%`, cls: 'num' },
          { key: 'conv', label: 'Took action', sortable: true, sortValue: n => n.stats!.actions / n.stats!.delivered, render: n => `${(n.stats!.actions / n.stats!.delivered * 100).toFixed(1)}%`, cls: 'num' }]} />
    </div></section>
  );
  return null;
}

function analyticsPage(key: string): Page {
  const def = ANALYTICS_PAGES[key];
  return function AnalyticsPage(_: PageProps) {
    const [days, setDays] = useState(analyticsDays);
    const [metric, setMetric] = useState(chosenMetric[key] || def.chart);
    const [load, retry] = useLoad(() => AnalyticsService.get(def.cat, days), [days, metric]);
    const pickDays = (v: string) => { analyticsDays = +v; setDays(+v); };
    const pickMetric = (v: string) => { chosenMetric[key] = v; setMetric(v); requestAnimationFrame(() => document.getElementById('an-metric-dd')?.focus()); };
    const ms = load.status === 'ok' ? load.data : [];
    const sel = ms.find(m => m.key === metric) || ms[0];
    return (
      <div className="page">
        <PageHead crumbs={[['Analytics and reporting', null]]} title={def.title} badges={<Badge kind="mock" />} />
        <MockNote />
        <div className="range"><span className="pv-k" id="rng-l">Date range</span>
          <Segmented id="rng" label="Date range" options={[['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days']]} value={String(days)} onChange={pickDays} />
          <span className="muted range-end">Ending {fmtDay(ANALYTICS_END)}, 2026</span></div>
        <div id="an-body" aria-live="polite" aria-busy={load.status === 'loading'}>
          {load.status === 'loading' ? <LoadingState text="Loading metrics" />
            : load.status === 'error' ? <ErrorState msg={load.error} onRetry={retry} />
            : !ms.length ? <EmptyState icon="monitoring" title="No data for this range" text="Try a longer date range." />
            : <>
              <div className="metric-row">{ms.map(m => <MetricTile key={m.key} m={m} />)}</div>
              <section className="card"><div className="card-head"><h2 id="an-ch-h">{sel.label}</h2>
                {ms.length > 1 && <div className="card-actions"><label className="vh" htmlFor="an-metric-dd" id="an-metric-lbl">Metric to chart</label>
                  <Select id="an-metric" className="input input-sm" labelId="an-metric-lbl" options={ms.map(m => [m.key, m.label])} value={sel.key} onChange={pickMetric} /></div>}</div>
                <div className="card-body"><p className="chart-sub">Daily, last {days} days{sel.lowerBetter ? ' · lower is better' : ''}</p>
                  <div id="an-chart"><LineChart key={`${sel.key}-${days}`} points={sel.series} unit={sel.unit} label={sel.label} /></div></div></section>
              <Extra cat={def.cat} days={days} />
            </>}
        </div>
      </div>
    );
  };
}

/* Home screen overview: how patients use each home module (sample data).
   One measure (share of taps), so one hue; values are printed on every row, the bars only help compare. */
const HOME_CLICK_SHARE = [
  { id: 'tiles', label: 'Quick links', icon: 'apps', share: 34.6 },
  { id: 'search', label: 'Search and top searches', icon: 'search', share: 30.2 },
  { id: 'mychart', label: 'MyChart sign-in card', icon: 'login', share: 11.8 },
  { id: 'featured', label: 'MedBlog', icon: 'newspaper', share: 9.4 },
  { id: 'campaign', label: 'Campaign banner', icon: 'campaign', share: 7.1 },
  { id: 'services', label: 'Services and resources', icon: 'library_books', share: 5.0 },
  { id: 'news', label: 'Announcements', icon: 'feed', share: 1.9 }
];
function HomeOverviewPage(_: PageProps) {
  const rows = [...HOME_CLICK_SHARE].sort((a, b) => b.share - a.share);
  const guest = ((layoutFor('guest').modules || []) as { id: string; on: boolean }[]).filter(m => m.on !== false).map(m => m.id);
  const where = (r: typeof rows[number]) => r.id === 'search' ? 'Pinned below alerts' : guest.includes(r.id) ? `Position ${guest.indexOf(r.id) + 1} on the guest home` : 'Not on the guest home';
  const top = rows[0], top2 = rows[0].share + rows[1].share, low = rows[rows.length - 1], max = top.share;
  const Tile = ({ k, v, sub }: { k: string; v: string; sub: string }) => <div className="metric hs-stat"><p className="metric-l">{k}</p><p className="metric-v">{v}</p><p className="metric-c">{sub}</p></div>;
  return (
    <div className="page">
      <PageHead crumbs={[['Analytics and reporting', null]]} title="Home screen overview" badges={<Badge kind="mock" />} lede="Which home screen modules patients tap, as a share of all home screen taps." />
      <MockNote />
      <div className="metric-row">
        <Tile k="Most tapped" v={top.label} sub={`${top.share.toFixed(1)}% of home screen taps`} />
        <Tile k="Top two modules" v={`${top2.toFixed(1)}%`} sub={`of home screen taps go to ${rows[0].label.toLowerCase()} and ${rows[1].label.split(' ')[0].toLowerCase()}`} />
        <Tile k="Least tapped" v={low.label} sub={`${low.share.toFixed(1)}% of home screen taps`} />
      </div>
      <section className="card" aria-labelledby="hs-h"><div className="card-head"><h2 id="hs-h">Click-through share by module</h2><div className="card-actions"><a className="btn btn-text btn-sm" href="#home-layout"><Icon name="edit" size={20} /><span className="lbl">Edit the layout</span></a></div></div>
        <div className="card-body">
          <ol className="hs-list" aria-label="Modules, most tapped first">{rows.map((r, i) => (
            <li key={r.id} className="hs-row" title={`${r.label}: ${r.share.toFixed(1)}% of home screen taps`}>
              <span className="hs-rank" aria-hidden="true">{i + 1}</span>
              <span className="hs-ic" aria-hidden="true"><Icon name={r.icon} size={20} /></span>
              <span className="hs-txt"><span className="hs-name">{r.label}</span><span className="hs-where">{where(r)}</span></span>
              <span className="hs-track" aria-hidden="true"><span className="hs-fill" style={{ width: `${(r.share / max * 100).toFixed(1)}%` }}></span></span>
              <span className="hs-v">{r.share.toFixed(1)}%<span className="vh"> of home screen taps</span></span>
            </li>))}</ol>
          <p className="chart-sub hs-foot">Share of all taps on the home screen in the last 30 days. Shares add up to 100%.</p>
        </div></section>
    </div>
  );
}

export const analyticsPages: Record<string, Page> = {
  ...Object.fromEntries(Object.keys(ANALYTICS_PAGES).map(k => [k, analyticsPage(k)])),
  'analytics-home': HomeOverviewPage
};
