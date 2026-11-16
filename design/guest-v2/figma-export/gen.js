/* Turn out/*.json captures into use_figma calls:
   calls/00-vars.js (color variables with Light/Dark modes, named after the prototype's CSS tokens),
   calls/01-lib-*.js (icon glyph and SVG asset components), calls/NN-<id>.js (one per screen).
   Usage: node gen.js <libFrameId> */
const fs = require('fs'), path = require('path'); const { chromium } = require('playwright');
const HERE = __dirname, OUT = path.join(HERE, 'out'), CALLS = path.join(HERE, 'calls');
const LIB = process.argv[2] || 'LIB';
fs.rmSync(CALLS, { recursive: true, force: true }); fs.mkdirSync(CALLS);
const index = JSON.parse(fs.readFileSync(path.join(OUT, 'index.json')));
const caps = index.map(e => JSON.parse(fs.readFileSync(path.join(OUT, e.id + '.json'))));
const BUILDER = fs.readFileSync(path.join(HERE, 'builder.js'), 'utf8');
const PRUNE_LATER = true;

// glyph names from the icon library
const IC = {}; const ICDIR = path.join(HERE, '..', '..', 'icons', 'svg');
for (const f of fs.readdirSync(ICDIR)) { const m = fs.readFileSync(path.join(ICDIR, f), 'utf8').match(/ d="([^"]+)"/); if (m && !IC[m[1]]) IC[m[1]] = f.replace(/\.svg$/, ''); }

