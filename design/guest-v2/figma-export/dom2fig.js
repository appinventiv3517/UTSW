/* Read the prototype's rendered #screen into a compact layer tree that the Figma builder turns into
   native frames, text layers and icon instances. window.__dom2fig(rootSel) -> {w,h,tree,colors,glyphs,svgs}
   Colors are returned as rgba strings; the runner pairs the light and dark passes into variables. */
window.__dom2fig = function (rootSel) {
  const root = document.querySelector(rootSel), R = root.getBoundingClientRect();
  const q = n => Math.round(n * 10) / 10;
  const colors = [], cIdx = new Map(), glyphs = [], gIdx = new Map(), svgs = [], sIdx = new Map();
  const reg = (arr, map, v) => { if (!map.has(v)) { map.set(v, arr.length); arr.push(v); } return map.get(v); };
  const parse = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? +p[3] : 1]; };
  const col = s => { const c = parse(s); if (!c || c[3] === 0) return null; return reg(colors, cIdx, c.map((v, i) => i < 3 ? Math.round(v) : Math.round(v * 1000) / 1000).join(',')); };
  const splitTop = s => { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; };
  const inv = ([[a, c, e], [b, d, f]]) => { const det = a * d - b * c; return [[d / det, -c / det, (c * f - d * e) / det], [-b / det, a / det, (b * e - a * f) / det]]; };
  const r4 = m => m.map(row => row.map(v => Math.round(v * 10000) / 10000));
  const stops = list => { const n = list.length; return list.map((s, i) => { const c = col(s); const pm = s.match(/\)\s*(-?[\d.]+)%/); const pos = pm ? Math.max(0, Math.min(1, +pm[1] / 100)) : (n > 1 ? i / (n - 1) : 0); return c == null ? [Math.round(pos * 1000) / 1000, col('rgba(0,0,0,0.001)') ] : [Math.round(pos * 1000) / 1000, c]; }); };
  const gradient = (img, w, h) => {
    const m = img.match(/^(linear|radial)-gradient\((.*)\)$/s); if (!m) return null;
    const parts = splitTop(m[2]); let first = parts[0], st = parts;
    if (m[1] === 'linear') {
      let ang = 180;
      if (/deg/.test(first)) { ang = parseFloat(first); st = parts.slice(1); }
      else if (/^to /.test(first)) { const t = first; ang = /top/.test(t) ? (/right/.test(t) ? 45 : /left/.test(t) ? 315 : 0) : /bottom/.test(t) ? (/right/.test(t) ? 135 : /left/.test(t) ? 225 : 180) : /right/.test(t) ? 90 : 270; st = parts.slice(1); }
      const rad = ang * Math.PI / 180, L = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
      const dx = Math.sin(rad) * L / 2 / w, dy = -Math.cos(rad) * L / 2 / h; // normalized half-vector
      const p0 = [0.5 - dx, 0.5 - dy], e1 = [2 * dx, 2 * dy], e2 = [-e1[1] * h / w, e1[0] * w / h];
      const M = [[e1[0], e2[0], p0[0] - e2[0] / 2], [e1[1], e2[1], p0[1] - e2[1] / 2]];
      return { g: 'L', m: r4(inv(M)), s: stops(st) };
    }
    let cx = .5, cy = .5, rx = .5, ry = .5, hasShape = !parse(first) || /at /.test(first);
    if (hasShape) {
      const at = first.match(/at\s+(-?[\d.]+)%\s+(-?[\d.]+)%/); if (at) { cx = +at[1] / 100; cy = +at[2] / 100; }
      const sz = first.match(/^(?:ellipse\s+|circle\s+)?(-?[\d.]+)(%|px)\s+(-?[\d.]+)(%|px)/);
      if (sz) { rx = sz[2] === '%' ? +sz[1] / 100 : +sz[1] / w; ry = sz[4] === '%' ? +sz[3] / 100 : +sz[3] / h; }
      else if (/closest-side/.test(first)) { rx = Math.min(cx, 1 - cx); ry = Math.min(cy, 1 - cy); }
      else { const fx = Math.max(cx, 1 - cx), fy = Math.max(cy, 1 - cy); if (/circle/.test(first)) { const r = Math.hypot(fx * w, fy * h); rx = r / w; ry = r / h; } else { rx = fx * Math.SQRT2; ry = fy * Math.SQRT2; } }
      st = parts.slice(1);
    }
    const M = [[2 * rx, 0, cx - rx], [0, 2 * ry, cy - ry]];
    return { g: 'R', m: r4(inv(M)), s: stops(st) };
  };
  const effects = cs => {
    const out = []; const s = cs.boxShadow;
    if (s && s !== 'none') for (const p of splitTop(s)) { const c = col(p); if (c == null) continue; const toks = p.replace(/rgba?\([^)]*\)/, '').trim().split(/\s+/); const inset = toks.includes('inset'); const n = toks.filter(x => x !== 'inset').map(parseFloat); out.push({ t: inset ? 'I' : 'D', x: n[0] || 0, y: n[1] || 0, b: n[2] || 0, s: n[3] || 0, c }); }
    const bf = cs.backdropFilter || cs.webkitBackdropFilter; const bm = bf && bf.match(/blur\(([\d.]+)px\)/); if (bm) out.push({ t: 'B', b: +bm[1] });
    return out;
  };
  const nameOf = el => { const a = el.getAttribute('aria-label'); const c = typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : ''; return (el.id ? el.id : c || el.tagName.toLowerCase()) + (a && a.length < 40 ? ' · ' + a : ''); };
  const weight = w => +w;
  const svgNode = (el, b) => {
    if (el.classList.contains('ic')) {
      const vb = (el.getAttribute('viewBox') || '0 -960 960 960').split(/[\s,]+/).map(Number);
      const ps = []; for (const p of el.querySelectorAll('path')) { const cs = getComputedStyle(p); if (cs.display === 'none' || +cs.opacity < 0.02) continue; const c = col(cs.fill); if (c == null) continue; ps.push([reg(glyphs, gIdx, p.getAttribute('d')), c, Math.round(+cs.opacity * 100) / 100]); }
      if (!ps.length) return null; return { k: 'I', x: q(b.x), y: q(b.y), w: q(b.w), h: q(b.h), p: ps, vb };
    }
    const clone = el.cloneNode(true); const src = el.querySelectorAll('*'), dst = clone.querySelectorAll('*');
    const hx = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    src.forEach((s, i) => { const d = dst[i]; if (!(s instanceof SVGGraphicsElement) || ['svg', 'g', 'defs', 'clipPath', 'mask', 'linearGradient', 'radialGradient'].includes(s.tagName)) return; const cs = getComputedStyle(s);
      if (cs.display === 'none') { d.remove(); return; }
      const fc = parse(cs.fill), sc = parse(cs.stroke);
      if (/url\(/.test(cs.fill)) { } else if (!fc || fc[3] === 0) d.setAttribute('fill', 'none'); else { d.setAttribute('fill', hx(fc)); if (fc[3] < 1) d.setAttribute('fill-opacity', fc[3]); }
      if (sc && sc[3] > 0 && cs.stroke !== 'none') { d.setAttribute('stroke', hx(sc)); d.setAttribute('stroke-width', parseFloat(cs.strokeWidth) || 1); if (sc[3] < 1) d.setAttribute('stroke-opacity', sc[3]); }
      if (+cs.opacity < 1) d.setAttribute('opacity', cs.opacity); d.removeAttribute('class'); d.removeAttribute('style'); });
    clone.removeAttribute('class'); clone.removeAttribute('style'); clone.setAttribute('width', q(b.w)); clone.setAttribute('height', q(b.h)); clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const mk = clone.outerHTML.replace(/\s(aria-hidden|focusable|role|aria-label)="[^"]*"/g, '');
    return { k: 'S', x: q(b.x), y: q(b.y), w: q(b.w), h: q(b.h), s: reg(svgs, sIdx, mk), n: nameOf(el.parentElement) };
  };
  const contentBox = el => { const cs = getComputedStyle(el), r = el.getBoundingClientRect(); const l = parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth), rr = parseFloat(cs.paddingRight) + parseFloat(cs.borderRightWidth); return { x: r.left + l, w: r.width - l - rr }; };
  const blockOf = el => { let n = el; while (n && n !== root && getComputedStyle(n).display === 'inline') n = n.parentElement; return n || el; };
  const textNode = (tn, el, cs, ox, oy) => {
    const raw = tn.textContent; if (!raw.trim()) return null;
    const c = col(cs.color); if (c == null) return null;
    const rg = document.createRange(); rg.selectNodeContents(tn); const rs = [...rg.getClientRects()].filter(r => r.width > 0.5);
    if (!rs.length) return null;
    const lines = []; for (const r of rs) { const L = lines[lines.length - 1]; if (L && Math.abs(L.top - r.top) < 3) { L.left = Math.min(L.left, r.left); L.right = Math.max(L.right, r.right); L.bottom = Math.max(L.bottom, r.bottom); } else lines.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom }); }
    const fs = parseFloat(cs.fontSize), lh = cs.lineHeight === 'normal' ? Math.round(fs * 1.21) : parseFloat(cs.lineHeight);
    const clamp = parseInt(cs.webkitLineClamp) || 0; const blk = blockOf(el); const bcs = getComputedStyle(blk);
    // only lines inside the clipping box are visible
    const br = blk.getBoundingClientRect(); const vis = clamp || bcs.overflow !== 'visible' ? lines.filter(L => L.top < br.bottom - 1) : lines;
    if (!vis.length) return null;
    const rh = vis[0].bottom - vis[0].top; const top = vis[0].top - (lh - rh) / 2;
    let text = raw.replace(/[ \t\n\r]+/g, ' '); if (vis.length === 1 && lines.length === 1) text = text.trim(); else text = text.trim();
    const al = /center/.test(cs.textAlign) ? 'C' : /right|end/.test(cs.textAlign) ? 'R' : 'L';
    const o = { k: 'T', t: text, fs, fw: weight(cs.fontWeight), lh: q(lh), c };
    const ls = parseFloat(cs.letterSpacing); if (ls) o.ls = q(ls);
    if (cs.textTransform === 'uppercase') o.u = 1;
    if (/underline/.test(cs.textDecorationLine)) o.d = 1;
    const ell = cs.textOverflow === 'ellipsis' || bcs.textOverflow === 'ellipsis';
    if (vis.length === 1 && lines.length === 1 && !ell) { o.x = q(vis[0].left - ox); o.y = q(top - oy); o.h = q(lh); o.w = q(vis[0].right - vis[0].left); o.a = 'WH'; }
    else {
      const inline = getComputedStyle(el).display === 'inline' && el !== blk; const cb = contentBox(blk);
      let x = cb.x, w = cb.w; if (inline || (vis.length === 1 && !ell)) { x = Math.min(...vis.map(L => L.left)); w = Math.max(...vis.map(L => L.right)) - x + 1; }
      if (ell) { const clipR = br.right - parseFloat(bcs.paddingRight); w = Math.min(w, clipR - x); }
      o.x = q(x - ox); o.y = q(top - oy); o.w = q(w); o.h = q(lh * vis.length); o.al = al; o.a = 'H';
      if (clamp || ell || vis.length < lines.length) o.ml = vis.length;
    }
    return o;
  };
  // Materialize ::before / ::after so their boxes can be measured like elements.
  const st = document.createElement('style'); st.textContent = '.__nb::before{content:none!important}.__na::after{content:none!important}'; document.head.appendChild(st);
  const made = [];
  root.querySelectorAll('*').forEach(el => { if (el instanceof SVGElement) return; for (const w of ['::before', '::after']) { const cs = getComputedStyle(el, w); const c = cs.content; if (!c || c === 'none' || c === 'normal') continue; if (cs.display === 'none') continue;
      const sp = document.createElement('span'); sp.setAttribute('data-pseudo', w); for (const p of cs) sp.style.setProperty(p, cs.getPropertyValue(p));
      const m = c.match(/^"(.*)"$/); sp.textContent = m ? m[1] : ''; made.push(sp); if (w === '::before') el.prepend(sp); else el.append(sp); el.classList.add(w === '::before' ? '__nb' : '__na'); } });
  const walk = (el, ox, oy, clipBox) => {
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.02) return [];
    const r = el.getBoundingClientRect(); const b = { x: r.left - ox, y: r.top - oy, w: r.width, h: r.height };
    if (clipBox && (r.right < clipBox.left || r.left > clipBox.right || r.bottom < clipBox.top || r.top > clipBox.bottom)) return [];
    if (el.tagName.toLowerCase() === 'svg') { if (r.width < 1) return []; const s = svgNode(el, b); return s ? [s] : []; }
    const fl = []; const bg = col(cs.backgroundColor);
    if (bg != null) fl.push({ c: bg });
    if (cs.backgroundImage && cs.backgroundImage !== 'none') for (const l of splitTop(cs.backgroundImage).reverse()) { const g = gradient(l, Math.max(r.width, 1), Math.max(r.height, 1)); if (g) fl.push(g); }
    const fx = effects(cs);
    const bw = ['Top', 'Right', 'Bottom', 'Left'].map(s => parseFloat(cs['border' + s + 'Width']) || 0);
    let stroke = null; const sideCols = ['Top', 'Right', 'Bottom', 'Left'].map(s => col(cs['border' + s + 'Color']));
    if (bw.some(v => v > 0)) { const ci = sideCols[bw.findIndex(v => v > 0)]; if (ci != null) stroke = { c: ci, w: bw.every(v => v === bw[0]) ? bw[0] : bw, d: /dashed/.test(cs.borderTopStyle) ? 1 : 0 }; }
    const rad = ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map(k => Math.min(parseFloat(cs['border' + k + 'Radius']) || 0, r.width / 2, r.height / 2)).map(q);
    const clips = el !== root && (cs.overflowX !== 'visible' || cs.overflowY !== 'visible');
    const op = +cs.opacity;
    const visual = fl.length || fx.length || stroke || clips || op < 0.99 || el === root;
    const frameOx = visual ? r.left : ox, frameOy = visual ? r.top : oy;
    const cb = clips ? r : clipBox;
    let kids = [];
    if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && !['radio', 'checkbox'].includes(el.type)) {
      const txt = el.value || el.placeholder || ''; if (txt) { const pcs = el.value ? cs : getComputedStyle(el, '::placeholder'); const c = col(pcs.color) ?? col(cs.color); const fs = parseFloat(cs.fontSize), lh = cs.lineHeight === 'normal' ? Math.round(fs * 1.21) : parseFloat(cs.lineHeight); const pl = parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth), pr = parseFloat(cs.paddingRight);
        kids.push({ k: 'T', t: txt, fs, fw: weight(cs.fontWeight), lh: q(lh), c, x: q(r.left + pl - frameOx), y: q(r.top + (r.height - lh) / 2 - frameOy), w: q(r.width - pl - pr), h: q(lh), a: 'H', ml: 1, al: 'L' }); }
    }
    for (const n of el.childNodes) {
      if (n.nodeType === 3) { const t = textNode(n, el, cs, frameOx, frameOy); if (t) kids.push(t); }
      else if (n.nodeType === 1) kids = kids.concat(walk(n, frameOx, frameOy, cb));
    }
    if (!visual) {
      if (kids.length < 2 || !(typeof el.className === 'string' && el.className.trim())) return kids;
      // keep a named group: a transparent frame around its children
      const xs = kids.map(k => k.x), ys = kids.map(k => k.y), x0 = Math.min(b.x, ...xs), y0 = Math.min(b.y, ...ys);
      kids.forEach(k => { k.x = q(k.x - b.x); k.y = q(k.y - b.y); });
      return [{ k: 'F', n: nameOf(el), x: q(b.x), y: q(b.y), w: q(b.w), h: q(b.h), ch: kids, g: 1 }];
    }
    const o = { k: 'F', n: nameOf(el), x: q(b.x), y: q(b.y), w: q(b.w), h: q(b.h) };
    if (fl.length) o.fl = fl; if (fx.length) o.fx = fx; if (stroke) o.st = stroke;
    if (rad.some(v => v)) o.r = rad.every(v => v === rad[0]) ? rad[0] : rad;
    if (clips) o.c = 1; if (op < 0.99) o.o = Math.round(op * 100) / 100;
    if (kids.length) o.ch = kids; return [o];
  };
  const tree = walk(root, R.left, R.top, R)[0];
  made.forEach(s => s.remove()); root.querySelectorAll('.__nb,.__na').forEach(e => e.classList.remove('__nb', '__na')); st.remove();
  tree.x = 0; tree.y = 0;
  return { w: Math.round(R.width), h: Math.round(R.height), tree, colors, glyphs, svgs };
};
