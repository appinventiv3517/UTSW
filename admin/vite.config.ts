/* Builds the Admin portal into one self-contained HTML file, admin-portal.html (the published Artifact), plus the
   Dashboard-only dashboard.html with `--mode dashboard`. `npm run build` makes both. The Material Symbols font is requested with only the glyphs the code names. */
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, 'src');
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : []);
}
/* Glyph names the code uses: <Icon name="x">, icon: 'x', glyph: 'x', ic('x'), [key, 'Label', 'glyph'] rows, and EXTRA_GLYPHS comments */
export function glyphNames(): string[] {
  const set = new Set<string>();
  for (const f of walk(SRC)) {
    const code = fs.readFileSync(f, 'utf8');
    const add = (re: RegExp) => { for (const m of code.matchAll(re)) set.add(m[1]); };
    add(/<Icon[^>]*?\bname="([a-z0-9_]+)"/g);
    add(/\b(?:icon|glyph|g)=\{?["']([a-z0-9_]+)["']/g);
    add(/\b(?:icon|glyph):\s*'([a-z0-9_]+)'/g);
    add(/\bic\('([a-z0-9_]+)'/g);
    add(/\['[a-z]+', '[A-Z][^']*', '([a-z0-9_]+)'\]/g);
    for (const m of code.matchAll(/EXTRA_GLYPHS: ([a-z0-9_ ]+)\*\//g)) m[1].split(/\s+/).filter(Boolean).forEach(g => set.add(g));
  }
  /* The phone preview: its ICONS map (concept → glyph). Concept keys that are not glyphs themselves are left out. */
  const pv = fs.readFileSync(path.join(SRC, 'preview/PhoneApp.tsx'), 'utf8');
  const icons = (pv.match(/const ICONS = \{([\s\S]*?)\};/) || ['', ''])[1];
  const vals = new Set([...icons.matchAll(/\w+: '([a-z0-9_]+)'/g)].map(m => m[1]));
  vals.forEach(g => set.add(g));
  for (const m of pv.matchAll(/<Ico k="([a-z0-9_]+)"/g)) if (!/[A-Z]/.test(m[1]) && !(icons.includes(`${m[1]}:`) && !vals.has(m[1]))) set.add(m[1]);
  set.delete('f1');
  return [...set].sort();
}
export const iconFontUrl = (): string => 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200'
  + `&icon_names=${glyphNames().join(',')}&display=block`;
const iconFont = (dashboard: boolean): Plugin => ({
  name: 'icon-font-subset',
  transformIndexHtml(html) {
    const url = iconFontUrl();
    /* Browser-tab icon: the MyCare app icon */
    const fav = 'data:image/svg+xml;base64,' + Buffer.from(fs.readFileSync(path.resolve(__dirname, '..', 'mycare-logo', 'app-icon.svg'))).toString('base64');
    const out = html.replace('__ICON_FONT_URL__', url.replace(/&/g, '&amp;')).replace('__FAVICON__', fav);
    return dashboard ? out.replace('<title>MyCare Admin</title>', '<title>MyCare Admin Dashboard</title>') : out;
  }
});

/* The published files sit beside the source: admin-portal.html (the full portal) and dashboard.html (Dashboard only) */
const publish = (dashboard: boolean): Plugin => ({
  name: 'publish-single-file',
  closeBundle() {
    const out = path.resolve(__dirname, dashboard ? 'dist-dashboard' : 'dist', 'index.html');
    if (fs.existsSync(out)) fs.copyFileSync(out, path.resolve(__dirname, dashboard ? 'dashboard.html' : 'admin-portal.html'));
  }
});

export default defineConfig(({ mode }) => ({
  plugins: [react(), iconFont(mode === 'dashboard'), viteSingleFile(), publish(mode === 'dashboard')],
  define: { __DASHBOARD_ONLY__: JSON.stringify(mode === 'dashboard'), __ICON_FONT_URL__: JSON.stringify(iconFontUrl()) },
  server: { fs: { allow: [path.resolve(__dirname, '..')] } },
  build: { outDir: mode === 'dashboard' ? 'dist-dashboard' : 'dist', assetsInlineLimit: 100000000, cssCodeSplit: false, target: 'es2020' }
}));