(async () => {
  // CSS color tokens, resolved in light and dark
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.join(HERE, '..', 'guest-flow.html')); await p.waitForTimeout(1500);
  const tokens = await p.evaluate(() => { const s = document.querySelector('#screen'); const res = {};
    const read = () => { const cs = getComputedStyle(s); const names = []; for (const k of cs) if (k.startsWith('--')) names.push(k);
      const probe = document.createElement('i'); s.appendChild(probe); const o = {};
      for (const n of names) { probe.style.color = ''; probe.style.color = `var(${n})`; const v = cs.getPropertyValue(n).trim(); if (!/^(#|rgb|hsl|color-mix|var\()/.test(v)) continue; const c = getComputedStyle(probe).color; if (/rgb/.test(c)) o[n] = c; }
      probe.remove(); return o; };
    s.classList.remove('dark'); res.light = read(); s.classList.add('dark'); res.dark = read(); s.classList.remove('dark'); return res; });
  await b.close();
  const norm = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); const v = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v.length > 3 ? Math.round(v[3] * 1000) / 1000 : 1].join(','); };
  const tokByPair = {};
  for (const n of Object.keys(tokens.light)) { if (!tokens.dark[n]) continue; const k = norm(tokens.light[n]) + '|' + norm(tokens.dark[n]); (tokByPair[k] = tokByPair[k] || []).push(n.slice(2)); }

  // pair every color reference of the light tree with the dark tree's
  const pairs = [], pIdx = new Map(); const pair = (l, d) => { const k = l + '|' + d; if (!pIdx.has(k)) { pIdx.set(k, pairs.length); pairs.push(k); } return pIdx.get(k); };
  const refs = n => { const r = []; // [obj, key] slots holding a color index, in a fixed order
    if (n.c != null && (n.k === 'T')) r.push([n, 'c']);
    if (n.fl) n.fl.forEach(f => { if (f.c != null) r.push([f, 'c']); if (f.s) f.s.forEach(s => r.push([s, 1])); });
    if (n.st) r.push([n.st, 'c']); if (n.fx) n.fx.forEach(e => { if (e.c != null) r.push([e, 'c']); });
    if (n.p) n.p.forEach(x => r.push([x, 1])); return r; };
  const walk2 = (a, b, fn) => { fn(a, b); (a.ch || []).forEach((c, i) => walk2(c, b ? b.ch[i] : null, fn)); };
  const svgs = [], sIdx = new Map(); const svgName = (mk, n) => { if (!sIdx.has(mk)) { sIdx.set(mk, svgs.length); svgs.push({ mk, n: 'asset/' + (n || 'svg').split(' ')[0].replace(/[^\w-]/g, '') + '-' + (svgs.length + 1) }); } return svgs[sIdx.get(mk)].n; };
  const glyphs = new Set(); const mism = [];
  // drop layers that a later opaque sibling hides completely (e.g. the app under the onboarding overlay)
  const opaque = (n, cols) => n.k === 'F' && n.o == null && n.fl && n.fl.some(f => f.c != null && +cols[f.c].split(',')[3] === 1) && !n.r;
  const prune = (n, cols) => { if (!n.ch) return; n.ch = n.ch.filter((c, i) => !n.ch.slice(i + 1).some(o => opaque(o, cols) && o.x <= c.x + 0.5 && o.y <= c.y + 0.5 && o.x + o.w >= c.x + c.w - 0.5 && o.y + o.h >= c.y + c.h - 0.5)); n.ch.forEach(c => prune(c, cols)); };
  for (const cap of caps) {
    if (cap.same) { /* prune both trees identically: decide on light, apply same indexes to dark */ const pr = (l, d) => { if (!l.ch) return; const keep = l.ch.map((c, i) => !l.ch.slice(i + 1).some(o => opaque(o, cap.light.colors) && o.x <= c.x + 0.5 && o.y <= c.y + 0.5 && o.x + o.w >= c.x + c.w - 0.5 && o.y + o.h >= c.y + c.h - 0.5)); l.ch = l.ch.filter((_, i) => keep[i]); d.ch = d.ch.filter((_, i) => keep[i]); l.ch.forEach((c, i) => pr(c, d.ch[i])); }; pr(cap.light.tree, cap.dark.tree); }
    else { prune(cap.light.tree, cap.light.colors); prune(cap.dark.tree, cap.dark.colors); }
    const L = cap.light, D = cap.dark;
    if (cap.same) {
      walk2(L.tree, D.tree, (a, b) => { const cats = n => { const c = { t: [], f: [], s: [], e: [], p: [] }; if (n.c != null && n.k === 'T') c.t.push([n, 'c']); if (n.fl) n.fl.forEach(f => { if (f.c != null) c.f.push([f, 'c']); if (f.s) f.s.forEach(x => c.f.push([x, 1])); }); if (n.st) c.s.push([n.st, 'c']); if (n.fx) n.fx.forEach(e => { if (e.c != null) c.e.push([e, 'c']); }); if (n.p) n.p.forEach(x => c.p.push([x, 1])); return c; };
        const ca = cats(a), cb = cats(b); for (const key of Object.keys(ca)) { const A = ca[key], B = cb[key]; if (A.length !== B.length) mism.push(cap.id + ':' + (a.n || a.t || a.k) + ':' + key);
          A.forEach(([o, k], i) => { const l = L.colors[o[k]]; const m = B[i]; if (!m) { const j = pairs.findIndex(x => x.startsWith(l + '|')); o[k] = j >= 0 ? j : pair(l, l); return; } o[k] = pair(l, D.colors[m[0][m[1]]]); }); }
        if (a.k === 'S') { a.sn = svgName(L.svgs[a.s], a.n); a.dsn = svgName(D.svgs[b.s], b.n); }
        if (a.k === 'I') a.p.forEach(x => { x[0] = L.glyphs[x[0]]; glyphs.add(x[0]); }); });
    } else {
      const byL = l => pairs.findIndex(k => k.startsWith(l + '|')), byD = d => pairs.findIndex(k => k.endsWith('|' + d));
      // pass 1 light (pair with self until dark pass finds better matches), pass 2 dark
      walk2(L.tree, null, a => { refs(a).forEach(([o, k]) => { const l = L.colors[o[k]]; const i = byL(l); o[k] = i >= 0 ? i : pair(l, l); }); if (a.k === 'S') a.sn = svgName(L.svgs[a.s], a.n); if (a.k === 'I') a.p.forEach(x => { x[0] = L.glyphs[x[0]]; glyphs.add(x[0]); }); });
      walk2(D.tree, null, a => { refs(a).forEach(([o, k]) => { const d = D.colors[o[k]]; const i = byD(d); o[k] = i >= 0 ? i : pair(d, d); }); if (a.k === 'S') a.sn = svgName(D.svgs[a.s], a.n); if (a.k === 'I') a.p.forEach(x => { x[0] = D.glyphs[x[0]]; glyphs.add(x[0]); }); });
    }
  }
  // variable names
  const used = new Set(); const hex = c => '#' + c.split(',').slice(0, 3).map(v => (+v).toString(16).padStart(2, '0')).join('').toUpperCase() + (+c.split(',')[3] < 1 ? ' ' + Math.round(+c.split(',')[3] * 100) + '%' : '');
  const names = pairs.map((k, i) => { const t = (tokByPair[k] || []).sort((a, b) => a.length - b.length)[0]; let n = t ? 'token/' + t : 'other/' + hex(k.split('|')[0]).replace('#', '') + (k.split('|')[0] === k.split('|')[1] ? '' : ' → ' + hex(k.split('|')[1]).replace('#', '')); n = n.replace(/[.{}]/g, '_'); let u = n, j = 2; while (used.has(u)) u = n + ' ' + j++; used.add(u); return u; });
  const rgba = c => { const v = c.split(',').map(Number); const r4 = x => Math.round(x * 10000) / 10000; return { r: r4(v[0] / 255), g: r4(v[1] / 255), b: r4(v[2] / 255), a: v[3] }; };
  const VARS = pairs.map((k, i) => [names[i], rgba(k.split('|')[0]), rgba(k.split('|')[1])]);
  fs.writeFileSync(path.join(CALLS, '00-vars.js'), `const VARS=${JSON.stringify(VARS)};
let c=(await figma.variables.getLocalVariableCollectionsAsync()).find(c=>c.name==='Prototype colors');
if(!c){c=figma.variables.createVariableCollection('Prototype colors');c.renameMode(c.modes[0].modeId,'Light');c.addMode('Dark')}
const L=c.modes[0].modeId,D=c.modes[1].modeId;const have={};for(const id of c.variableIds){const v=await figma.variables.getVariableByIdAsync(id);have[v.name]=v}
for(const [n,l,d] of VARS){const v=have[n]||figma.variables.createVariable(n,c,'COLOR');v.setValueForMode(L,l);v.setValueForMode(D,d);v.scopes=['ALL_FILLS','STROKE_COLOR','EFFECT_COLOR']}
return {collection:c.id,count:VARS.length};`);
  // library components: glyphs and SVG assets
  const libItems = [...[...glyphs].map(d => ({ n: 'glyph/' + (IC[d] || 'unknown-' + d.length), svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 -960 960 960"><path fill="#000" d="${d}"/></svg>`, g: 1, d })), ...svgs.map(s => ({ n: s.n, svg: s.mk }))];
  const gName = {}; libItems.filter(x => x.g).forEach(x => { gName[x.d] = x.n; });
  let chunk = [], size = 0, ci = 0; const flush = () => { if (!chunk.length) return; fs.writeFileSync(path.join(CALLS, `01-lib-${ci++}.js`), `const ITEMS=${JSON.stringify(chunk.map(x => [x.n, x.svg, x.g ? 1 : 0]))};
const LIB=await figma.getNodeByIdAsync('${LIB}');const have=new Set(LIB.children.map(c=>c.name));let x=LIB.children.length;
for(const [n,svg,g] of ITEMS){if(have.has(n))continue;const f=figma.createNodeFromSvg(svg);const c=figma.createComponentFromNode(f);c.name=n;LIB.appendChild(c);
 if(g)c.findAll(v=>v.type==='VECTOR').forEach(v=>v.constraints={horizontal:'SCALE',vertical:'SCALE'});else c.findAll(()=>true).forEach(v=>{if('constraints' in v)v.constraints={horizontal:'SCALE',vertical:'SCALE'}});
 c.x=(x%20)*64;c.y=Math.floor(x/20)*64;x++}
return {lib:LIB.children.length};`); chunk = []; size = 0; };
  for (const it of libItems) { if (size + it.svg.length > 17000) flush(); chunk.push(it); size += it.svg.length + it.n.length + 10; } flush();
  // screens
  const bySec = {}; caps.forEach(c => (bySec[c.section] = bySec[c.section] || []).push(c));
  let n = 10; const report = [];
  for (const [sec, list] of Object.entries(bySec)) {
    let x = 80;
    for (const cap of list) {
      const L = cap.light; const vmap = {}; const gl = [], glI = new Map(), sv = [], svI = new Map();
      const swap = [];
      const prep = (t, pth) => { refs(t).forEach(([o, k]) => { vmap[o[k]] = names[o[k]]; });
        if (t.k === 'I') t.p.forEach(p => { const nm = gName[p[0]]; if (!glI.has(nm)) { glI.set(nm, gl.length); gl.push(nm); } p[0] = glI.get(nm); });
        if (t.k === 'S') { const add = nm => { if (!svI.has(nm)) { svI.set(nm, sv.length); sv.push(nm); } return svI.get(nm); }; t.s = add(t.sn); if (t.dsn && t.dsn !== t.sn) { add(t.dsn); swap.push([pth, t.dsn]); } delete t.sn; delete t.dsn; delete t.n; }
        (t.ch || []).forEach((c, i) => prep(c, pth.concat(i))); };
      prep(L.tree, []);
      const th = [{ tree: L.tree, x, y: 200, clone: cap.same ? { x: x + L.w + 80, y: 200, swap } : null }];
      if (!cap.same) { prep(cap.dark.tree, []); th.push({ tree: cap.dark.tree, x: x + L.w + 80, y: 200, dark: 1 }); }
      // the builder looks components up by name through D.gl / D.sv
      const data = { sec, label: cap.label, lib: LIB, v: vmap, gl, sv, th };
      const code = `const D=${JSON.stringify(data)};\n` + BUILDER;
      const file = `${n++}-${cap.id}.js`; fs.writeFileSync(path.join(CALLS, file), code);
      report.push([file, code.length]); x += L.w * 2 + 80 + 200;
    }
  }
  console.log('mismatched nodes', mism); console.log('pairs', pairs.length, 'named', names.filter(n => n.startsWith('token/')).length, 'glyphs', glyphs.size, 'svgs', svgs.length, 'unknown glyphs', [...glyphs].filter(d => !IC[d]).length);
  report.forEach(r => console.log(r.join('  ')));
})();
