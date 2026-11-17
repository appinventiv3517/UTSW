/* Runs inside the Admin portal page. Turns the rendered screen into a tree the Figma plugin rebuilds as editable layers:
   frames for boxes (fills, borders, radii, shadows, clipping), text layers for text, and placeholders the capture script fills
   with images (icons, the phone preview, charts). Coordinates are relative to the parent frame. */
window.__figSerialize = function () {
  'use strict';
  const px = v => parseFloat(v) || 0;
  const r2 = v => Math.round(v * 100) / 100;

  /* Colors: rgb()/rgba() and color(srgb …) from color-mix(); returns [r, g, b, a] in 0–1, or null when invisible */
  function color(s) {
    if (!s) return null;
    let m = s.match(/^rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); const a = p.length > 3 ? p[3] : 1; return a > 0.001 ? [p[0] / 255, p[1] / 255, p[2] / 255, r2(a)] : null; }
    m = s.match(/^color\(srgb ([^)]+)\)/);
    if (m) { const p = m[1].split(/[\s/]+/).filter(Boolean).map(Number); const a = p.length > 3 ? p[3] : 1; return a > 0.001 ? [p[0], p[1], p[2], r2(a)] : null; }
    return null;
  }
  /* The same, but keeps fully transparent colors (gradient stops that fade out) */
  function colorAny(s) { const m = s.match(/\(([^)]+)\)/); if (!m) return [0, 0, 0, 0]; const p = m[1].replace(/^srgb /, '').split(/[\s,/]+/).filter(Boolean).map(Number); const k = /^rgb/.test(s) ? 255 : 1; return [p[0] / k, p[1] / k, p[2] / k, p.length > 3 ? p[3] : 1]; }
  /* Split a CSS list on top-level commas */
  function splitTop(s) {
    const out = []; let depth = 0, cur = '';
    for (const ch of s) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && !depth) { out.push(cur.trim()); cur = ''; } else cur += ch; }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  function shadows(s) {
    if (!s || s === 'none') return [];
    return splitTop(s).map(part => {
      const cm = part.match(/(rgba?\([^)]+\)|color\([^)]+\))/);
      const c = cm ? color(cm[1]) : null;
      const rest = part.replace(cm ? cm[1] : '', '');
      const nums = (rest.match(/-?[\d.]+px/g) || []).map(px);
      return { c, inset: /\binset\b/.test(part), x: nums[0] || 0, y: nums[1] || 0, b: nums[2] || 0, s: nums[3] || 0 };
    }).filter(x => x.c);
  }
  /* First linear-gradient of background-image: angle (deg) and stops; radial and url layers are left out */
  function gradient(s) {
    if (!s || s === 'none') return null;
    const layer = splitTop(s).find(l => l.startsWith('linear-gradient('));
    if (!layer) return null;
    const args = splitTop(layer.slice(16, -1));
    let angle = 180;
    if (/deg$/.test(args[0])) { angle = px(args.shift()); }
    else if (/^to /.test(args[0])) { const t = args.shift(); angle = { 'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270, 'to top right': 45, 'to bottom right': 135, 'to bottom left': 225, 'to top left': 315 }[t] || 180; }
    const stops = args.map((a, i) => { const cm = a.match(/(rgba?\([^)]+\)|color\([^)]+\))/); if (!cm) return null;
      const c = color(cm[1]) || colorAny(cm[1]); const pm = a.replace(cm[1], '').match(/([\d.]+)%/);
      return { c, p: pm ? px(pm[1]) / 100 : (args.length > 1 ? i / (args.length - 1) : 0) }; }).filter(Boolean);
    return stops.length > 1 ? { angle, stops } : null;
  }
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'LINK', 'META', 'HEAD', 'BR', 'WBR']);
  const WEIGHT = w => { const n = +w || 400; return Math.min(900, Math.max(100, Math.round(n / 100) * 100)); };
  let shot = 0;
  const shots = [];

  function textNode(tn, cs, frameBox) {
    const ws = cs.whiteSpace;
    let s = tn.nodeValue;
    if (!/^pre/.test(ws)) s = s.replace(/\s+/g, ' ');
    if (!s.trim()) return null;
    /* Measure only the visible characters, so a text run that follows a bold name keeps its gap */
    const raw = tn.nodeValue, a0 = raw.search(/\S/), a1 = raw.length - raw.split('').reverse().join('').search(/\S/);
    const range = document.createRange();
    if (/^pre/.test(ws) || a0 < 0) range.selectNodeContents(tn); else { range.setStart(tn, a0); range.setEnd(tn, a1); }
    const rects = [...range.getClientRects()].filter(r => r.width > 0.5 && r.height > 0.5);
    if (!rects.length) return null;
    const c = color(cs.color); if (!c) return null;
    const l = Math.min(...rects.map(r => r.left)), t = Math.min(...rects.map(r => r.top)), rr = Math.max(...rects.map(r => r.right)), b = Math.max(...rects.map(r => r.bottom));
    const fs = px(cs.fontSize), lh = cs.lineHeight === 'normal' ? fs * 1.21 : px(cs.lineHeight);
    const lines = new Set(rects.map(r => Math.round(r.top))).size;
    return { t: 'x', s: /^pre/.test(ws) ? s : s.trim(), x: r2(l - frameBox.x), y: r2(t - frameBox.y), w: r2(rr - l), h: r2(b - t), ml: lines > 1 ? 1 : 0,
      fs: r2(fs), fw: WEIGHT(cs.fontWeight), it: cs.fontStyle === 'italic' ? 1 : 0, lh: r2(lh), ls: cs.letterSpacing === 'normal' ? 0 : r2(px(cs.letterSpacing)), c,
      al: { center: 'CENTER', right: 'RIGHT', end: 'RIGHT', justify: 'JUSTIFIED' }[cs.textAlign] || 'LEFT',
      tc: cs.textTransform === 'uppercase' ? 'UPPER' : cs.textTransform === 'capitalize' ? 'TITLE' : '', td: /underline/.test(cs.textDecorationLine) ? 'UNDERLINE' : /line-through/.test(cs.textDecorationLine) ? 'STRIKETHROUGH' : '' };
  }

  function boxStyle(el, cs) {
    const out = {};
    const bg = color(cs.backgroundColor); const gr = gradient(cs.backgroundImage);
    const fills = [];
    if (bg) fills.push({ c: bg });
    if (gr) fills.push({ g: gr });
    if (fills.length) out.fill = fills;
    const bw = ['Top', 'Right', 'Bottom', 'Left'].map(k => cs[`border${k}Style`] === 'none' || cs[`border${k}Style`] === 'hidden' ? 0 : px(cs[`border${k}Width`]));
    const bc = ['Top', 'Right', 'Bottom', 'Left'].map(k => color(cs[`border${k}Color`]));
    if (bw.some((w, i) => w > 0 && bc[i])) { const c = bc[bw.findIndex((w, i) => w > 0 && bc[i])]; out.st = { c, w: bw.map((w, i) => bc[i] ? w : 0), a: 'INSIDE', dash: /dash|dot/.test(cs.borderTopStyle) ? 1 : 0 }; }
    const fx = [];
    shadows(cs.boxShadow).forEach(sh => {
      if (!sh.x && !sh.y && !sh.b && sh.s > 0 && !out.st) { out.st = { c: sh.c, w: [sh.s, sh.s, sh.s, sh.s], a: sh.inset ? 'INSIDE' : 'OUTSIDE' }; return; }
      fx.push({ k: sh.inset ? 'INNER_SHADOW' : 'DROP_SHADOW', c: sh.c, x: sh.x, y: sh.y, b: sh.b, s: sh.s });
    });
    if (fx.length) out.fx = fx;
    const rad = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map(v => px(v));
    if (rad.some(Boolean)) out.r = rad;
    const op = px(cs.opacity);
    if (op < 0.999) out.o = r2(op);
    if (['hidden', 'clip', 'auto', 'scroll'].includes(cs.overflowX) || ['hidden', 'clip', 'auto', 'scroll'].includes(cs.overflowY)) out.clip = 1;
    return out;
  }

  function nameOf(el) {
    if (el.id && !/^(f|m|acc|dd|tbl)-/.test(el.id)) return `#${el.id}`;
    const cls = [...el.classList].filter(c => !/^fig-/.test(c)).slice(0, 2).join('.');
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return `${tag} ${el.textContent.trim().slice(0, 40)}`;
    if (tag === 'button' || (tag === 'a' && el.classList.contains('btn'))) return `Button / ${(el.getAttribute('aria-label') || el.textContent).trim().replace(/\s+/g, ' ').slice(0, 40)}`;
    return cls ? `${tag}.${cls}` : tag;
  }

  function walk(el, frame, frameBox) {
    if (SKIP.has(el.tagName)) return;
    if (el.tagName === 'DIALOG' && !el.open) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse' || px(cs.opacity) === 0) return;
    const rect = el.getBoundingClientRect();
    if (el.classList.contains('vh') || (rect.width <= 1.5 && rect.height <= 1.5 && cs.position === 'absolute' && cs.overflow !== 'visible')) return;
    const tag = el.tagName;
    const rel = { x: r2(rect.left - frameBox.x), y: r2(rect.top - frameBox.y), w: r2(rect.width), h: r2(rect.height) };
    /* Icons: Material Symbols ligature spans become image placeholders */
    if (el.classList.contains('ms')) {
      const glyph = el.textContent.trim(); const c = color(cs.color);
      if (glyph && c && rect.width > 0) frame.ch.push({ t: 'icon', ...rel, n: glyph, key: [glyph, r2(px(cs.fontSize)), cs.color, cs.fontVariationSettings].join('|') });
      return;
    }
    if (tag === 'IFRAME' || tag === 'svg' || tag === 'CANVAS' || tag === 'VIDEO') {
      if (rect.width < 1 || rect.height < 1) return;
      const id = `s${shot++}`; el.setAttribute('data-fig-shot', id); shots.push({ id, jpeg: tag === 'IFRAME' });
      frame.ch.push({ t: 'img', ...rel, shot: id, n: tag === 'IFRAME' ? 'Mobile preview' : tag.toLowerCase() });
      return;
    }
    if (tag === 'IMG') {
      const src = el.getAttribute('src') || '';
      if (rect.width < 1) return;
      if (src.startsWith('data:image/svg+xml;base64,')) { frame.ch.push({ t: 'svg', ...rel, n: el.getAttribute('alt') || 'image', svg: atob(src.split(',')[1]) }); return; }
      const id = `s${shot++}`; el.setAttribute('data-fig-shot', id); shots.push({ id }); frame.ch.push({ t: 'img', ...rel, shot: id, n: el.getAttribute('alt') || 'image' }); return;
    }
    const st = boxStyle(el, cs);
    const visual = !!(st.fill || st.st || st.fx || st.o) || tag === 'BODY' || (st.clip && el.scrollWidth > el.clientWidth + 1);
    let target = frame, box = frameBox;
    if (visual && rect.width > 0 && rect.height > 0) {
      const node = { t: 'f', n: nameOf(el), ...rel, ...st, ch: [] };
      frame.ch.push(node); target = node; box = { x: rect.left, y: rect.top };
    }
    /* Form controls: their value or placeholder, and drawn radios and checkboxes */
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      if (type === 'radio' || type === 'checkbox') {
        if (rect.width >= 8) frame.ch.push({ t: 'ctl', k: type, on: el.checked ? 1 : 0, ...rel, c: color(cs.accentColor) || [0, 0.259, 0.471, 1] });
        return;
      }
      if (type === 'hidden' || type === 'color' || type === 'file') return;
      let v = tag === 'SELECT' ? (el.selectedOptions[0] || {}).text || '' : el.value;
      let ph = false;
      if (!v && el.placeholder) { v = el.placeholder; ph = true; }
      if (type === 'password' && !ph) v = '•'.repeat(v.length);
      if (type === 'date' && v && !ph) { const [y, m, d] = v.split('-'); v = `${m}/${d}/${y}`; }
      if (type === 'time' && v && !ph) { let [h, mi] = v.split(':').map(Number); const pm = h >= 12; h = h % 12 || 12; v = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')} ${pm ? 'PM' : 'AM'}`; }
      if (v) {
        const pc = ph ? (color(getComputedStyle(el, '::placeholder').color) || [0.357, 0.404, 0.439, 1]) : color(cs.color);
        const pl = px(cs.paddingLeft) + px(cs.borderLeftWidth), pr = px(cs.paddingRight) + px(cs.borderRightWidth);
        const fs = px(cs.fontSize), lh = cs.lineHeight === 'normal' ? fs * 1.21 : px(cs.lineHeight);
        const multi = tag === 'TEXTAREA';
        const y = multi ? px(cs.paddingTop) + px(cs.borderTopWidth) : (rect.height - lh) / 2;
        const node = { t: 'x', s: v, x: r2(pl), y: r2(y), w: r2(rect.width - pl - pr), h: r2(multi ? rect.height - y * 2 : lh), ml: multi ? 1 : 0, clipW: 1, fs: r2(fs), fw: WEIGHT(cs.fontWeight), it: 0, lh: r2(lh), ls: 0, c: pc, al: 'LEFT', tc: '', td: '' };
        if (target === frame) { node.x = r2(node.x + rel.x); node.y = r2(node.y + rel.y); }
        target.ch.push(node);
      }
      return;
    }
    for (const child of el.childNodes) {
      if (child.nodeType === 3) { const tn = textNode(child, cs, box); if (tn) target.ch.push(tn); }
      else if (child.nodeType === 1) walk(child, target, box);
    }
  }

  const root = { t: 'f', n: 'screen', x: 0, y: 0, w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, ch: [] };
  const bodyBg = color(getComputedStyle(document.body).backgroundColor) || color(getComputedStyle(document.documentElement).backgroundColor) || [1, 1, 1, 1];
  root.fill = [{ c: bodyBg }];
  for (const child of document.body.childNodes) if (child.nodeType === 1) walk(child, root, { x: 0, y: 0 });
  return { root, shots };
};

