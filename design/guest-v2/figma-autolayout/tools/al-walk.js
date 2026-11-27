/* Runs inside the Admin portal page. Records the rendered screen as a box tree for the auto-layout exporter:
   every element's exact box (page coordinates), its visual style, its text (with styled runs), icons, images and form
   controls. Layout is NOT decided here: al-convert.js infers Figma auto layout from these boxes and checks it. */
window.__alWalk = function (opts) {
  'use strict';
  /* Inline SVG with every color resolved (currentColor, CSS variables), sized to its box */
  function svgOf(el, box) {
    const c = el.cloneNode(true), src = [el, ...el.querySelectorAll('*')], dst = [c, ...c.querySelectorAll('*')];
    src.forEach((s, i) => { const d = dst[i], cs = getComputedStyle(s); d.removeAttribute('class'); d.removeAttribute('style');
      if (i && s.tagName.toLowerCase() !== 'g') { if (cs.fill && cs.fill !== 'none') d.setAttribute('fill', cs.fill); else if (cs.fill === 'none') d.setAttribute('fill', 'none');
        if (cs.stroke && cs.stroke !== 'none') { d.setAttribute('stroke', cs.stroke); d.setAttribute('stroke-width', cs.strokeWidth); }
        if (+cs.opacity < 1) d.setAttribute('opacity', cs.opacity); if (+cs.fillOpacity < 1) d.setAttribute('fill-opacity', cs.fillOpacity); } });
    c.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); c.setAttribute('width', box.w); c.setAttribute('height', box.h);
    ['aria-hidden', 'focusable', 'role', 'aria-label'].forEach(a => c.removeAttribute(a));
    return c.outerHTML;
  }
  opts = opts || {};
  const px = v => parseFloat(v) || 0;
  const r2 = v => Math.round(v * 100) / 100;
  function color(s) {
    if (!s) return null;
    let m = s.match(/^rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); const a = p.length > 3 ? p[3] : 1; return a > 0.001 ? [r2(p[0] / 255 * 1000) / 1000, r2(p[1] / 255 * 1000) / 1000, r2(p[2] / 255 * 1000) / 1000, r2(a)] : null; }
    m = s.match(/^color\(srgb ([^)]+)\)/);
    if (m) { const p = m[1].split(/[\s/]+/).filter(Boolean).map(Number); const a = p.length > 3 ? p[3] : 1; return a > 0.001 ? [p[0], p[1], p[2], r2(a)] : null; }
    return null;
  }
  function colorAny(s) { const m = s.match(/\(([^)]+)\)/); if (!m) return [0, 0, 0, 0]; const p = m[1].replace(/^srgb /, '').split(/[\s,/]+/).filter(Boolean).map(Number); const k = /^rgb/.test(s) ? 255 : 1; return [p[0] / k, p[1] / k, p[2] / k, p.length > 3 ? p[3] : 1]; }
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
      const nums = (part.replace(cm ? cm[1] : '', '').match(/-?[\d.]+px/g) || []).map(px);
      return { c, inset: /\binset\b/.test(part), x: nums[0] || 0, y: nums[1] || 0, b: nums[2] || 0, s: nums[3] || 0 };
    }).filter(x => x.c);
  }
  function gradient(s) {
    if (!s || s === 'none') return null;
    const layer = splitTop(s).find(l => l.startsWith('linear-gradient('));
    if (!layer) return null;
    const args = splitTop(layer.slice(16, -1));
    let angle = 180;
    if (/deg$/.test(args[0])) angle = px(args.shift());
    else if (/^to /.test(args[0])) { const t = args.shift(); angle = { 'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270 }[t] ?? 180; }
    const stops = args.map((a, i) => { const cm = a.match(/(rgba?\([^)]+\)|color\([^)]+\))/); if (!cm) return null;
      const c = color(cm[1]) || colorAny(cm[1]); const pm = a.replace(cm[1], '').match(/([\d.]+)%/);
      return { c, p: pm ? px(pm[1]) / 100 : (args.length > 1 ? i / (args.length - 1) : 0) }; }).filter(Boolean);
    return stops.length > 1 ? { angle, stops } : null;
  }
  const WEIGHT = w => Math.min(900, Math.max(100, Math.round((+w || 400) / 100) * 100));
  const lineH = cs => { const fs = px(cs.fontSize); return cs.lineHeight === 'normal' ? r2(fs * 1.21) : r2(px(cs.lineHeight)); };

  /* Visual style of a box: fills, border (as an inside stroke), shadows, radii, opacity, clipping */
  function boxStyle(cs, el) {
    const out = {};
    const fills = [];
    const bg = color(cs.backgroundColor), gr = gradient(cs.backgroundImage);
    if (bg) fills.push({ c: bg });
    if (gr) fills.push({ g: gr });
    if (fills.length) out.fill = fills;
    const bw = ['Top', 'Right', 'Bottom', 'Left'].map(k => /none|hidden/.test(cs[`border${k}Style`]) ? 0 : px(cs[`border${k}Width`]));
    const bc = ['Top', 'Right', 'Bottom', 'Left'].map(k => color(cs[`border${k}Color`]));
    if (bw.some((w, i) => w > 0 && bc[i])) { const i = bw.findIndex((w, k) => w > 0 && bc[k]); out.st = { c: bc[i], w: bw.map((w, k) => bc[k] ? w : 0), dash: /dash|dot/.test(cs.borderTopStyle) ? 1 : 0 }; }
    const fx = [];
    shadows(cs.boxShadow).forEach(sh => {
      /* A spread-only shadow is how the portal draws thin outlines: an outside or inside stroke */
      if (!sh.x && !sh.y && !sh.b && sh.s > 0 && !out.st) { out.st = { c: sh.c, w: [sh.s, sh.s, sh.s, sh.s], out: sh.inset ? 0 : 1 }; return; }
      fx.push({ k: sh.inset ? 'INNER_SHADOW' : 'DROP_SHADOW', c: sh.c, x: sh.x, y: sh.y, b: sh.b, s: sh.s });
    });
    if (fx.length) out.fx = fx;
    const rad = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map(px);
    if (rad.some(Boolean)) { const r = el.getBoundingClientRect(); const cap = Math.min(r.width, r.height) / 2; out.r = rad.map(v => r2(Math.min(v, cap))); }
    const op = px(cs.opacity);
    if (op < 0.999) out.o = r2(op);
    if (/hidden|clip|auto|scroll/.test(cs.overflowX + cs.overflowY)) out.clip = 1;
    return out;
  }
  const hasPaint = st => !!(st.fill || st.st || st.fx);
  const pads = cs => [px(cs.paddingTop) + px(cs.borderTopWidth), px(cs.paddingRight) + px(cs.borderRightWidth), px(cs.paddingBottom) + px(cs.borderBottomWidth), px(cs.paddingLeft) + px(cs.borderLeftWidth)].map(r2);
  const boxOf = r => ({ x: r2(r.left + scrollX), y: r2(r.top + scrollY), w: r2(r.width), h: r2(r.height) });
  /* Hints the converter uses where boxes alone are ambiguous */
  const hints = cs => ({ d: cs.display, fd: cs.flexDirection, jc: cs.justifyContent, ai: cs.alignItems, fg: px(cs.flexGrow), gc: px(cs.columnGap), gr: px(cs.rowGap), ta: cs.textAlign, wr: cs.flexWrap === 'wrap' ? 1 : 0 });

  function nameOf(el) {
    const tag = el.tagName.toLowerCase();
    if (el.id && !/^(dd|tbl)-/.test(el.id)) return `${tag}#${el.id}`;
    if (/^h[1-6]$/.test(tag)) return `${tag} – ${el.textContent.trim().slice(0, 40)}`;
    if (tag === 'button' || (tag === 'a' && el.classList.contains('btn'))) return `Button – ${(el.getAttribute('aria-label') || el.textContent).trim().replace(/\s+/g, ' ').slice(0, 40)}`;
    const cls = [...el.classList].filter(c => !/^fig-/.test(c)).slice(0, 2).join('.');
    return cls ? `${tag}.${cls}` : tag;
  }
  const hidden = (el, cs, r) => cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse' || px(cs.opacity) === 0
    || el.classList.contains('vh') || el.classList.contains('dd-native') || (r.width <= 1.5 && r.height <= 1.5 && /absolute|fixed/.test(cs.position));
  const INLINE_BOX = new Set(['IMG', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'SVG', 'IFRAME', 'CANVAS']);

  /* An element whose content is only text and plain inline elements becomes one text layer with styled runs */
  function inlineOnly(el) {
    let text = false;
    for (const n of el.childNodes) {
      if (n.nodeType === 3) { if (n.nodeValue.trim()) text = true; continue; }
      if (n.nodeType !== 1) continue;
      if (n.tagName === 'BR') continue;
      const cs = getComputedStyle(n);
      if (cs.display === 'none') continue;
      if (n.classList.contains('vh')) continue;
      if (!/^inline$/.test(cs.display) || INLINE_BOX.has(n.tagName) || n.classList.contains('ms') || hasPaint(boxStyle(cs, n)) || px(cs.paddingLeft) + px(cs.paddingRight) > 0) return false;
      const sub = inlineOnly(n); if (sub === false) return false; if (sub) text = true;
    }
    return text ? true : null;
  }
  /* Text runs: whitespace collapsed across the element, one run per differently styled stretch */
  function textRuns(el) {
    const parts = [];
    const visit = (n, cs) => {
      if (n.nodeType === 3) { parts.push({ s: n.nodeValue, cs }); return; }
      if (n.nodeType !== 1 || (n.classList && n.classList.contains('vh'))) return;
      if (n.tagName === 'BR') { parts.push({ s: '\n', cs, br: 1 }); return; }
      const c2 = getComputedStyle(n); if (c2.display === 'none') return;
      for (const k of n.childNodes) visit(k, c2);
    };
    const cs0 = getComputedStyle(el);
    for (const k of el.childNodes) visit(k, cs0);
    let chars = '', runs = [];
    for (const p of parts) {
      let s = p.br ? '\n' : (/^pre/.test(p.cs.whiteSpace) ? p.s : p.s.replace(/\s+/g, ' '));
      if (!p.br && (chars.endsWith(' ') || chars.endsWith('\n') || !chars)) s = s.replace(/^ +/, '');
      if (!s) continue;
      const st = { fw: WEIGHT(p.cs.fontWeight), c: color(p.cs.color) || [0, 0, 0, 1], fs: r2(px(p.cs.fontSize)), it: p.cs.fontStyle === 'italic' ? 1 : 0,
        td: /underline/.test(p.cs.textDecorationLine) ? 'U' : /line-through/.test(p.cs.textDecorationLine) ? 'S' : '', tc: p.cs.textTransform === 'uppercase' ? 'UPPER' : '',
        ls: p.cs.letterSpacing === 'normal' ? 0 : r2(px(p.cs.letterSpacing)) };
      const a = chars.length; chars += s;
      const last = runs[runs.length - 1];
      if (last && JSON.stringify(last.st) === JSON.stringify(st)) last.e = chars.length; else runs.push({ s: a, e: chars.length, st });
    }
    const t = chars.replace(/[ \n]+$/, '');
    runs = runs.map(r => ({ ...r, e: Math.min(r.e, t.length) })).filter(r => r.e > r.s);
    return { chars: t, runs };
  }
  function inkOf(node) {
    const rg = document.createRange(); rg.selectNodeContents(node);
    const rects = [...rg.getClientRects()].filter(r => r.width > 0.5 && r.height > 0.5);
    if (!rects.length) return null;
    const l = Math.min(...rects.map(r => r.left)), t = Math.min(...rects.map(r => r.top)), rr = Math.max(...rects.map(r => r.right)), b = Math.max(...rects.map(r => r.bottom));
    return { x: r2(l + scrollX), y: r2(t + scrollY), w: r2(rr - l), h: r2(b - t), lines: new Set(rects.map(r => Math.round(r.top))).size };
  }
  function textLeaf(el, cs, box) {
    const { chars, runs } = textRuns(el);
    if (!chars.trim()) return null;
    const ink = inkOf(el);
    const base = runs[0].st;
    return { k: 'T', n: chars.slice(0, 40), box, ink, chars, runs, fs: base.fs, fw: base.fw, c: base.c, lh: lineH(cs), ls: base.ls,
      al: { center: 'CENTER', right: 'RIGHT', end: 'RIGHT', justify: 'JUSTIFIED' }[cs.textAlign] || 'LEFT', lines: ink ? ink.lines : 1, h: hints(cs) };
  }
  /* A loose text run between element siblings (for example a button's label written as plain text) */
  function looseText(tn, cs) {
    const s = tn.nodeValue.replace(/\s+/g, ' ').trim(); if (!s) return null;
    const raw = tn.nodeValue, a0 = raw.search(/\S/), a1 = raw.length - raw.split('').reverse().join('').search(/\S/);
    const rg = document.createRange(); rg.setStart(tn, a0); rg.setEnd(tn, a1);
    const rects = [...rg.getClientRects()].filter(r => r.width > 0.5); if (!rects.length) return null;
    const l = Math.min(...rects.map(r => r.left)), rr = Math.max(...rects.map(r => r.right)), t = Math.min(...rects.map(r => r.top)), b = Math.max(...rects.map(r => r.bottom));
    const lh = lineH(cs), box = { x: r2(l + scrollX), y: r2(t + scrollY - (lh - (b - t)) / 2), w: r2(rr - l), h: lh };
    const st = { fw: WEIGHT(cs.fontWeight), c: color(cs.color) || [0, 0, 0, 1], fs: r2(px(cs.fontSize)), it: 0, td: '', tc: cs.textTransform === 'uppercase' ? 'UPPER' : '', ls: cs.letterSpacing === 'normal' ? 0 : r2(px(cs.letterSpacing)) };
    return { k: 'T', n: s.slice(0, 40), box, ink: { ...box, lines: new Set(rects.map(r => Math.round(r.top))).size }, chars: s, runs: [{ s: 0, e: s.length, st }], fs: st.fs, fw: st.fw, c: st.c, lh, ls: st.ls, al: 'LEFT', lines: 1, h: hints(cs), loose: 1 };
  }

  const overlays = [];   /* fixed and top-layer boxes, lifted to the screen level */
  function walk(el) {
    if (el.nodeType !== 1 || /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT|LINK|META|BR|WBR)$/.test(el.tagName)) return null;
    if (el.tagName === 'DIALOG' && !el.open) return null;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (hidden(el, cs, r)) return null;
    /* Prototype-only notes and the keyboard skip link are not part of the design */
    if (el.matches(opts.exclude || '.skip, .sim-note, .auth-flag')) return null;
    if (cs.display === 'contents') return { k: 'contents', ch: [...el.childNodes].map(n => n.nodeType === 1 ? walk(n) : null).filter(Boolean) };
    const box = boxOf(r);
    if (r.width < 0.5 || r.height < 0.5) {
      /* A zero-size box that clips shows nothing (a filter chip's hidden check mark) */
      if (/hidden|clip/.test(cs.overflowX + cs.overflowY)) return null;
      /* Zero-size wrappers can still hold visible absolutely positioned children */
      const kids = [...el.children].map(walk).filter(Boolean);
      return kids.length ? { k: 'contents', ch: kids } : null;
    }
    const negM = ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'].some(k => px(cs[k]) < -0.5) && el.parentElement && el.parentElement.children.length > 1;
    const pos = cs.position, abs = /absolute|fixed/.test(pos) || el.matches(':popover-open') || el.tagName === 'DIALOG' || negM;
    /* Pop-up panels (filters, user menu) are absolutely placed with a z-index: lifted to the top so they draw over later layers, as in the browser */
    const lift = pos === 'fixed' || el.matches(':popover-open') || el.tagName === 'DIALOG' || (pos === 'absolute' && +cs.zIndex >= 10);
    const st = boxStyle(cs, el);
    const base = { n: nameOf(el), box, pad: pads(cs), h: hints(cs), abs: abs ? 1 : 0, ...st };
    let node;
    if (el.tagName.toLowerCase() === 'svg') {
      node = { k: 'S', n: el.classList.contains('ic') ? 'icon' : el.closest('.sp-icon, .appicon, .ob-icon') ? 'app icon' : 'logo', box, svg: svgOf(el, box), abs: base.abs, h: base.h };
    } else if (el.tagName === 'CANVAS') {
      let d = ''; try { d = el.toDataURL('image/png'); } catch (e) { /* tainted */ }
      if (d.length < 200) return null;
      node = { k: 'P', n: '3D map (sample)', box, png: d.split(',')[1], abs: base.abs, h: base.h };
    } else if (el.classList.contains('ms')) {
      const g = el.textContent.trim(), c = color(cs.color);
      if (!g || !c) return null;
      node = { k: 'I', n: `icon/${g}`, box, g, f: /'FILL' 1/.test(cs.fontVariationSettings) || el.classList.contains('f1') ? 1 : 0, c, fs: r2(px(cs.fontSize)), abs: base.abs, h: base.h };
    } else if (el.tagName === 'IMG') {
      const src = el.getAttribute('src') || '';
      if (!src.startsWith('data:image/svg+xml;base64,')) return null;
      node = { k: 'S', n: el.getAttribute('alt') || 'logo', box, svg: atob(src.split(',')[1]), abs: base.abs, h: base.h };
    } else if (el.tagName === 'INPUT' && /radio|checkbox/.test(el.type)) {
      node = { k: 'C', n: `${el.type} – ${el.checked ? 'on' : 'off'}`, box, t: el.type, on: el.checked ? 1 : 0, c: color(cs.accentColor) || [0, 0.259, 0.471, 1], abs: base.abs, h: base.h };
    } else if (/^(INPUT|TEXTAREA)$/.test(el.tagName)) {
      if (/hidden|file|color/.test(el.type)) return null;
      let v = el.value, ph = false;
      if (!v && el.placeholder) { v = el.placeholder; ph = true; }
      if (el.type === 'password' && !ph) v = '•'.repeat(v.length);
      node = { k: 'F', ...base, ch: [] };
      if (v) {
        const p = base.pad, lh = lineH(cs), multi = el.tagName === 'TEXTAREA';
        const ty = multi ? box.y + p[0] : r2(box.y + (box.h - lh) / 2);
        const c = ph ? (color(getComputedStyle(el, '::placeholder').color) || [0.36, 0.4, 0.44, 1]) : color(cs.color);
        const tw = box.w - p[1] - p[3];
        const stt = { fw: WEIGHT(cs.fontWeight), c, fs: r2(px(cs.fontSize)), it: 0, td: '', tc: '', ls: el.type === 'password' && !ph ? 2 : 0 };
        node.ch.push({ k: 'T', n: ph ? 'placeholder' : 'value', box: { x: r2(box.x + p[3]), y: ty, w: r2(tw), h: multi ? r2(box.h - p[0] - p[2]) : lh }, ink: null, chars: v, runs: [{ s: 0, e: v.length, st: stt }],
          fs: stt.fs, fw: stt.fw, c, lh, ls: stt.ls, al: 'LEFT', lines: multi ? 2 : 1, h: hints(cs), fill: 1 });
      }
    } else if (inlineOnly(el)) {
      const p = base.pad;
      let tbox = { x: r2(box.x + p[3]), y: r2(box.y + p[0]), w: r2(box.w - p[1] - p[3]), h: r2(box.h - p[0] - p[2]) };
      /* In a flex or grid box (an avatar's initials) the text is an anonymous item placed by the box's alignment:
         its own box is its line box, not the whole content box */
      const ink = inkOf(el), lh = lineH(cs);
      if (ink) {
        const h = r2(lh * ink.lines), y = r2(ink.y - (h - ink.h) / 2);
        if (/flex|grid/.test(cs.display)) tbox = { x: ink.x, y, w: ink.w, h };
        /* A table cell or button taller than its text centers it vertically: the text box is its lines, where they sit */
        else if (h < tbox.h - 1) tbox = { ...tbox, y, h };
      }
      const t = textLeaf(el, cs, tbox);
      if (!t) return null;
      /* The element's own box is only kept when it paints something or has padding */
      if (hasPaint(st) || st.o || p.some(v => v > 0.5) || base.abs) node = { k: 'F', ...base, ch: [{ ...t, abs: 0 }] };
      else node = { ...t, n: base.n, abs: base.abs, box, block: /block|flex|grid|list-item|table-cell/.test(cs.display) ? 1 : 0 };
    } else {
      node = { k: 'F', ...base, ch: [] };
      for (const c of el.childNodes) {
        if (c.nodeType === 3) { const t = looseText(c, cs); if (t) node.ch.push(t); continue; }
        const k = walk(c); if (!k) continue;
        if (k.k === 'contents') node.ch.push(...flat(k)); else node.ch.push(k);
      }
      if (el.tagName === 'DIALOG') {
        const bd = getComputedStyle(el, '::backdrop');
        overlays.push({ k: 'F', n: 'Backdrop', box: { x: 0, y: 0, w: innerWidth, h: opts.height || innerHeight }, pad: [0, 0, 0, 0], h: {}, abs: 1, fill: color(bd.backgroundColor) ? [{ c: color(bd.backgroundColor) }] : [{ c: [0.05, 0.1, 0.15, 0.5] }], ch: [] });
      }
    }
    if (node && cs) { const zi = cs.zIndex === 'auto' ? null : +cs.zIndex, positioned = cs.position !== 'static';
      node.zk = !positioned ? 0 : zi == null ? 1 : zi < 0 ? zi - 1 : 1 + zi; }
    if (lift) { overlays.push(node); return null; }
    return node;
  }
  const flat = k => k.k === 'contents' ? k.ch.flatMap(flat) : [k];

  const body = document.body, bcs = getComputedStyle(body);
  const W = document.documentElement.clientWidth, H = opts.height || document.documentElement.scrollHeight;
  const root = { k: 'F', n: opts.name || 'Screen', box: { x: 0, y: 0, w: W, h: H }, pad: [0, 0, 0, 0], h: { d: 'block' }, abs: 0, root: 1, clip: 1,
    fill: [{ c: color(bcs.backgroundColor) || color(getComputedStyle(document.documentElement).backgroundColor) || [1, 1, 1, 1] }], ch: [] };
  for (const c of body.childNodes) { const k = walk(c); if (k) root.ch.push(...flat(k)); }
  root.ch.push(...overlays.map(o => ({ ...o, abs: 1 })));
  return root;
};
