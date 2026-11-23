/* ---------- At a facility (guest app, Nov 19 design + geolocation): why you're here, guest nearby, places and catalogs, 3D map and directions ----------
   Each is a single record with the shared lifecycle (draft → demo → production, versions and rollback). Everything is sample data. */
/* EXTRA_GLYPHS: restaurant local_pharmacy wc support_agent self_improvement elevator local_parking door_front science medical_information cardiology accessibility_new stethoscope calendar_month person medical_services map view_in_ar layers volume_up directions_car */
import type { ReactNode } from 'react';
import type { Page } from '../app/App';
import { defineSingleton, RowsEditor, type EditorProps } from './config-pages';
import { Badge, Icon, Segmented } from '../ui/kit';
import { appContent, layoutFor } from '../ui/preview';
import { Form, type FormSection, type Errors } from '../ui/forms';
import { same } from '../app/util';
import type { Data } from '../app/types';

interface Row extends Data { id: string }
const GLYPHS: [string, string][] = [['restaurant', 'Food'], ['local_pharmacy', 'Pharmacy'], ['wc', 'Restrooms'], ['support_agent', 'Information desk'], ['self_improvement', 'Chapel or quiet room'],
  ['elevator', 'Elevators'], ['local_parking', 'Parking'], ['door_front', 'Entrance'], ['science', 'Lab'], ['medical_information', 'Imaging'], ['cardiology', 'Heart'],
  ['accessibility_new', 'Rehab'], ['stethoscope', 'Primary care'], ['calendar_month', 'Appointment'], ['person', 'Visitor'], ['medical_services', 'Care'], ['map', 'Map']];
const glyphLabel = (g: string) => (GLYPHS.find(x => x[0] === g) || [g, g])[1];
const IconCell = ({ g, children }: { g: string; children: ReactNode }) => <span className="cell-icon"><Icon name={g} size={20} /><span className="cell-2">{children}</span></span>;
const shown = (r: Row) => <Badge kind={r.on ? 'visible' : 'hidden'} text={r.on ? 'Shown' : 'Hidden'} />;
const uniq = (key: string, label: string) => (v: Data, others: Row[]): Errors =>
  others.some(r => String(r[key]).trim().toLowerCase() === String(v[key]).trim().toLowerCase()) ? { [key]: `“${v[key]}” is already a ${label}.` } : {};
/* Changes per list, for confirmations and history */
const rowDiff = (label: string, a: Row[] = [], b: Row[] = [], name: (r: Row) => string) => [
  ...b.filter(r => !a.some(x => x.id === r.id)).map(r => `${label} added: ${name(r)}`),
  ...a.filter(r => !b.some(x => x.id === r.id)).map(r => `${label} removed: ${name(r)}`),
  ...b.filter(r => { const o = a.find(x => x.id === r.id); return o && !same(o, r); }).map(r => `${label} edited: ${name(r)}`)];
const show = (v: unknown) => v === true ? 'on' : v === false ? 'off' : String(v ?? '');
const fieldDiff = (a: Data | null, b: Data, keys: [string, string][]) => keys.filter(([k]) => !a || !same(a[k], b[k])).map(([k, l]) => `${l}: ${show(b[k])}`);
/* The phone preview: Home at a facility (or a place page, or Wayfinding) with this record's working copy */
const pv = (id: string, screen: string, what: string) => (d: Data, src: string) => ({ screen, layout: layoutFor('guest'), content: appContent({ overrides: { [id]: d } }), focus: screen === 'facility' ? 'alerts' : undefined,
  label: src === 'working' ? `your ${what}, not live` : `${src} ${what}` });
const Side = ({ title, items }: { title: string; items: ReactNode[] }) => <><h2 className="side-h">{title}</h2><ul className="side-list">{items.map((x, i) => <li key={i}>{x}</li>)}</ul></>;

/* ---- Why you're here ---- */
const WHY_TOP: FormSection[] = [{ fields: [
  { key: 'enabled', label: 'Ask guests why they’re here when they arrive at a facility', type: 'switch' },
  { key: 'title', label: 'Question', required: true, max: 60 },
  { key: 'note', label: 'Privacy line', max: 60, hint: 'Shown under the answers.' },
  { key: 'askOnce', label: 'Ask once per visit (the answer stays on the phone; guests can change it)', type: 'switch' }] }];
