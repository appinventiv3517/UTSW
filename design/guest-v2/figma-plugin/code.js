// MyCare screens import: builds the prototype's captured screens (figma-export/gen.js -> mycare-screens.json)
// as native Figma layers on the current page: color variables (Light/Dark), icon and asset components,
// and every screen in light and dark, one section per page.
figma.showUI(__html__, { width: 340, height: 300 });
const say = (msg, done) => figma.ui.postMessage({ msg, done });
const tick = () => new Promise(r => setTimeout(r, 0));
const STY = { 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black' };

figma.ui.onmessage = async m => {
  if (m.type !== 'build') return;
  try { await run(JSON.parse(m.text)); }
  catch (e) { say('Error: ' + (e && e.message || e), true); }
};

async function run(B) {
  const PG = figma.currentPage;
  await Promise.all(Object.values(STY).map(s => figma.loadFontAsync({ family: 'Inter', style: s })));

  // 1. Color variables, one per light/dark pair the prototype uses
  let COLL = (await figma.variables.getLocalVariableCollectionsAsync()).find(c => c.name === 'Prototype colors');
  if (!COLL) { COLL = figma.variables.createVariableCollection('Prototype colors'); COLL.renameMode(COLL.modes[0].modeId, 'Light'); COLL.addMode('Dark'); }
  const LIGHT = COLL.modes[0].modeId, DARK = COLL.modes[1].modeId;
  const VARS = {}; for (const id of COLL.variableIds) { const v = await figma.variables.getVariableByIdAsync(id); VARS[v.name] = v; }
  for (const [n, l, d] of B.vars) { const v = VARS[n] || figma.variables.createVariable(n, COLL, 'COLOR'); v.setValueForMode(LIGHT, l); v.setValueForMode(DARK, d); v.scopes = ['ALL_FILLS', 'STROKE_COLOR', 'EFFECT_COLOR']; VARS[n] = v; }
  say('Colors: ' + B.vars.length + ' variables');

  // 2. Icon glyph and asset components, in "00 Components" > "Prototype library"
  const section = name => { let s = PG.findChild(n => n.type === 'SECTION' && n.name === name); if (!s) { s = figma.createSection(); s.name = name; PG.appendChild(s); s.resizeWithoutConstraints(1000, 1000); } return s; };
  const CS = section('00 Components');
  let LIB = CS.findChild(n => n.name === 'Prototype library');
  if (!LIB) { LIB = figma.createFrame(); LIB.name = 'Prototype library'; LIB.fills = []; LIB.clipsContent = false; CS.appendChild(LIB); LIB.x = 40; LIB.y = CS.height + 40; }
  const COMP = {}; for (const c of LIB.children) COMP[c.name] = c;
  let k = LIB.children.length;
  for (const [n, svg, g] of B.lib) {
    if (COMP[n]) continue;
    const c = figma.createComponentFromNode(figma.createNodeFromSvg(svg)); c.name = n; LIB.appendChild(c);
    c.findAll(() => true).forEach(v => { if ('constraints' in v) v.constraints = { horizontal: 'SCALE', vertical: 'SCALE' }; });
    c.x = (k % 20) * 64; c.y = Math.floor(k / 20) * 64; k++; COMP[n] = c;
  }
  LIB.resize(1280, Math.ceil(k / 20) * 64 + 40);
  CS.resizeWithoutConstraints(Math.max(CS.width, LIB.x + LIB.width + 40), Math.max(CS.height, LIB.y + LIB.height + 40));
  say('Components: ' + B.lib.length);

  // 3. Screens
  let D, nodes = 0;
  const V = i => { const v = VARS[D.v[i]]; if (!v) throw new Error('missing color ' + D.v[i]); return v; };
  const lightOf = i => V(i).valuesByMode[LIGHT];
  const SOL = i => figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, 'color', V(i));
  const paint = p => p.c != null ? SOL(p.c) : { type: p.g === 'L' ? 'GRADIENT_LINEAR' : 'GRADIENT_RADIAL', gradientTransform: p.m,
    gradientStops: p.s.map(([pos, ci]) => ({ position: pos, color: lightOf(ci), boundVariables: { color: figma.variables.createVariableAlias(V(ci)) } })) };
  const effect = e => {
    if (e.t === 'B') return { type: 'BACKGROUND_BLUR', radius: e.b, visible: true };
    const ef = { type: e.t === 'I' ? 'INNER_SHADOW' : 'DROP_SHADOW', color: lightOf(e.c), offset: { x: e.x, y: e.y }, radius: e.b, spread: e.s, visible: true, blendMode: 'NORMAL' };
    return figma.variables.setBoundVariableForEffect(ef, 'color', V(e.c));
  };
  function build(n, parent) {
    nodes++;
    if (n.k === 'T') {
      const t = figma.createText(); t.fontName = { family: 'Inter', style: STY[n.fw] || 'Regular' };
      t.fontSize = n.fs; t.lineHeight = { value: n.lh, unit: 'PIXELS' }; if (n.ls) t.letterSpacing = { value: n.ls, unit: 'PIXELS' };
      if (n.u) t.textCase = 'UPPER'; if (n.d) t.textDecoration = 'UNDERLINE';
      t.characters = n.t; t.fills = [SOL(n.c)];
      if (n.a === 'WH') t.textAutoResize = 'WIDTH_AND_HEIGHT';
      else { t.textAlignHorizontal = n.al === 'C' ? 'CENTER' : n.al === 'R' ? 'RIGHT' : 'LEFT'; t.resize(Math.max(n.w, 1), n.h); t.textAutoResize = n.ml ? 'NONE' : 'HEIGHT'; if (n.ml) { t.maxLines = n.ml; t.textTruncation = 'ENDING'; } }
      parent.appendChild(t); t.x = n.x; t.y = n.y; return t;
    }
    if (n.k === 'I') {
      const mk = p => { const i = COMP[D.gl[p[0]]].createInstance(); i.resize(Math.max(n.w, 1), Math.max(n.h, 1)); i.findAll(x => x.type === 'VECTOR').forEach(v => v.fills = [SOL(p[1])]); if (p[2] < 1) i.opacity = p[2]; return i; };
      let node;
      if (n.p.length === 1) { node = mk(n.p[0]); parent.appendChild(node); }
      else { node = figma.createFrame(); node.fills = []; node.clipsContent = false; node.resize(Math.max(n.w, 1), Math.max(n.h, 1)); parent.appendChild(node); n.p.forEach(p => { const i = mk(p); node.appendChild(i); i.x = 0; i.y = 0; }); }
      node.name = D.gl[n.p[n.p.length - 1][0]].replace('glyph/', 'icon/'); node.x = n.x; node.y = n.y; return node;
    }
    if (n.k === 'S') { const i = COMP[D.sv[n.s]].createInstance(); i.resize(Math.max(n.w, 1), Math.max(n.h, 1)); parent.appendChild(i); i.x = n.x; i.y = n.y; return i; }
    const f = figma.createFrame(); f.name = n.n || 'frame';
    if (/^tab-ind/.test(f.name)) parent.insertChild(0, f); else parent.appendChild(f);
    f.resize(Math.max(n.w, 0.01), Math.max(n.h, 0.01)); f.x = n.x; f.y = n.y;
    f.fills = n.fl ? n.fl.map(paint) : []; f.clipsContent = !!n.c;
    if (n.st) { f.strokes = [SOL(n.st.c)]; f.strokeAlign = 'INSIDE';
      if (Array.isArray(n.st.w)) { [f.strokeTopWeight, f.strokeRightWeight, f.strokeBottomWeight, f.strokeLeftWeight] = n.st.w; } else f.strokeWeight = n.st.w;
      if (n.st.d) { const w = Math.max(...[].concat(n.st.w)); f.dashPattern = [w * 3, w * 2]; } }
    if (n.r != null) { if (Array.isArray(n.r)) { [f.topLeftRadius, f.topRightRadius, f.bottomRightRadius, f.bottomLeftRadius] = n.r; } else f.cornerRadius = n.r; }
    if (n.fx) f.effects = n.fx.map(effect);
    if (n.o != null) f.opacity = n.o;
    if (n.ch) for (const c of n.ch) build(c, f);
    return f;
  }
  const walkTo = (root, path) => { let n = root; for (const i of path) n = n.children[i]; return n; };
  let done = 0;
  for (D of B.screens) {
    const SEC = section(D.sec);
    for (const c of [...SEC.children]) if (c.name === D.label + ' — Light' || c.name === D.label + ' — Dark') c.remove();
    for (const th of D.th) {
      const root = build(th.tree, SEC);
      root.name = D.label + ' — ' + (th.dark ? 'Dark' : 'Light'); root.x = th.x; root.y = th.y; root.clipsContent = true;
      root.setExplicitVariableModeForCollection(COLL, th.dark ? DARK : LIGHT);
      let right = th.x + root.width;
      if (th.clone) {
        const c = root.clone(); SEC.appendChild(c); c.name = D.label + ' — Dark'; c.x = th.clone.x; c.y = th.clone.y;
        c.setExplicitVariableModeForCollection(COLL, DARK);
        for (const [p, comp] of th.clone.swap || []) walkTo(c, p).swapComponent(COMP[comp]);
        right = c.x + c.width;
      }
      SEC.resizeWithoutConstraints(Math.max(SEC.width, right + 120), Math.max(SEC.height, th.y + root.height + 120));
    }
    done++; say(`${done}/${B.screens.length} ${D.label}`); await tick();
  }

  // 4. Stack the sections so none overlap
  let y = 0;
  for (const s of PG.children.filter(n => n.type === 'SECTION').sort((a, b) => a.name.localeCompare(b.name))) { s.x = 0; s.y = y; y += s.height + 200; }
  figma.viewport.scrollAndZoomIntoView(PG.children.filter(n => n.type === 'SECTION'));
  say(`Done: ${B.screens.length} screens, ${nodes} layers.`, true);
  figma.notify('MyCare screens imported');
}
