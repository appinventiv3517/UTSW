/* Re-render a capture JSON as plain HTML (what the Figma builder will produce) and screenshot it,
   to compare with the prototype's own screenshot. Usage: node preview.js <id> [dark] */
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const [id, th = 'light'] = process.argv.slice(2); const cap = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', id + '.json')));
const T = th === 'dark' && !cap.same ? cap.dark : cap.light; const C = th === 'dark' ? cap.dark.colors : cap.light.colors;
const tree = th === 'dark' && cap.same ? cap.dark.tree : T.tree; const G = cap.light.glyphs, S = (th === 'dark' && !cap.same ? cap.dark : cap.light).svgs;
const css = i => 'rgba(' + C[i] + ')';
const FW = w => w;
const h = (n) => {
  const pos = `position:absolute;left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;`;
  if (n.k === 'T') return `<div style="${pos}font:${n.fw} ${n.fs}px/${n.lh}px Inter;color:${css(n.c)};${n.ls ? `letter-spacing:${n.ls}px;` : ''}${n.u ? 'text-transform:uppercase;' : ''}${n.a === 'WH' ? 'white-space:nowrap;width:auto;' : ''}text-align:${n.al === 'C' ? 'center' : n.al === 'R' ? 'right' : 'left'};${n.ml ? `overflow:hidden;display:-webkit-box;-webkit-line-clamp:${n.ml};-webkit-box-orient:vertical;` : ''}">${n.t.replace(/</g, '&lt;')}</div>`;
  if (n.k === 'I') return `<svg style="${pos}" viewBox="0 -960 960 960">${n.p.map(p => `<path d="${G[p[0]]}" fill="${css(p[1])}" opacity="${p[2]}"/>`).join('')}</svg>`;
  if (n.k === 'S') return `<div style="${pos}">${S[n.s]}</div>`;
  const bg = (n.fl || []).filter(f => f.c != null).map(f => css(f.c))[0];
  const r = n.r == null ? '' : `border-radius:${[].concat(n.r).map(v => v + 'px').join(' ')};`;
  const st = n.st ? `box-shadow:inset 0 0 0 ${[].concat(n.st.w)[0]}px ${css(n.st.c)};` : '';
  const grad = (n.fl || []).some(f => f.g) ? 'background-image:linear-gradient(45deg,rgba(255,0,255,.25),rgba(0,255,255,.25));' : '';
  return `<div title="${(n.n || '').replace(/"/g, '')}" style="${pos}${bg ? `background:${bg};` : ''}${grad}${r}${st}${n.c ? 'overflow:hidden;' : ''}${n.o != null ? `opacity:${n.o};` : ''}">${(n.ch || []).map(h).join('')}</div>`;
};
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: T.w || cap.light.w, height: cap.light.h } });
  await p.setContent(`<body style="margin:0">${h(tree)}</body>`); await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(__dirname, 'out', `${id}-${th}-rebuilt.png`), fullPage: true }); await b.close(); })();