const WHY_ROW: FormSection[] = [{ fields: [
  { key: 'label', label: 'Answer', required: true, max: 32 }, { key: 'hint', label: 'Hint', max: 48, hint: 'One line under the answer, for example where it leads.' },
  { key: 'glyph', label: 'Icon', type: 'select', options: GLYPHS },
  { key: 'leadsTo', label: 'Home shows', type: 'select', options: ['Sign in, or pick the clinic', 'Visiting hours and the information desk', 'Lab and imaging waits and prices', 'Pharmacy hours and directions', '911 note and doctors open today', 'Everything near you'] },
  { key: 'on', label: 'Show this answer', type: 'switch' }] }];
const whyPages = defineSingleton({
  route: 'facility-why', id: 'facility-why', area: 'facility', section: 'Wayfinding and facilities', title: 'Why you’re here', noun: 'why you’re here setting',
  lede: 'At a facility, the guest home asks once what brings someone in, then reshapes the top of Home around the answer. Answers stay on the phone.',
  formTitle: 'Question and answers',
  validate: d => !String(d.title || '').trim() ? { title: 'Enter the question.' } : !(d.rows as Row[]).some(r => r.on) ? { rows: 'Show at least one answer.' } : {},
  describe: (a, b) => [...fieldDiff(a, b, [['enabled', 'Ask on arrival'], ['title', 'Question'], ['note', 'Privacy line'], ['askOnce', 'Ask once']]), ...rowDiff('Answer', a?.rows, b.rows, r => r.label)],
  Editor: ({ working, set, ro }: EditorProps) => <>
    <Form sections={WHY_TOP.map(s => ({ ...s, fields: s.fields.map(f => ({ ...f, readonly: ro })) }))} data={working} prefix="why" onChange={set} />
    <RowsEditor<Row> rows={working.rows} onRows={rows => set({ ...working, rows })} noun="answer" caption="Answers, in order" ro={ro} rowTitle={r => r.label} searchText={r => `${r.label} ${r.hint}`}
      columns={[{ key: 'label', label: 'Answer', render: r => <IconCell g={r.glyph}><span>{r.label}</span><span className="muted">{r.hint}</span></IconCell> },
        { key: 'leadsTo', label: 'Home shows', render: r => r.leadsTo, cls: 'wrap' }, { key: 'on', label: 'Status', render: shown }]}
      sections={WHY_ROW} blank={() => ({ label: '', hint: '', glyph: 'map', leadsTo: 'Everything near you', on: true })} validate={uniq('label', 'answer')} /></>,
  preview: pv('facility-why', 'facility', 'why you’re here'),
  sideStatic: d => <Side title="What guests see" items={[d.enabled ? `“${d.title}” on Home at a facility` : 'The question is off', `${(d.rows as Row[]).filter(r => r.on).length} answers, plus Not now`, d.note || 'No privacy line', 'A “Here for: … · Change” bar after they answer']} />
});

/* ---- Guest nearby ---- */
const NEAR_TOP: FormSection[] = [{ title: 'Sections on Home at a facility', fields: [
  { key: 'careOn', label: 'Care near you (sorted by walking time)', type: 'switch' },
  { key: 'doctorsOn', label: 'Doctors open today (information only, nothing is booked)', type: 'switch' },
  { key: 'facilitiesOn', label: 'Facilities grid', type: 'switch' },
  { key: 'doctorsCount', label: 'Doctors shown', type: 'number', min: 1, maxNum: 6 },
  { key: 'openNote', label: 'Open times note', max: 100, required: true },
  { key: 'phone', label: 'Scheduling phone number', max: 20, required: true }] }];
const CARE_ROW: FormSection[] = [{ fields: [{ key: 'name', label: 'Department', required: true, max: 40 }, { key: 'floor', label: 'Floor', type: 'number', min: 1, maxNum: 20 },
  { key: 'suite', label: 'Suite', max: 8 }, { key: 'glyph', label: 'Icon', type: 'select', options: GLYPHS }, { key: 'on', label: 'Show', type: 'switch' }] }];
