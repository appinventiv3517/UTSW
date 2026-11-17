/* UTSW MyCare Admin – Screens: Figma plugin main code.
   The UI (ui.html) holds the captured screens. For each screen it sends a node tree; this file rebuilds it as editable
   Figma layers: frames with fills, borders, radii and shadows; Inter text layers; images for icons and the phone preview;
   vectors for the logos. Screens land on one page per section (or one page), in a row per section. */
figma.showUI(__html__, { width: 460, height: 720, themeColors: true });

const STYLE = { 100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black' };
const fontCache = {};
async function fontFor(weight, italic) {
  const key = weight + (italic ? 'i' : '');
  if (fontCache[key]) return fontCache[key];
  const base = STYLE[weight] || 'Regular';
  const tries = italic ? [base === 'Regular' ? 'Italic' : base + ' Italic', base] : [base];
  tries.push('Regular');
  for (const style of tries) {
    try { await figma.loadFontAsync({ family: 'Inter', style }); fontCache[key] = { family: 'Inter', style }; return fontCache[key]; } catch (e) { /* try the next style */ }
  }
  await figma.loadFontAsync({ family: 'Roboto', style: 'Regular' });
  fontCache[key] = { family: 'Roboto', style: 'Regular' };
  return fontCache[key];
}

const imageCache = {};
function imageHash(id, assets) {
  if (!imageCache[id]) { const a = assets[id]; if (!a) return null; imageCache[id] = figma.createImage(figma.base64Decode(a.d)).hash; }
  return imageCache[id];
}
const rgb = c => ({ r: c[0], g: c[1], b: c[2] });
const solid = c => ({ type: 'SOLID', color: rgb(c), opacity: c[3] });
/* CSS linear-gradient angle → Figma gradient transform (node space 0–1 → gradient space) */
function linear(g) {
  const rad = g.angle * Math.PI / 180, sx = Math.sin(rad), sy = -Math.cos(rad);
  const start = [0.5 - sx / 2, 0.5 - sy / 2], ux = sx, uy = sy, L2 = ux * ux + uy * uy || 1;
  const a = ux / L2, b = uy / L2, c = -(start[0] * ux + start[1] * uy) / L2;
  const d = -uy / L2, e = ux / L2, f = 0.5 - (start[0] * -uy + start[1] * ux) / L2;
  return { type: 'GRADIENT_LINEAR', gradientTransform: [[a, b, c], [d, e, f]], gradientStops: g.stops.map(s => ({ position: Math.min(1, Math.max(0, s.p)), color: { r: s.c[0], g: s.c[1], b: s.c[2], a: s.c[3] } })) };
}
const size = (n, w, h) => n.resize(Math.max(0.01, w), Math.max(0.01, h));

function styleFrame(f, n) {
  f.fills = (n.fill || []).map(p => p.g ? linear(p.g) : solid(p.c));
  if (n.r) { f.topLeftRadius = n.r[0]; f.topRightRadius = n.r[1]; f.bottomRightRadius = n.r[2]; f.bottomLeftRadius = n.r[3]; }
  if (n.st) {
    f.strokes = [solid(n.st.c)];
    f.strokeAlign = n.st.a || 'INSIDE';
    const w = n.st.w;
    if (w[0] === w[1] && w[1] === w[2] && w[2] === w[3]) f.strokeWeight = w[0];
    else { f.strokeTopWeight = w[0]; f.strokeRightWeight = w[1]; f.strokeBottomWeight = w[2]; f.strokeLeftWeight = w[3]; }
    if (n.st.dash) f.dashPattern = [4, 3];
  }
  if (n.fx) f.effects = n.fx.map(x => ({ type: x.k, color: { r: x.c[0], g: x.c[1], b: x.c[2], a: x.c[3] }, offset: { x: x.x, y: x.y }, radius: x.b, spread: x.s, visible: true, blendMode: 'NORMAL' }));
  if (n.o != null) f.opacity = n.o;
  f.clipsContent = !!n.clip;
}

let count = 0;
async function build(n, parent, assets) {
  count++;
  if (n.t === 'f') {
    const f = figma.createFrame();
    f.name = n.n || 'frame';
    parent.appendChild(f);
    f.x = n.x; f.y = n.y; size(f, n.w, n.h);
    styleFrame(f, n);
    for (const c of n.ch || []) await build(c, f, assets);
    return f;
  }
  if (n.t === 'x') {
    const t = figma.createText();
    t.fontName = await fontFor(n.fw, n.it);
    parent.appendChild(t);
    t.characters = n.s;
    t.fontSize = n.fs;
    t.lineHeight = { value: n.lh, unit: 'PIXELS' };
    if (n.ls) t.letterSpacing = { value: n.ls, unit: 'PIXELS' };
    t.fills = [solid(n.c)];
    if (n.tc) t.textCase = n.tc;
    if (n.td) t.textDecoration = n.td;
    t.textAlignHorizontal = n.al || 'LEFT';
    if (n.ml || n.clipW) {
      t.resize(Math.max(1, n.w + (n.clipW ? 0 : 2)), Math.max(1, n.h));
      t.textAutoResize = 'HEIGHT';
      if (n.clipW) { try { t.textTruncation = 'ENDING'; t.maxLines = 1; } catch (e) { /* older Figma */ } }
    }
    else { t.textAutoResize = 'WIDTH_AND_HEIGHT'; if (n.al === 'RIGHT') { t.x = n.x + n.w - t.width; t.y = n.y; return t; } if (n.al === 'CENTER') { t.x = n.x + (n.w - t.width) / 2; t.y = n.y; return t; } }
    t.x = n.x; t.y = n.y;
    return t;
  }
  if (n.t === 'img') {
    const r = figma.createRectangle();
    r.name = n.icon ? `icon / ${n.n}` : n.n || 'image';
    parent.appendChild(r);
    r.x = n.x; r.y = n.y; size(r, n.w, n.h);
    const h = imageHash(n.a, assets);
    r.fills = h ? [{ type: 'IMAGE', imageHash: h, scaleMode: 'FILL' }] : [];
    return r;
  }
  if (n.t === 'svg') {
    try {
      const v = figma.createNodeFromSvg(n.svg);
      v.name = n.n || 'svg';
      parent.appendChild(v);
      v.x = n.x; v.y = n.y; size(v, n.w, n.h);
      return v;
    } catch (e) { return null; }
  }
  if (n.t === 'ctl') {
    const box = n.k === 'radio' ? figma.createEllipse() : figma.createRectangle();
    box.name = n.k === 'radio' ? `radio${n.on ? ' / on' : ''}` : `checkbox${n.on ? ' / on' : ''}`;
    parent.appendChild(box);
    box.x = n.x; box.y = n.y; size(box, n.w, n.h);
    if (n.k !== 'radio') box.cornerRadius = 3;
    box.fills = n.on && n.k !== 'radio' ? [solid(n.c)] : [solid([1, 1, 1, 1])];
    box.strokes = [solid(n.on ? n.c : [0.48, 0.53, 0.56, 1])]; box.strokeWeight = n.on && n.k === 'radio' ? Math.max(1.5, n.w * 0.28) : 1.5; box.strokeAlign = 'INSIDE';
    return box;
  }
  return null;
}

const pages = {};
const placed = {};
async function pageFor(name) {
  if (pages[name]) return pages[name];
  let pg = figma.root.children.find(p => p.name === name);
  if (!pg) { pg = figma.createPage(); pg.name = name; }
  await pg.loadAsync();
  pages[name] = pg;
  return pg;
}
const created = [];
figma.ui.onmessage = async msg => {
  if (msg.type === 'screen') {
    try {
      const sc = msg.screen;
      const pageName = msg.perSection ? `Admin – ${sc.group}` : 'UTSW MyCare Admin – Screens';
      const pg = await pageFor(pageName);
      const rowKey = `${pageName}|${msg.perSection ? '' : sc.group}`;
      if (!placed[pageName]) placed[pageName] = { rows: {}, nextY: Math.max(0, ...pg.children.map(c => c.y + c.height + 240)) || 0 };
      const P = placed[pageName];
      if (!P.rows[rowKey]) { P.rows[rowKey] = { x: 0, y: P.nextY, h: 0 }; }
      const row = P.rows[rowKey];
      const frame = await build({ ...sc.root, n: `${sc.group} / ${sc.name}` }, pg, msg.assets);
      frame.x = row.x; frame.y = row.y; frame.clipsContent = true;
      frame.setPluginData('route', sc.route);
      row.x += sc.w + 160; row.h = Math.max(row.h, sc.h);
      P.nextY = Math.max(P.nextY, row.y + row.h + 320);
      created.push(frame);
      figma.ui.postMessage({ type: 'built', id: sc.id });
    } catch (e) {
      figma.ui.postMessage({ type: 'failed', id: msg.screen.id, error: String(e && e.message || e) });
    }
  }
  if (msg.type === 'finish') {
    if (created.length) {
      await figma.setCurrentPageAsync(created[0].parent);
      figma.viewport.scrollAndZoomIntoView(created.filter(f => f.parent === created[0].parent));
    }
    figma.notify(`Created ${created.length} screen${created.length === 1 ? '' : 's'} (${count.toLocaleString('en-US')} layers).`);
    created.length = 0; count = 0;
  }
  if (msg.type === 'close') figma.closePlugin();
};
