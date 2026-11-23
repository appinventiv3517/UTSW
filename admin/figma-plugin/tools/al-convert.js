/* Converts the box tree from al-walk.js into Figma auto layout, then checks it.
   convert(): every frame gets a direction (vertical or horizontal), padding, one item spacing and alignment, taken
   from where its children really sit; every layer gets Fixed, Hug or Fill sizing on each axis. Where one spacing or
   one alignment can't describe a child, the child is wrapped in a padded auto-layout frame, so the result is exact.
   Grids become rows of horizontal frames. Only overlays (dialogs, menus, the password eye…) stay absolutely placed.
   check(): lays the result out again with Figma's auto-layout rules and compares every layer with the browser. */
'use strict';
const E = 0.75;                     /* position tolerance used while inferring, px */
const near = (a, b, t = E) => Math.abs(a - b) <= t;
const r2 = v => Math.round(v * 100) / 100;
let seq = 0;

/* ---------- Inference ---------- */
function convert(src) { seq = 0; const out = conv(src, null); out.sh = 'FIXED'; out.sv = 'FIXED'; return out; }

function conv(n, parentHints) {
  const o = conv0(n, parentHints); o._hints = n.h || {}; return o;
}
function conv0(n, parentHints) {
  if (n.k === 'T') {
    const single = (n.lines || 1) <= 1;
    const w = n.box.w, h = n.box.h;
    const out = { k: 'T', n: n.n, _b: { ...n.box }, w, h, chars: n.chars, runs: n.runs, fs: n.fs, fw: n.fw, c: n.c, lh: n.lh, ls: n.ls, al: n.al, lines: n.lines || 1, abs: n.abs ? 1 : 0 };
    /* Hug width = the inked text; a block of text keeps its box (it fills or is fixed) */
    out._hugW = single && n.ink ? n.ink.w : w;
    out._hugH = Math.max(1, n.lines || 1) * n.lh;
    out._single = single;
    /* A text box taller than its lines (a 44 px link target, a centered label): where the lines sit in it */
    if (n.ink && h > out._hugH + 1) {
      const top = n.ink.y + n.ink.h / 2 - out._hugH / 2 - n.box.y, room = h - out._hugH;
      out.va = top > room * 0.75 ? 'BOTTOM' : top > room * 0.25 ? 'CENTER' : 'TOP';
      if (out.va === 'TOP') delete out.va;
    }
    return out;
  }
  if (n.k === 'I') return { k: 'I', n: n.n, _b: { ...n.box }, w: n.box.w, h: n.box.h, g: n.g, f: n.f, c: n.c, fs: n.fs, abs: n.abs ? 1 : 0, _hugW: n.box.w, _hugH: n.box.h };
  if (n.k === 'S') return { k: 'S', n: n.n, _b: { ...n.box }, w: n.box.w, h: n.box.h, svg: n.svg, abs: n.abs ? 1 : 0, _hugW: n.box.w, _hugH: n.box.h };
  if (n.k === 'C') return { k: 'C', n: n.n, _b: { ...n.box }, w: n.box.w, h: n.box.h, t: n.t, on: n.on, c: n.c, abs: n.abs ? 1 : 0, _hugW: n.box.w, _hugH: n.box.h };
  /* Frame */
  const f = { k: 'F', n: n.n, _b: { ...n.box }, w: n.box.w, h: n.box.h, abs: n.abs ? 1 : 0 };
  for (const k of ['fill', 'st', 'fx', 'r', 'o', 'clip']) if (n[k] != null) f[k] = n[k];
  const kids = (n.ch || []).map(c => conv(c, n.h || {}));
  const flow = kids.filter(c => !c.abs), abs = kids.filter(c => c.abs);
  layout(f, flow, n.pad || [0, 0, 0, 0], n.h || {});
  abs.forEach(a => { a.x = r2(a._b.x - f._b.x); a.y = r2(a._b.y - f._b.y); a.sh = 'FIXED'; a.sv = 'FIXED'; fixInside(a); });
  f.ch = [...(f.ch || []), ...abs];
  return f;
}
/* Absolutely placed layers keep fixed sizes; their own children still get auto layout */
function fixInside(n) { if (n.k === 'T') { n.auto = n._single && near(n._hugW, n.w, 1) ? 'WH' : 'H'; } }

