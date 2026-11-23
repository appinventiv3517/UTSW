/* UTSW MyCare Admin – auto-layout screens import.
   Builds admin-autolayout.json as native Figma layers: every frame is an auto-layout frame (direction, padding,
   spacing, alignment, and Hug / Fill / Fixed sizing on each axis), text is editable Inter text, and icons are
   instances of vector Material Symbols components. Each flow gets its own page; re-running replaces the screens. */
figma.showUI(__html__, { width: 360, height: 300 });
const say = (msg, done) => figma.ui.postMessage({ msg, done });
const tick = () => new Promise(r => setTimeout(r, 0));

figma.ui.onmessage = async m => {
  if (m.type !== 'build') return;
  try { await run(JSON.parse(m.text), m.flows); }
  catch (e) { say('Error: ' + (e && e.message || e), true); console.error(e); }
};

const STYLE = { 100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black' };
const fontOf = (fw, it) => ({ family: 'Inter', style: it ? (fw === 400 ? 'Italic' : `${STYLE[fw]} Italic`) : STYLE[fw] || 'Regular' });
const rgb = c => ({ r: c[0], g: c[1], b: c[2] });
const solid = c => ({ type: 'SOLID', color: rgb(c), opacity: c[3] == null ? 1 : c[3] });
/* CSS linear-gradient angle → Figma gradient transform */
function linear(g) {
  const rad = g.angle * Math.PI / 180, sx = Math.sin(rad), sy = -Math.cos(rad);
  const start = [0.5 - sx / 2, 0.5 - sy / 2], L2 = sx * sx + sy * sy || 1;
  const a = sx / L2, b = sy / L2, c = -(start[0] * sx + start[1] * sy) / L2;
  const d = -sy / L2, e = sx / L2, f = 0.5 - (start[0] * -sy + start[1] * sx) / L2;
  return { type: 'GRADIENT_LINEAR', gradientTransform: [[a, b, c], [d, e, f]], gradientStops: g.stops.map(s => ({ position: Math.min(1, Math.max(0, s.p)), color: { r: s.c[0], g: s.c[1], b: s.c[2], a: s.c[3] } })) };
}
const paints = fl => (fl || []).map(p => p.c ? solid(p.c) : linear(p.g));
const ALIGN = { MIN: 'MIN', CENTER: 'CENTER', MAX: 'MAX', SPACE_BETWEEN: 'SPACE_BETWEEN' };

function styleFrame(f, n) {
  f.fills = paints(n.fill);
  if (n.st) {
    f.strokes = [solid(n.st.c)];
    f.strokeAlign = n.st.out ? 'OUTSIDE' : 'INSIDE';
    const [t, r, b, l] = n.st.w;
    if (t === r && r === b && b === l) f.strokeWeight = t;
    else { f.strokeTopWeight = t; f.strokeRightWeight = r; f.strokeBottomWeight = b; f.strokeLeftWeight = l; }
    if (n.st.dash) f.dashPattern = [4, 4];
  }
  if (n.r) { const [tl, tr, br, bl] = n.r; if (tl === tr && tr === br && br === bl) f.cornerRadius = tl; else { f.topLeftRadius = tl; f.topRightRadius = tr; f.bottomRightRadius = br; f.bottomLeftRadius = bl; } }
  if (n.fx) f.effects = n.fx.map(e => ({ type: e.k, color: { ...rgb(e.c), a: e.c[3] }, offset: { x: e.x, y: e.y }, radius: e.b, spread: e.s, visible: true, blendMode: 'NORMAL' }));
  if (n.o != null) f.opacity = n.o;
  f.clipsContent = !!n.clip;
}

let ICON = {}, nodes = 0, fixed = 0;
function build(n, parent) {
  nodes++;
  let node;
  if (n.k === 'T') {
    const t = figma.createText();
    t.fontName = fontOf(n.fw, 0);
    t.characters = n.chars;
    t.fontSize = n.fs;
    t.lineHeight = { value: n.lh, unit: 'PIXELS' };
    if (n.ls) t.letterSpacing = { value: n.ls, unit: 'PIXELS' };
    t.fills = [solid(n.c)];
    t.textAlignHorizontal = n.al || 'LEFT';
    if (n.va) t.textAlignVertical = n.va;
    for (const r of n.runs || []) {
      const s = r.st, a = r.s, b = r.e;
      if (b <= a) continue;
      t.setRangeFontName(a, b, fontOf(s.fw, s.it));
      t.setRangeFontSize(a, b, s.fs);
      t.setRangeFills(a, b, [solid(s.c)]);
      if (s.ls) t.setRangeLetterSpacing(a, b, { value: s.ls, unit: 'PIXELS' });
      if (s.td) t.setRangeTextDecoration(a, b, s.td === 'U' ? 'UNDERLINE' : 'STRIKETHROUGH');
      if (s.tc) t.setRangeTextCase(a, b, s.tc);
    }
    t.name = n.n || n.chars.slice(0, 40);
    if (n.single) { t.setPluginData('single', '1'); t.setPluginData('lh', String(n.lh)); }
    if (n.auto === 'WH') t.textAutoResize = 'WIDTH_AND_HEIGHT';
    else { t.resize(Math.max(1, n.w), Math.max(1, n.h)); t.textAutoResize = 'HEIGHT'; }
    node = t;
  } else if (n.k === 'I') {
    const comp = ICON[`${n.g}${n.f ? '-fill' : ''}`];
    const inst = comp ? comp.createInstance() : figma.createFrame();
    const s = Math.min(n.w, n.h, n.fs || n.w);
    inst.resize(s, s);
    if (comp) inst.findAll(x => x.type === 'VECTOR').forEach(v => { v.fills = [solid(n.c)]; });
    if (Math.abs(n.w - n.h) > 0.5 || Math.abs(s - n.w) > 0.5) {
      /* The icon's line box is taller or wider than the glyph: a fixed frame centers it */
      const f = figma.createFrame(); f.fills = []; f.clipsContent = false;
      f.layoutMode = 'HORIZONTAL'; f.primaryAxisAlignItems = 'CENTER'; f.counterAxisAlignItems = 'CENTER';
      f.resize(n.w, n.h); f.appendChild(inst); node = f;
    } else node = inst;
    node.name = n.n;
  } else if (n.k === 'S') {
    const v = figma.createNodeFromSvg(n.svg);
    v.findAll(() => true).forEach(x => { if ('constraints' in x) x.constraints = { horizontal: 'SCALE', vertical: 'SCALE' }; });
    if (v.width > 0) v.rescale(n.w / v.width);
    v.resize(n.w, n.h); v.name = n.n || 'Logo'; v.clipsContent = false;
    node = v;
  } else if (n.k === 'C') {
    const f = figma.createFrame(); f.name = n.n;
    f.resize(n.w, n.h); f.fills = n.on && n.t === 'checkbox' ? [solid(n.c)] : [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    f.strokes = [solid(n.on ? n.c : [0.5, 0.545, 0.588, 1])]; f.strokeWeight = n.on && n.t === 'radio' ? 2 : 1.5; f.strokeAlign = 'INSIDE';
    f.cornerRadius = n.t === 'radio' ? n.w / 2 : 4;
    f.layoutMode = 'HORIZONTAL'; f.primaryAxisAlignItems = 'CENTER'; f.counterAxisAlignItems = 'CENTER';
    if (n.on && n.t === 'radio') { const dot = figma.createFrame(); dot.name = 'dot'; dot.resize(n.w * 0.5, n.h * 0.5); dot.cornerRadius = n.w / 4; dot.fills = [solid(n.c)]; f.appendChild(dot); }
    node = f;
  } else {
    const f = figma.createFrame();
    f.name = n.n || 'Frame';
    f.resize(Math.max(0.01, n.w), Math.max(0.01, n.h));
    styleFrame(f, n);
    if (n.lay) {
      f.layoutMode = n.lay === 'H' ? 'HORIZONTAL' : 'VERTICAL';
      [f.paddingTop, f.paddingRight, f.paddingBottom, f.paddingLeft] = n.pad;
      f.itemSpacing = n.gap || 0;
      f.primaryAxisAlignItems = ALIGN[n.pa] || 'MIN';
      f.counterAxisAlignItems = n.ca === 'BASELINE' ? 'BASELINE' : ALIGN[n.ca] || 'MIN';
      f.primaryAxisSizingMode = 'FIXED'; f.counterAxisSizingMode = 'FIXED';
    } else {
      /* Empty boxes (a blank input, a backdrop) are fixed-size auto-layout frames too */
      f.layoutMode = 'VERTICAL'; f.primaryAxisSizingMode = 'FIXED'; f.counterAxisSizingMode = 'FIXED';
    }
    node = f;
    for (const c of n.ch || []) build(c, f);
    f.resize(Math.max(0.01, n.w), Math.max(0.01, n.h));
  }
  parent.appendChild(node);
  /* Sizing and placement only mean something once the layer sits in its auto-layout parent */
  if (parent.type === 'FRAME' && parent.layoutMode !== 'NONE') {
    if (n.abs) { node.layoutPositioning = 'ABSOLUTE'; node.x = n.x; node.y = n.y; }
    else {
      const canHug = n.k === 'T' || (n.k === 'F' && !!n.lay);
      const fix = v => (v === 'HUG' && !canHug ? 'FIXED' : v);
      try { node.layoutSizingHorizontal = fix(n.sh || 'FIXED'); } catch (e) { node.layoutSizingHorizontal = 'FIXED'; }
      try { node.layoutSizingVertical = fix(n.sv || 'FIXED'); } catch (e) { node.layoutSizingVertical = 'FIXED'; }
      /* A text box with a fixed height (a 44 px link target) keeps that height; its lines sit by textAlignVertical */
      if (n.k === 'T' && node.layoutSizingVertical === 'FIXED' && Math.abs(node.height - n.h) > 0.01) node.resize(node.width, n.h);
    }
  } else if (n.x != null) { node.x = n.x; node.y = n.y; }
  return node;
}

async function run(D, pick) {
  if (D.format !== 'utsw-admin-autolayout') throw new Error('This isn’t an admin-autolayout.json file.');
  /* Fonts: Inter in every weight and style the screens use */
  const styles = new Set(['Regular']);
  const visit = n => { if (n.k === 'T') { styles.add(fontOf(n.fw, 0).style); (n.runs || []).forEach(r => styles.add(fontOf(r.st.fw, r.st.it).style)); } (n.ch || []).forEach(visit); };
  D.flows.forEach(f => f.screens.forEach(s => visit(s.tree)));
  for (const st of styles) { try { await figma.loadFontAsync({ family: 'Inter', style: st }); } catch (e) { throw new Error(`Inter ${st} isn’t available. Install Inter (rsms.me/inter) or open the file in the Figma desktop app.`); } }
  say(`Fonts ready: Inter ${[...styles].join(', ')}`);

  /* Icon components on their own page */
  let cpage = figma.root.children.find(p => p.name === 'Admin – Components');
  if (!cpage) { cpage = figma.createPage(); cpage.name = 'Admin – Components'; }
  await cpage.loadAsync();
  let lib = cpage.findChild(n => n.name === 'Icons – Material Symbols Rounded');
  if (!lib) { lib = figma.createFrame(); lib.name = 'Icons – Material Symbols Rounded'; cpage.appendChild(lib);
    lib.layoutMode = 'HORIZONTAL'; lib.layoutWrap = 'WRAP'; lib.itemSpacing = 24; lib.counterAxisSpacing = 24;
    [lib.paddingTop, lib.paddingRight, lib.paddingBottom, lib.paddingLeft] = [32, 32, 32, 32]; lib.resize(960, 100); lib.primaryAxisSizingMode = 'FIXED'; lib.counterAxisSizingMode = 'AUTO'; lib.cornerRadius = 16; }
  ICON = {}; for (const c of lib.children) if (c.type === 'COMPONENT') ICON[c.name.replace(/^icon\//, '')] = c;
  for (const [k, svg] of Object.entries(D.icons)) {
    if (ICON[k]) continue;
    const v = figma.createNodeFromSvg(svg);
    v.findAll(() => true).forEach(x => { if ('constraints' in x) x.constraints = { horizontal: 'SCALE', vertical: 'SCALE' }; });
    v.resize(24, 24);
    const c = figma.createComponentFromNode(v); c.name = `icon/${k}`; c.fills = []; c.clipsContent = false;
    lib.appendChild(c); ICON[k] = c;
  }
  say(`Icons: ${Object.keys(ICON).length} components`);

  /* Screens: one page per flow, four screens a row, in order */
  let done = 0; nodes = 0; fixed = 0;
  const total = D.flows.filter(f => !pick || pick.includes(f.name)).reduce((s, f) => s + f.screens.length, 0);
  for (const flow of D.flows) {
    if (pick && !pick.includes(flow.name)) continue;
    const name = `Admin – ${flow.name}`;
    let page = figma.root.children.find(p => p.name === name);
    if (!page) { page = figma.createPage(); page.name = name; }
    await page.loadAsync();
    for (const s of flow.screens) { const old = page.findChild(n => n.name === s.name); if (old) old.remove(); }
    const GAP = 200, PER = 4;
    let rowY = 0, rowH = 0;
    for (let i = 0; i < flow.screens.length; i++) {
      const s = flow.screens[i];
      const f = build(s.tree, page);
      f.name = s.name; f.clipsContent = true;
      /* One-line labels must stay on one line: if Figma's Inter measures a hair wider than the browser's and a label
         wraps, it hugs its text instead (it moves by a fraction of a pixel at most) */
      for (const t of f.findAll(x => x.type === 'TEXT')) {
        if (t.getPluginData('single') === '1' && t.textAutoResize === 'HEIGHT' && t.height > +t.getPluginData('lh') * 1.5) { t.textAutoResize = 'WIDTH_AND_HEIGHT'; fixed++; }
      }
      const col = i % PER;
      if (col === 0 && i) { rowY += rowH + GAP; rowH = 0; }
      f.x = col * (s.w + GAP); f.y = rowY; rowH = Math.max(rowH, f.height);
      done++; say(`${done}/${total} ${s.name}`); await tick();
    }
  }
  say(`Done: ${done} screens, ${nodes} layers, all auto layout.${fixed ? ` ${fixed} one-line labels set to hug so they don’t wrap.` : ''}`, true);
  figma.notify(`UTSW Admin: ${done} auto-layout screens imported`);
}
