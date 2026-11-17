/* Builds the Admin portal into one self-contained HTML file (the published Artifact), plus a Dashboard-only build
   with `--mode dashboard`. The Material Symbols font is requested with only the glyphs the code names. */
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
  /* The phone preview: its ICONS map (concept → glyph), ico('x') and circle('x') calls, and glyphs in its markup */
  const pvJs = fs.readFileSync(path.join(SRC, 'preview/mobile.js'), 'utf8'), pvHtml = fs.readFileSync(path.join(SRC, 'preview/mobile.html'), 'utf8');
  const icons = (pvJs.match(/const ICONS = \{([\s\S]*?)\};/) || ['', ''])[1];
  for (const m of icons.matchAll(/\w+: '([a-z0-9_]+)'/g)) set.add(m[1]);
  for (const m of pvJs.matchAll(/\b(?:ico|circle)\('([a-z0-9_]+)'/g)) set.add(m[1]);
  for (const m of pvHtml.matchAll(/class="ms[^"]*"[^>]*>([a-z0-9_]+)</g)) set.add(m[1]);
  /* Concept keys of the ICONS map that are not glyphs themselves */
  const keys = new Set([...icons.matchAll(/(\w+): '[a-z0-9_]+'/g)].map(m => m[1])), vals = new Set([...icons.matchAll(/\w+: '([a-z0-9_]+)'/g)].map(m => m[1]));
  for (const k of keys) if (!vals.has(k) && !usedOutsideIcons(k)) set.delete(k);
  set.delete('f1');
  return [...set].sort();
}
/* A preview concept key such as 'checked' is only a glyph if the Admin code names it too */
function usedOutsideIcons(k: string): boolean {
  return walk(SRC).some(f => new RegExp(`(?:name|icon|glyph)[=:]\\s*\\{?['"]${k}['"]`).test(fs.readFileSync(f, 'utf8')));
}
export const iconFontUrl = (): string => 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200'
  + `&icon_names=${glyphNames().join(',')}&display=block`;
const iconFont = (): Plugin => ({
  name: 'icon-font-subset',
  transformIndexHtml(html) {
    const url = iconFontUrl();
    return html.replace('__ICON_FONT_URL__', url.replace(/&/g, '&amp;'));
  }
});

export default defineConfig(({ mode }) => ({
  plugins: [react(), iconFont(), viteSingleFile()],
  define: { __DASHBOARD_ONLY__: JSON.stringify(mode === 'dashboard'), __ICON_FONT_URL__: JSON.stringify(iconFontUrl()) },
  server: { fs: { allow: [path.resolve(__dirname, '..', '..')] } },
  build: { outDir: mode === 'dashboard' ? 'dist-dashboard' : 'dist', assetsInlineLimit: 100000000, cssCodeSplit: false, target: 'es2020' }
}));