function layout(f, flow, pad, hints) {
  const b = f._b;
  if (!flow.length) { f.lay = null; f._hugW = b.w; f._hugH = b.h; f.ch = []; return; }
  const inner = { x: b.x + pad[3], y: b.y + pad[0], w: b.w - pad[1] - pad[3], h: b.h - pad[0] - pad[2] };
  const noOverlap = (arr, s, len) => { const a = [...arr].sort((p, q) => p._b[s] - q._b[s]); for (let i = 1; i < a.length; i++) if (a[i]._b[s] < a[i - 1]._b[s] + a[i - 1]._b[len] - E) return false; return true; };
  let dir;
  const v = noOverlap(flow, 'y', 'h'), h = noOverlap(flow, 'x', 'w');
  if (flow.length === 1) dir = hints.d && /flex/.test(hints.d) && /^row/.test(hints.fd || 'row') ? 'H' : 'V';
  else if (v && h) dir = hints.d && /flex/.test(hints.d) && /^row/.test(hints.fd) ? 'H' : 'V';
  else if (v) dir = 'V';
  else if (h) dir = 'H';
  else if (hints._row) dir = 'H';
  else {
    /* A grid or wrapped flow: rows of horizontal frames, stacked vertically */
    const rows = [];
    [...flow].sort((p, q) => p._b.y - q._b.y).forEach(c => {
      const row = rows.find(r => c._b.y < r.y1 - E && c._b.y + c._b.h > r.y0 + E);
      if (row) { row.items.push(c); row.y0 = Math.min(row.y0, c._b.y); row.y1 = Math.max(row.y1, c._b.y + c._b.h); }
      else rows.push({ items: [c], y0: c._b.y, y1: c._b.y + c._b.h });
    });
    flow = rows.map(r => {
      if (r.items.length === 1) return r.items[0];
      const rb = { x: inner.x, y: r.y0, w: inner.w, h: r.y1 - r.y0 };
      const row = { k: 'F', n: 'Row', _b: rb, w: rb.w, h: rb.h, abs: 0, _row: 1 };
      layout(row, r.items, [0, 0, 0, 0], { d: 'flex', fd: 'row', gc: hints.gc, jc: hints.jc, ai: 'start', _row: 1 });
      return row;
    });
    dir = 'V';
  }
  const P = dir === 'H' ? { s: 'x', l: 'w', cs: 'y', cl: 'h' } : { s: 'y', l: 'h', cs: 'x', cl: 'w' };
  flow.sort((p, q) => p._b[P.s] - q._b[P.s]);
  /* Overlapping in the stacking direction (negative margins): stack those as absolute layers instead */
  const placed = [], lifted = [];
  for (const c of flow) { const last = placed[placed.length - 1]; if (last && c._b[P.s] < last._b[P.s] + last._b[P.l] - E) lifted.push(c); else placed.push(c); }
  flow = placed;
  const iS = inner[P.s], iL = inner[P.l], iCS = inner[P.cs], iCL = inner[P.cl];
  const padS = dir === 'H' ? 3 : 0, padE = dir === 'H' ? 1 : 2, padCS = dir === 'H' ? 0 : 3, padCE = dir === 'H' ? 2 : 1;
  const p = [...pad];
  /* Primary axis: gaps, leading and trailing space */
  const gaps = flow.slice(1).map((c, i) => c._b[P.s] - (flow[i]._b[P.s] + flow[i]._b[P.l]));
  const lead = flow[0]._b[P.s] - iS, trail = iS + iL - (flow[flow.length - 1]._b[P.s] + flow[flow.length - 1]._b[P.l]);
  let gap = gaps.length ? Math.min(...gaps) : 0;
  const cssGap = dir === 'H' ? hints.gc : hints.gr;
  if (gaps.length && cssGap != null && gaps.every(g => g >= cssGap - E) && gaps.some(g => near(g, cssGap))) gap = cssGap;
  if (gaps.length) { const common = mode(gaps.map(g => Math.round(g * 2) / 2)); if (gaps.every(g => g >= common - E)) gap = Math.max(gap, common); }
  let pa = 'MIN';
  const between = /space-between/.test(hints.jc || '') && flow.length > 1 && near(lead, 0) && near(trail, 0);
  if (between && gaps.every(g => near(g, gaps[0], 1))) { pa = 'SPACE_BETWEEN'; gap = gaps[0]; }
  else if (lead > E && near(lead, trail, 1) && /center/.test(hints.jc || '') ) pa = 'CENTER';
  else if (lead > E && near(trail, 0) && /end/.test(hints.jc || '')) pa = 'MAX';
  else if (lead > E && near(lead, trail, 1) && gaps.every(g => near(g, gap))) pa = 'CENTER';
  if (pa === 'MIN') { p[padS] = r2(Math.max(0, pad[padS] + lead)); p[padE] = r2(Math.max(0, pad[padE] + trail)); }
  if (pa === 'MAX') { p[padE] = r2(pad[padE] + trail); }
  /* Counter axis: each child's offsets from the inner edges */
  const info = flow.map(c => { const o = c._b[P.cs] - iCS, e = iCS + iCL - (c._b[P.cs] + c._b[P.cl]); return { c, o, e, fill: near(o, 0) && near(e, 0) && c._b[P.cl] > 0 }; });
  const loose = info.filter(i => !i.fill);
  let ca = 'MIN';
  const isC = i => near(i.o, i.e, 1), isMax = i => near(i.e, 0) && i.o > E;
  if (loose.length && loose.every(isC) && loose.some(i => i.o > E)) ca = 'CENTER';
  else if (loose.length && loose.every(isMax)) ca = 'MAX';
  let m = 0;
  if (ca === 'MIN') {
    m = loose.length ? Math.min(...loose.map(i => i.o)) : 0;
    if (info.some(i => i.fill) && m > 0) m = 0;
    /* A child pulled into the padding (negative margin) eats into it; padding never goes below 0 */
    if (pad[padCS] + m < 0) m = -pad[padCS];
    p[padCS] = r2(pad[padCS] + m);
    const minE = Math.min(...info.map(i => i.e)); p[padCE] = r2(Math.max(0, pad[padCE] + minE));
  } else if (ca === 'MAX') {
    const me = Math.min(...loose.map(i => i.e)); p[padCE] = r2(pad[padCE] + Math.max(0, me));
  }
  /* Children: wrap where one spacing or alignment can't place them exactly */
  const out = [];
  flow.forEach((c, i) => {
    const inf = info[i];
    const extraLead = i === 0 || pa !== 'MIN' ? 0 : r2(gaps[i - 1] - gap);
    let crossOff = 0;
    if (inf.fill && ca === 'MIN' && m < -E) crossOff = r2(-m);
    if (!inf.fill) {
      if (ca === 'MIN') crossOff = r2(inf.o - m);
      else if (ca === 'CENTER' && !isC(inf)) crossOff = null;
      else if (ca === 'MAX' && !isMax(inf)) crossOff = null;
    }
    let node = c;
    if (extraLead > E || (crossOff != null && crossOff > E) || crossOff === null) {
      /* A plain frame around the child supplies the missing space */
      const wb = { ...c._b };
      const wp = [0, 0, 0, 0];
      wp[padS] = Math.max(0, extraLead); wb[P.s] -= Math.max(0, extraLead); wb[P.l] += Math.max(0, extraLead);
      if (crossOff === null) { /* fills the counter axis; the child keeps its exact offset inside */
        wp[padCS] = r2(inf.o); wb[P.cs] = iCS; wb[P.cl] = iCL;
      } else if (crossOff > E) { wp[padCS] = crossOff; wb[P.cs] -= crossOff; wb[P.cl] += crossOff; }
      const w = { k: 'F', n: 'Spacing', _b: wb, w: wb.w, h: wb.h, abs: 0, _wrap: 1 };
      if (inf.fill) { wb[P.cl] = iCL - m; wb[P.cs] = iCS + m; w._b = wb; w.w = wb.w; w.h = wb.h; }
      layout(w, [c], wp, { d: 'flex', fd: dir === 'H' ? 'column' : 'row' });
      if (crossOff === null || inf.fill) w._cfill = 1;
      node = w;
    }
    out.push(node);
  });
  f.lay = dir; f.gap = r2(pa === 'SPACE_BETWEEN' ? 0 : gap); f.pad = p.map(r2); f.pa = pa; f.ca = ca;
  f.ch = out;
  /* Hug sizes, used to decide whether this frame hugs its content */
  const sumP = out.reduce((s, c) => s + c._b[P.l], 0) + f.gap * (out.length - 1);
  const maxC = Math.max(...out.map(c => c._b[P.cl]));
  const hugP = p[padS] + p[padE] + sumP, hugC = p[padCS] + p[padCE] + maxC;
  if (dir === 'H') { f._hugW = hugP; f._hugH = hugC; } else { f._hugH = hugP; f._hugW = hugC; }
  /* Child sizing along both axes */
  out.forEach(c => {
    const inf = info[flow.indexOf(c)] || { fill: !!c._cfill };
    const grow = (c._hints && c._hints.fg > 0) || false;
    const primFill = grow;
    const cr = inf.fill || c._cfill;
    const hp = dir === 'H' ? c._hugW : c._hugH, hc = dir === 'H' ? c._hugH : c._hugW;
    const sp = primFill ? 'FILL' : (hp != null && near(hp, c._b[P.l]) ? 'HUG' : 'FIXED');
    const sc = cr ? 'FILL' : (hc != null && near(hc, c._b[P.cl]) ? 'HUG' : 'FIXED');
    if (dir === 'H') { c.sh = sp; c.sv = sc; } else { c.sv = sp; c.sh = sc; }
  });
  /* Equal-width grid cells that share a row fill it together */
  if (dir === 'H' && f._row && out.length > 1 && out.every(c => near(c._b.w, out[0]._b.w, 1)) && near(sumP + p[1] + p[3], f._b.w, 1)) out.forEach(c => { c.sh = 'FILL'; });
  lifted.forEach(c => { c.abs = 1; c.x = r2(c._b.x - f._b.x); c.y = r2(c._b.y - f._b.y); c.sh = 'FIXED'; c.sv = 'FIXED'; out.push(c); });
}
function mode(a) { const m = {}; a.forEach(x => { m[x] = (m[x] || 0) + 1; }); return +Object.entries(m).sort((p, q) => q[1] - p[1])[0][0]; }