const TILE_ROW: FormSection[] = [{ fields: [{ key: 'name', label: 'Facility', required: true, max: 24 }, { key: 'floor', label: 'Floor', type: 'number', min: 1, maxNum: 20 },
  { key: 'glyph', label: 'Icon', type: 'select', options: GLYPHS }, { key: 'opens', label: 'Tapping it opens', type: 'select', options: ['Place page (menu, prices or services)', 'Directions'] }, { key: 'on', label: 'Show', type: 'switch' }] }];
const nearbyPages = defineSingleton({
  route: 'facility-nearby', id: 'facility-nearby', area: 'facility', section: 'Wayfinding and facilities', title: 'Guest nearby', noun: 'guest nearby setting',
  lede: 'What a guest sees under the map on Home when location puts them at a facility: care near them, doctors open today and the facilities around them.',
  formTitle: 'Sections and lists',
  validate: d => !String(d.phone || '').trim() ? { phone: 'Enter the scheduling phone number.' } : {},
  describe: (a, b) => [...fieldDiff(a, b, [['careOn', 'Care near you'], ['doctorsOn', 'Doctors open today'], ['facilitiesOn', 'Facilities'], ['doctorsCount', 'Doctors shown'], ['openNote', 'Open times note'], ['phone', 'Phone']]),
    ...rowDiff('Department', a?.care, b.care, r => r.name), ...rowDiff('Facility', a?.tiles, b.tiles, r => r.name)],
  Editor: ({ working, set, ro }: EditorProps) => <>
    <Form sections={NEAR_TOP.map(s => ({ ...s, fields: s.fields.map(f => ({ ...f, readonly: ro })) }))} data={working} prefix="near" onChange={set} />
    <RowsEditor<Row> rows={working.care} onRows={care => set({ ...working, care })} noun="department" caption="Care near you" ro={ro} rowTitle={r => r.name} searchText={r => r.name}
      columns={[{ key: 'name', label: 'Department', render: r => <IconCell g={r.glyph}><span>{r.name}</span><span className="muted">Floor {r.floor}{r.suite ? ` · Suite ${r.suite}` : ''}</span></IconCell> }, { key: 'on', label: 'Status', render: shown }]}
      sections={CARE_ROW} blank={() => ({ name: '', floor: 1, suite: '', glyph: 'stethoscope', on: true })} validate={uniq('name', 'department')} />
    <RowsEditor<Row> rows={working.tiles} onRows={tiles => set({ ...working, tiles })} noun="facility" caption="Facilities grid" ro={ro} rowTitle={r => r.name} searchText={r => r.name}
      columns={[{ key: 'name', label: 'Facility', render: r => <IconCell g={r.glyph}><span>{r.name}</span><span className="muted">Floor {r.floor}</span></IconCell> },
        { key: 'opens', label: 'Opens', render: r => r.opens, cls: 'wrap' }, { key: 'on', label: 'Status', render: shown }]}
      sections={TILE_ROW} blank={() => ({ name: '', floor: 1, glyph: 'restaurant', opens: 'Directions', on: true })} validate={uniq('name', 'facility')} /></>,
  preview: pv('facility-nearby', 'facility', 'guest nearby'),
  sideStatic: d => <Side title="What guests see" items={[d.careOn ? `Care near you: ${(d.care as Row[]).filter(r => r.on).length} departments` : 'Care near you is off',
    d.doctorsOn ? `Doctors open today: ${d.doctorsCount}, with “${d.openNote}”` : 'Doctors open today is off', d.facilitiesOn ? `Facilities: ${(d.tiles as Row[]).filter(r => r.on).length} tiles` : 'Facilities is off']} />
});

/* ---- Places and catalogs ---- */
const PLACE_ROW: FormSection[] = [{ fields: [
  { key: 'name', label: 'Place', required: true, max: 32 }, { key: 'floor', label: 'Floor', type: 'number', min: 1, maxNum: 20 },
  { key: 'glyph', label: 'Icon', type: 'select', options: GLYPHS }, { key: 'hours', label: 'Hours', max: 32, placeholder: '6:30 a.m. – 7 p.m.' },
  { key: 'wait', label: 'Walk-in wait (from the queue feed)', max: 40, placeholder: 'Walk-in wait about 15 min' },
  { key: 'kind', label: 'Catalog heading', max: 40, placeholder: 'Menu, Self-pay prices, Services…' },
  { key: 'items', label: 'Catalog', type: 'textarea', rows: 8, wide: true, hint: 'One item per line: Group | Item | Price or time | Tag (optional). Example: Lunch | Turkey wrap | $7.50 | Vegetarian' },
  { key: 'note', label: 'Note under the catalog', max: 80, hint: 'For example: To look, not to order in the app.' },
  { key: 'on', label: 'Show this place page', type: 'switch' }] }];
