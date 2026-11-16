/* Figma plugin-side runtime: builds one captured screen as native layers. The generator prepends
   `const D = {...}` (screen data) and appends nothing; this file must stay plain JS for use_figma. */
const PG = await figma.getNodeByIdAsync('101:2'); await figma.setCurrentPageAsync(PG);
const STY = { 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black' };
await Promise.all(Object.values(STY).map(s => figma.loadFontAsync({ family: 'Inter', style: s })));
const COLL = (await figma.variables.getLocalVariableCollectionsAsync()).find(c => c.name === 'Prototype colors');
const LIGHT = COLL.modes[0].modeId, DARK = COLL.modes[1].modeId;
const VARS = {}; for (const id of COLL.variableIds) { const v = await figma.variables.getVariableByIdAsync(id); VARS[v.name] = v; }
const LIB = await figma.getNodeByIdAsync(D.lib); const COMP = {};
for (const c of LIB.children) COMP[c.name] = c;
const V = i => { const v = VARS[D.v[i]]; if (!v) throw new Error('missing var ' + D.v[i]); return v; };
const lightOf = i => V(i).valuesByMode[LIGHT];
const SOL = i => figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, 'color', V(i));
const paint = p => {
  if (p.c != null) return SOL(p.c);
  return { type: p.g === 'L' ? 'GRADIENT_LINEAR' : 'GRADIENT_RADIAL', gradientTransform: p.m,
    gradientStops: p.s.map(([pos, ci]) => ({ position: pos, color: lightOf(ci), boundVariables: { color: figma.variables.createVariableAlias(V(ci)) } })) };
};
const effect = e => {
  if (e.t === 'B') return { type: 'BACKGROUND_BLUR', radius: e.b, visible: true };
  const ef = { type: e.t === 'I' ? 'INNER_SHADOW' : 'DROP_SHADOW', color: lightOf(e.c), offset: { x: e.x, y: e.y }, radius: e.b, spread: e.s, visible: true, blendMode: 'NORMAL' };
  return figma.variables.setBoundVariableForEffect(ef, 'color', V(e.c));
};
let count = 0;
function build(n, parent) {
  count++;
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
    const mk = (p) => { const i = COMP[D.gl[p[0]]].createInstance(); i.resize(Math.max(n.w, 1), Math.max(n.h, 1)); i.findAll(x => x.type === 'VECTOR').forEach(v => v.fills = [SOL(p[1])]); if (p[2] < 1) i.opacity = p[2]; return i; };
    let node;
    if (n.p.length === 1) { node = mk(n.p[0]); parent.appendChild(node); }
    else { node = figma.createFrame(); node.fills = []; node.clipsContent = false; node.resize(Math.max(n.w, 1), Math.max(n.h, 1)); parent.appendChild(node); n.p.forEach(p => { const i = mk(p); node.appendChild(i); i.x = 0; i.y = 0; }); }
    node.name = D.gl[n.p[n.p.length - 1][0]].replace('glyph/', 'icon/'); node.x = n.x; node.y = n.y; return node;
  }
  if (n.k === 'S') {
    const i = COMP[D.sv[n.s]].createInstance(); i.resize(Math.max(n.w, 1), Math.max(n.h, 1)); parent.appendChild(i); i.x = n.x; i.y = n.y; return i;
  }
  const f = figma.createFrame(); f.name = n.n || 'frame'; if (/^tab-ind/.test(f.name)) parent.insertChild(0, f); else parent.appendChild(f);
  f.resize(Math.max(n.w, 0.01), Math.max(n.h, 0.01)); f.x = n.x; f.y = n.y;
  f.fills = n.fl ? n.fl.map(paint) : []; f.clipsContent = !!n.c;
  if (n.st) { f.strokes = [SOL(n.st.c)]; f.strokeAlign = 'INSIDE';
    if (Array.isArray(n.st.w)) { [f.strokeTopWeight, f.strokeRightWeight, f.strokeBottomWeight, f.strokeLeftWeight] = n.st.w; } else f.strokeWeight = n.st.w;
    if (n.st.d) f.dashPattern = [Math.max(...[].concat(n.st.w)) * 3, Math.max(...[].concat(n.st.w)) * 2]; }
  if (n.r != null) { if (Array.isArray(n.r)) { [f.topLeftRadius, f.topRightRadius, f.bottomRightRadius, f.bottomLeftRadius] = n.r; } else f.cornerRadius = n.r; }
  if (n.fx) f.effects = n.fx.map(effect);
  if (n.o != null) f.opacity = n.o;
  if (n.ch) for (const c of n.ch) build(c, f);
  return f;
}
const SEC = PG.findChild(s => s.type === 'SECTION' && s.name === D.sec);
const out = [];
for (const th of D.th) {
  const root = build(th.tree, SEC);
  root.name = D.label + ' — ' + (th.dark ? 'Dark' : 'Light'); root.x = th.x; root.y = th.y; root.clipsContent = true;
  root.setExplicitVariableModeForCollection(COLL, th.dark ? DARK : LIGHT);
  if (th.swap) for (const [path, comp] of th.swap) { let n = root; for (const i of path) n = n.children[i]; n.swapComponent(COMP[comp]); }
  out.push(root.id); SEC.resizeWithoutConstraints(Math.max(SEC.width, th.x + root.width * (th.clone ? 2 : 1) + 200), Math.max(SEC.height, th.y + root.height + 120));
  if (th.clone) { const c = root.clone(); SEC.appendChild(c); c.name = D.label + ' — Dark'; c.x = th.clone.x; c.y = th.clone.y; c.setExplicitVariableModeForCollection(COLL, DARK);
    for (const [path, comp] of th.clone.swap || []) { let n = c; for (const i of path) n = n.children[i]; n.swapComponent(COMP[comp]); }
    out.push(c.id); }
}
return { ids: out, nodes: count };