/* Text: how it resizes, from its sizing */
function finishText(n) {
  if (n.k !== 'T') return;
  /* A one-line text boxed at exactly its own width would wrap in Figma if Inter measures a hair wider there: it hugs instead */
  if (n.sh === 'FIXED' && n._single && near(n._hugW, n.w, 1.5)) n.sh = 'HUG';
  if (n.sh === 'HUG' && n._single) n.auto = 'WH';
  else n.auto = 'H';
  if (n.auto === 'H' && n.sh === 'HUG') n.sh = 'FIXED';
  if (n.sv !== 'FIXED' && near(n._hugH, n.h, 1)) n.sv = 'HUG';
}
/* A parent that hugs an axis can't hold children that fill it: they become fixed. Runs top-down. */
function settle(n) {
  if (n.k === 'T') { finishText(n); return; }
  if (n.k !== 'F') return;
  for (const c of n.ch || []) {
    if (c.abs) { c.sh = 'FIXED'; c.sv = 'FIXED'; }
    else {
      if (n.sh === 'HUG' && c.sh === 'FILL') c.sh = 'FIXED';
      if (n.sv === 'HUG' && c.sv === 'FILL') c.sv = 'FIXED';
      if (!n.lay) { c.sh = 'FIXED'; c.sv = 'FIXED'; }
      /* Hug only means something for auto-layout frames and text */
      if (c.k !== 'F' && c.k !== 'T') { if (c.sh === 'HUG') c.sh = 'FIXED'; if (c.sv === 'HUG') c.sv = 'FIXED'; }
      if (c.k === 'F' && !c.lay) { if (c.sh === 'HUG') c.sh = 'FIXED'; if (c.sv === 'HUG') c.sv = 'FIXED'; }
    }
    settle(c);
  }
}