const lines = (s: string) => String(s || '').split('\n').map(l => l.trim()).filter(Boolean);
const placesPages = defineSingleton({
  route: 'facility-places', id: 'facility-places', area: 'facility', section: 'Wayfinding and facilities', title: 'Places and catalogs', noun: 'place',
  lede: 'Place pages open from Guest nearby, the facility tiles and the 3D map: hours, the walk-in wait, and what is there – a café menu, lab and imaging self-pay prices, pharmacy items, chapel times. Nothing is ordered or booked in the app.',
  formTitle: 'Places',
  validate: d => { const bad = (d.rows as Row[]).find(r => lines(r.items).some(l => l.split('|').length < 3)); return bad ? { rows: `${bad.name}: each catalog line needs Group | Item | Price or time.` } : {}; },
  describe: (a, b) => rowDiff('Place', a?.rows, b.rows, r => r.name),
  Editor: ({ working, set, ro }: EditorProps) => <RowsEditor<Row> rows={working.rows} onRows={rows => set({ ...working, rows })} noun="place" caption="Places" ro={ro} rowTitle={r => r.name} searchText={r => `${r.name} ${r.items}`}
    columns={[{ key: 'name', label: 'Place', render: r => <IconCell g={r.glyph}><span>{r.name}</span><span className="muted">Floor {r.floor}{r.hours ? ` · ${r.hours}` : ''}</span></IconCell> },
      { key: 'kind', label: 'Catalog', render: r => <span className="cell-2"><span>{r.kind || 'None'}</span><span className="muted">{lines(r.items).length} items{r.wait ? ` · ${r.wait}` : ''}</span></span> },
      { key: 'on', label: 'Status', render: shown }]}
    sections={PLACE_ROW} blank={() => ({ name: '', floor: 1, glyph: 'restaurant', hours: '', wait: '', kind: 'Menu', items: '', note: '', on: true })} validate={(v, others) => ({ ...uniq('name', 'place')(v, others), ...(lines(v.items as string).some(l => l.split('|').length < 3) ? { items: 'Each line needs Group | Item | Price or time.' } : {}) })} />,
  initialExtras: { place: 0 },
  previewExtras: (x, setX) => <div className="pv-row"><Segmented id="pv-place" label="Preview place" options={[['0', 'Café'], ['1', 'Lab'], ['2', 'Imaging'], ['3', 'Pharmacy']]} value={String(x.place ?? 0)} onChange={v => setX({ place: +v })} /></div>,
  preview: (d, src, x) => { const i = +(x.place as number) || 0, rows = (d.rows as Row[]).map((r, j) => ({ ...r, sel: j === i }));
    return pv('facility-places', 'place', 'place pages')({ ...d, rows }, src); },
  sideStatic: d => <Side title="Place pages" items={(d.rows as Row[]).map(r => <span className="cell-2"><span>{r.name}{r.on ? '' : ' (hidden)'}</span><span className="muted">{r.kind}: {lines(r.items).length} items</span></span>)} />
});

/* ---- 3D map and directions ---- */
const MAP_SECS: FormSection[] = [
  { title: 'Home and Wayfinding at a facility', fields: [
    { key: 'mapFirst', label: 'Show the live 3D map first on Home and Wayfinding (other sections move below it)', type: 'switch' },
    { key: 'floors', label: 'Floors on the floor control', max: 40, required: true, hint: 'Lowest first, separated by commas, for example 1, 2, 7. The control shows the highest at the top.' },
    { key: 'defaultFloor', label: 'Floor shown first', type: 'number', min: 1, maxNum: 20 },
    { key: 'cta', label: 'Map button', max: 24, required: true }] },
  { title: 'Directions', fields: [
    { key: 'fromStreet', label: 'Directions from the street (drive in, park, walk, enter) stay in the app', type: 'switch' },
    { key: 'overview', label: 'Route overview (every floor of the route)', type: 'switch' },
    { key: 'liveView', label: 'Live view (simulated)', type: 'switch' },
    { key: 'voice', label: 'Voice guidance button', type: 'switch' },
    { key: 'simulate', label: 'Simulate the walk (demo only)', type: 'switch' }] }];