/* Pseudo-elements (switch knobs, breadcrumb slashes, the current-page bar…) become real spans so they can be captured */
window.__figMaterialize = function () {
  const style = document.createElement('style');
  style.textContent = '.fig-nb::before{content:none!important}.fig-na::after{content:none!important}';
  const todo = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('.ms')) continue;
    for (const which of ['::before', '::after']) {
      const cs = getComputedStyle(el, which);
      const content = cs.content;
      if (!content || content === 'none' || content === 'normal' || cs.display === 'none') continue;
      const props = {}; for (const p of cs) props[p] = cs.getPropertyValue(p);
      let txt = ''; const m = content.match(/^"(.*)"$/); if (m) txt = m[1]; else if (/^attr\(/.test(content)) txt = el.getAttribute(content.slice(5, -1)) || '';
      todo.push({ el, which, props, txt });
    }
  }
  todo.forEach(({ el, which, props, txt }) => {
    const span = document.createElement('span'); span.setAttribute('data-pseudo', which);
    for (const [p, v] of Object.entries(props)) { if (p === 'content') continue; try { span.style.setProperty(p, v); } catch (e) { /* skip */ } }
    span.textContent = txt;
    if (which === '::before') el.insertBefore(span, el.firstChild); else el.appendChild(span);
    el.classList.add(which === '::before' ? 'fig-nb' : 'fig-na');
  });
  document.head.appendChild(style);
  return todo.length;
};