/* ---------- Check: Figma's auto-layout rules, applied to the result ---------- */
function hugSize(n, axis) {
  if (n.k === 'T') return axis === 'w' ? (n.auto === 'WH' ? n._hugW : n.w) : n._hugH;
  if (n.k !== 'F' || !n.lay) return n[axis];
  const kids = n.ch.filter(c => !c.abs);
  const sizeOf = c => (axis === 'w' ? c.sh : c.sv) === 'HUG' ? hugSize(c, axis) : c[axis];
  const prim = (n.lay === 'H') === (axis === 'w');
  const pS = axis === 'w' ? n.pad[3] : n.pad[0], pE = axis === 'w' ? n.pad[1] : n.pad[2];
  if (prim) return pS + pE + kids.reduce((s, c) => s + sizeOf(c), 0) + n.gap * Math.max(0, kids.length - 1);
  return pS + pE + Math.max(0, ...kids.map(sizeOf));
}
function place(n, x, y, w, h, errs, path) {
  n._s = { x, y, w, h };
  const b = n._b;
  if (b && !n._skipCheck) {
    const tol = n.k === 'T' ? 2 : 1;
    const dx = Math.abs(x - b.x), dy = Math.abs(y - b.y), dw = Math.abs(w - b.w), dh = Math.abs(h - b.h);
    const wOk = n.k === 'T' && n.auto === 'WH' ? true : dw <= tol;
    if (dx > tol || dy > tol || !wOk || dh > tol) errs.push(`${path} ${n.n}: Figma ${r2(x)},${r2(y)} ${r2(w)}×${r2(h)} vs browser ${b.x},${b.y} ${b.w}×${b.h}`);
  }
  if (n.k !== 'F') return;
  const kids = n.ch || [];
  kids.filter(c => c.abs).forEach(c => place(c, x + c.x, y + c.y, c.w, c.h, errs, `${path}/${c.n}`));
  if (!n.lay) return;
  const flow = kids.filter(c => !c.abs);
  const H = n.lay === 'H';
  const pad = n.pad, iX = x + pad[3], iY = y + pad[0], iW = w - pad[1] - pad[3], iH = h - pad[0] - pad[2];
  const pl = H ? iW : iH, cl = H ? iH : iW;
  const sz = flow.map(c => {
    const ps = H ? c.sh : c.sv, cs = H ? c.sv : c.sh;
    const pv = ps === 'FIXED' ? (H ? c.w : c.h) : ps === 'HUG' ? hugSize(c, H ? 'w' : 'h') : null;
    const cv = cs === 'FIXED' ? (H ? c.h : c.w) : cs === 'HUG' ? hugSize(c, H ? 'h' : 'w') : cl;
    return { pv, cv };
  });
  const fixedSum = sz.reduce((s, q) => s + (q.pv || 0), 0);
  const nFill = sz.filter(q => q.pv == null).length;
  let gap = n.gap;
  if (n.pa === 'SPACE_BETWEEN' && flow.length > 1) gap = (pl - fixedSum) / (flow.length - 1);
  const leftover = pl - fixedSum - gap * Math.max(0, flow.length - 1);
  sz.forEach(q => { if (q.pv == null) q.pv = Math.max(0, leftover / nFill); });
  const total = sz.reduce((s, q) => s + q.pv, 0) + gap * Math.max(0, flow.length - 1);
  let cur = n.pa === 'CENTER' ? (pl - total) / 2 : n.pa === 'MAX' ? pl - total : 0;
  flow.forEach((c, i) => {
    const q = sz[i];
    const co = n.ca === 'CENTER' ? (cl - q.cv) / 2 : n.ca === 'MAX' ? cl - q.cv : 0;
    const cx = H ? iX + cur : iX + co, cy = H ? iY + co : iY + cur;
    place(c, cx, cy, H ? q.pv : q.cv, H ? q.cv : q.pv, errs, `${path}/${c.n}`);
    cur += q.pv + gap;
  });
}
function check(root) { const errs = []; place(root, root._b.x, root._b.y, root.w, root.h, errs, ''); return errs; }

/* Strip working fields; keep what the plugin needs */
function clean(n) {
  const o = {};
  for (const [k, v] of Object.entries(n)) if (!k.startsWith('_') && k !== 'lines' && v !== undefined) o[k] = v;
  if (n.k === 'T') { o.single = n._single ? 1 : 0; }
  if (o.ch) o.ch = o.ch.map(clean);
  for (const k of ['w', 'h', 'x', 'y']) if (typeof o[k] === 'number') o[k] = r2(o[k]);
  return o;
}
function count(n) { return 1 + (n.ch || []).reduce((s, c) => s + count(c), 0); }
function stats(n, s = { frames: 0, auto: 0, abs: 0, text: 0, icons: 0, wraps: 0 }) {
  if (n.k === 'F') { s.frames++; if (n.lay) s.auto++; if (n.n === 'Spacing') s.wraps++; }
  if (n.k === 'T') s.text++; if (n.k === 'I') s.icons++; if (n.abs) s.abs++;
  (n.ch || []).forEach(c => stats(c, s)); return s;
}

function run(src) {
  const out = convert(src);
  settle(out);
  const errs = check(out);
  return { tree: out, errs };
}
module.exports = { run, clean, count, stats };