const DEST_ROW: FormSection[] = [{ fields: [{ key: 'name', label: 'Destination', required: true, max: 24 }, { key: 'glyph', label: 'Icon', type: 'select', options: GLYPHS },
  { key: 'target', label: 'Route ends at', max: 40, required: true, hint: 'A room or point in the published indoor map.' }, { key: 'on', label: 'Show', type: 'switch' }] }];
const mapPages = defineSingleton({
  route: 'wayfinding-3d', id: 'wayfinding-3d', area: 'wayfinding', section: 'Wayfinding and facilities', title: '3D map and directions', noun: '3D map setting',
  lede: 'How the live 3D map and turn-by-turn directions behave for guests. Floors and rooms come from the published wayfinding file; every route stays inside the app.',
  formTitle: 'Map, directions and quick destinations',
  validate: d => /^\s*\d+(\s*,\s*\d+)*\s*$/.test(String(d.floors || '')) ? {} : { floors: 'List floors as numbers separated by commas.' },
  describe: (a, b) => [...fieldDiff(a, b, [['mapFirst', 'Map first'], ['floors', 'Floors'], ['defaultFloor', 'Floor shown first'], ['cta', 'Map button'], ['fromStreet', 'From the street'], ['overview', 'Route overview'], ['liveView', 'Live view'], ['voice', 'Voice'], ['simulate', 'Simulate the walk']]),
    ...rowDiff('Destination', a?.dest, b.dest, r => r.name)],
  Editor: ({ working, set, ro }: EditorProps) => <>
    <Form sections={MAP_SECS.map(s => ({ ...s, fields: s.fields.map(f => ({ ...f, readonly: ro })) }))} data={working} prefix="m3" onChange={set} />
    <RowsEditor<Row> rows={working.dest} onRows={dest => set({ ...working, dest })} noun="quick destination" caption="Quick destinations on Wayfinding" ro={ro} rowTitle={r => r.name} searchText={r => `${r.name} ${r.target}`}
      columns={[{ key: 'name', label: 'Destination', render: r => <IconCell g={r.glyph}><span>{r.name}</span><span className="muted">{glyphLabel(r.glyph)}</span></IconCell> },
        { key: 'target', label: 'Route ends at', render: r => r.target, cls: 'wrap' }, { key: 'on', label: 'Status', render: shown }]}
      sections={DEST_ROW} blank={() => ({ name: '', glyph: 'map', target: '', on: true })} validate={uniq('name', 'destination')} /></>,
  initialExtras: { mapView: 'facility' },
  previewExtras: (x, setX) => <div className="pv-row"><Segmented id="pv-map" label="Preview screen" options={[['facility', 'Home at a facility'], ['wayfinding', 'Wayfinding']]} value={(x.mapView as string) || 'facility'} onChange={v => setX({ mapView: v })} /></div>,
  preview: (d, src, x) => pv('wayfinding-3d', (x.mapView as string) || 'facility', '3D map settings')(d, src),
  sideStatic: d => <Side title="What guests see" items={[d.mapFirst ? 'The 3D map is the first fold on Home and Wayfinding' : 'Home keeps its usual order; the map opens from Wayfinding',
    `Floors ${d.floors}; Floor ${d.defaultFloor} first`, ['overview', 'liveView', 'voice'].filter(k => d[k]).map(k => ({ overview: 'Route overview', liveView: 'Live view', voice: 'Voice' } as Data)[k]).join(', ') || 'No extra map buttons',
    d.fromStreet ? 'Get there and Drive there start in-app directions from the street' : 'Directions start at the entrance']} />
});

export const facilityPages: Record<string, Page> = { ...mapPages, ...whyPages, ...nearbyPages, ...placesPages };
