/* ---------- Charts: inline SVG, colored from theme tokens, single series per chart (one axis) ----------
   Line: 2px line, light area, recessive grid, endpoint marker with its value, crosshair + tooltip on hover
   and with the arrow keys, and a data table for screen readers and anyone who wants the numbers. */
/* EXTRA_GLYPHS: trending_up trending_down */
import { useEffect, useRef, useState } from 'react';
import { Icon } from './kit';
import { announce, fmtDay, fmtNum } from '../app/util';
import type { Point, Metric } from '../app/types';

function niceTicks(min: number, max: number, n = 4): number[] {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0)!;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(6));
  return out;
}
const tickFmt = (v: number, unit: string) => unit === 'count' ? (v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(v)) : unit === '%' ? `${+v.toFixed(1)}%` : unit === 's' ? `${+v.toFixed(2)} s` : unit === 'ms' ? `${v} ms` : String(v);

export function LineChart({ points, unit, label, height = 220, zeroBase = false }: { points: Point[]; unit: string; label: string; height?: number; zeroBase?: boolean }) {
  const plot = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(600);
  const [idx, setIdx] = useState<number | null>(null);
  useEffect(() => {
    const el = plot.current!; setW(Math.max(280, el.clientWidth));
    if (!window.ResizeObserver) return;
    let t: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => setW(Math.max(280, el.clientWidth)), 80); });
    ro.observe(el);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, []);
  const H = height, m = { l: 52, r: 56, t: 14, b: 28 }, n = points.length;
  const ys = points.map(p => p.y);
  const ticks = niceTicks(zeroBase ? 0 : Math.min(...ys), Math.max(...ys));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const X = (i: number) => m.l + (i / Math.max(1, n - 1)) * (W - m.l - m.r), Y = (v: number) => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  const xt = [...new Set([0, Math.round((n - 1) / 3), Math.round(2 * (n - 1) / 3), n - 1])];
  const last = points[n - 1];
  const show = (i: number, fromKey = false) => {
    const k = Math.max(0, Math.min(n - 1, i)); setIdx(k);
    if (fromKey) announce(`${fmtDay(points[k].x)}: ${fmtNum(points[k].y, unit)}`);
  };
  const cur = idx == null ? null : points[idx];
  const cx = idx == null ? 0 : X(idx), cy = cur ? Y(cur.y) : 0;
  return (
    <div className="chart">
      <div className="chart-plot" ref={plot} tabIndex={0} role="img"
        aria-label={`${label}: ${n} days, from ${fmtNum(points[0].y, unit)} on ${fmtDay(points[0].x)} to ${fmtNum(last.y, unit)} on ${fmtDay(last.x)}. Use the left and right arrow keys to read each day.`}
        onPointerMove={e => { const r = plot.current!.getBoundingClientRect(), x = e.clientX - r.left; show(Math.round((x - m.l) / (W - m.l - m.r) * (n - 1))); }}
        onPointerLeave={() => setIdx(null)} onBlur={() => setIdx(null)}
        onKeyDown={e => {
          const d = ({ ArrowRight: 1, ArrowLeft: -1, Home: -1e9, End: 1e9 } as Record<string, number>)[e.key];
          if (d != null) { e.preventDefault(); show(Math.abs(d) > 1 ? (d < 0 ? 0 : n - 1) : (idx ?? n - 1) + d, true); }
        }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {ticks.map(t => <g key={t}><line x1={m.l} x2={W - m.r} y1={Y(t)} y2={Y(t)} className="c-grid" /><text x={m.l - 8} y={Y(t) + 4} textAnchor="end" className="c-axis">{tickFmt(t, unit)}</text></g>)}
          {xt.map(i => <text key={i} x={X(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="c-axis">{fmtDay(points[i].x)}</text>)}
          <path d={`${line}L${X(n - 1)},${Y(y0)}L${X(0)},${Y(y0)}Z`} className="c-area" />
          <path d={line} className="c-line" pathLength={1} />
          <circle cx={X(n - 1)} cy={Y(last.y)} r={4} className="c-end" />
          <text x={X(n - 1) + 8} y={Y(last.y) + 4} className="c-endl">{tickFmt(+last.y.toFixed(unit === 'count' ? 0 : 1), unit)}</text>
          <g className="c-cross" visibility={cur ? undefined : 'hidden'}><line className="c-xline" x1={cx} x2={cx} y1={m.t} y2={H - m.b} /><circle r={5} className="c-dot" cx={cx} cy={cy} /></g>
        </svg>
      </div>
      <div className="chart-tip" hidden={!cur} style={cur ? { left: `${Math.min(Math.max(cx, 70), W - 70)}px`, top: `${Math.max(0, cy - 56)}px` } : undefined}>
        {cur && <><span className="tip-d">{fmtDay(cur.x)}</span><span className="tip-v">{fmtNum(cur.y, unit)}</span></>}
      </div>
      <details className="chart-table"><summary>Show data table</summary>
        <div className="tbl-wrap" tabIndex={0} role="region" aria-label={`${label} data`}><table className="tbl"><caption className="vh">{label}</caption>
          <thead><tr><th scope="col">Date</th><th scope="col" className="num">{label}</th></tr></thead>
          <tbody>{points.map(p => <tr key={p.x}><th scope="row">{fmtDay(p.x)}</th><td className="num">{fmtNum(p.y, unit)}</td></tr>)}</tbody></table></div>
      </details>
    </div>
  );
}

/* Horizontal bars: a labeled list, readable without the bars */
export function BarList({ rows, unit = 'count', max }: { rows: { label: string; value: number }[]; unit?: string; max?: number }) {
  const top = max || Math.max(...rows.map(r => r.value), 1);
  return (
    <ul className="bars">{rows.map(r => (
      <li key={r.label}><span className="bar-l">{r.label}</span><span className="bar-track" aria-hidden="true"><span className="bar-fill" style={{ width: `${Math.max(2, r.value / top * 100)}%` }}></span></span><span className="bar-v">{fmtNum(r.value, unit)}</span></li>))}
    </ul>
  );
}

export function MetricTile({ m }: { m: Pick<Metric, 'label' | 'value' | 'unit' | 'change' | 'lowerBetter'> }) {
  const up = m.change >= 0, good = m.lowerBetter ? !up : up;
  return (
    <div className="metric">
      <p className="metric-l">{m.label}</p>
      <p className="metric-v">{fmtNum(m.value, m.unit)}</p>
      <p className={`metric-c ${good ? 'good' : 'bad'}`}><Icon name={up ? 'trending_up' : 'trending_down'} size={16} />
        <span>{up ? '+' : '−'}{Math.abs(m.change * 100).toFixed(1)}%<span className="vh"> compared with the previous period, {good ? 'an improvement' : 'a decline'}</span></span>
        <span className="metric-p" aria-hidden="true">vs. previous period</span></p>
    </div>
  );
}
