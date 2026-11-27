/* Merges sharded exports (SHARD=i/n) into one guest-autolayout.json: flows in export order, screens by their number.
     node merge.js out.json part0.json part1.json … */
const fs = require('fs');
const [out, ...parts] = process.argv.slice(2);
const docs = parts.map(p => JSON.parse(fs.readFileSync(p, 'utf8')));
const order = [], byFlow = {};
for (const d of docs) for (const f of d.flows) { if (!byFlow[f.name]) { byFlow[f.name] = []; order.push(f.name); } byFlow[f.name].push(...f.screens); }
const base = ['Splash and onboarding', 'Home', 'Search – empty states', 'Find Care', 'MyChart', 'Favorites', 'Wayfinding and directions'];
const rank = n => { const dark = n.endsWith(' – Dark'), b = base.indexOf(n.replace(/ – Dark$/, '')); return (dark ? 100 : 0) + (b < 0 ? 50 : b); };
order.sort((a, b) => rank(a) - rank(b));
const merged = { ...docs[0], exported: new Date().toISOString(), flows: order.map(name => ({ name, screens: byFlow[name].sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true })) })) };
fs.writeFileSync(out, JSON.stringify(merged));
console.log(merged.flows.map(f => `${f.name}: ${f.screens.length}`).join('\n'), `\n${merged.flows.reduce((s, f) => s + f.screens.length, 0)} screens → ${out}`);
