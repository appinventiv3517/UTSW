/* ---------- Wayfinding: manual Gozio JSON export → upload → validate → demo → production ----------
   Uploading and publishing are separate actions. No direct Gozio connection. The file format checked here is a
   placeholder until UTSW shares a real Gozio export (§8). Files are read in the browser and never leave it. */
/* EXTRA_GLYPHS: science public info upload_file folder_open check_circle error save history */
import { useRef, useState, type DragEvent } from 'react';
import type { PageProps } from '../app/App';
import { PageHead } from '../app/Shell';
import { Session } from '../app/session';
import { can } from '../app/permissions';
import { useLoad } from '../app/useLoad';
import { UserService, WayfindingService, type Validation } from '../services/services';
import { Badge, Btn, ErrorState, Icon, LoadingState } from '../ui/kit';
import { DataTable } from '../ui/DataTable';
import { confirmDialog, toast } from '../ui/overlays';
import { focusSoon } from './collection';
import { announce, fmtDateTime, plural } from '../app/util';
import type { Wayfinding, WayVersion, WayHistory } from '../app/types';

const WF_STATUS: Record<string, [string, string]> = { production: ['production', 'Production'], demo: ['demo', 'Demo'], validated: ['draft', 'Validated – not published'], superseded: ['hidden', 'Superseded'], retired: ['hidden', 'Retired'] };
const SAMPLE_GOZIO = () => JSON.stringify({
  schemaVersion: '1.0 (sample)', exportedAt: '2026-10-30T09:00:00-05:00',
  venue: { id: 'utsw-main', name: 'UT Southwestern main campus (sample)' },
  buildings: [
    { id: 'cuh', name: 'Clements University Hospital', floors: [
      { id: 'cuh-1', level: 1, name: 'Level 1', destinations: [{ id: 'cuh-lobby', name: 'Main lobby', category: 'Entrance' }, { id: 'cuh-pharm', name: 'Outpatient pharmacy', category: 'Pharmacy' }, { id: 'cuh-cafe', name: 'Café', category: 'Food' }] },
      { id: 'cuh-2', level: 2, name: 'Level 2', destinations: [{ id: 'cuh-img', name: 'Imaging', category: 'Imaging' }, { id: 'cuh-lab', name: 'Lab draw station', category: 'Lab' }] }] },
    { id: 'zale', name: 'Zale Lipshy Pavilion', floors: [
      { id: 'zale-1', level: 1, name: 'Level 1', destinations: [{ id: 'zale-east', name: 'East entrance', category: 'Entrance' }, { id: 'zale-info', name: 'Information desk', category: 'Information' }] }] },
    { id: 'obb', name: 'Sample Outpatient Building', floors: [
      { id: 'obb-3', level: 3, name: 'Level 3', destinations: [{ id: 'obb-derm', name: 'Dermatology clinic', category: 'Clinic' }, { id: 'obb-ortho', name: 'Orthopaedics clinic', category: 'Clinic' }] },
      { id: 'obb-4', level: 4, name: 'Level 4', destinations: [{ id: 'obb-store', category: 'Other' }] }] }
  ]
}, null, 2);
const SAMPLE_BAD = () => SAMPLE_GOZIO().replace('"level": 2', '"level": "2"').replace('"obb-ortho"', '"obb-derm"').replace('"Food"', '"Snacks"');
interface Result { res: Validation; name: string; size: number }

export function WayfindingPage(_: PageProps) {
  const [load, retry, setData] = useLoad(() => WayfindingService.get());
  return (
    <div className="page">
      <PageHead crumbs={[['Wayfinding', null]]} title="Wayfinding files" lede="Indoor maps come from a JSON file exported by hand from Gozio. Upload and validate a file, check it on demo, then publish it to production." />
      <div id="wf">{load.status === 'loading' ? <LoadingState text="Loading wayfinding" /> : load.status === 'error' ? <ErrorState msg={load.error} onRetry={retry} /> : <Body w={load.data} setW={setData} />}</div>
    </div>
  );
}

function Body({ w, setW }: { w: Wayfinding; setW: (w: Wayfinding) => void }) {
  const canPub = can(Session.role(), 'wayfinding', 'publish');
  const [busy, setBusy] = useState<string | null>(null);
  const vOf = (v: number | null) => w.versions.find(x => x.version === v);
  const prod = vOf(w.production), demo = vOf(w.demo), val = w.versions.filter(x => x.status === 'validated').slice(-1)[0];
  const done = (next: Wayfinding, msg: string, focus: string) => { setBusy(null); setW(next); toast(msg, { kind: 'success' }); focusSoon(focus); };
  const fail = (err: unknown) => { setBusy(null); toast((err as Error).message, { kind: 'error', ms: 8000 }); };
  const publish = async (env: 'demo' | 'production', v: number) => {
    const ver = vOf(v)!;
    const c = await confirmDialog({ title: env === 'demo' ? `Publish v${v} to demo?` : `Publish v${v} to production?`,
      body: env === 'demo' ? <p>Demo devices get {ver.fileName} ({ver.destinations.toLocaleString('en-US')} destinations). Production stays on v{w.production}.</p>
        : <div className="warn-box"><Icon name="public" size={20} /><p>Patients get these indoor maps in the app. Walk a few routes on demo first. Publishing is simulated in the prototype.</p></div>,
      confirmLabel: env === 'demo' ? 'Publish to demo' : 'Publish to production', comment: { label: 'Comment', hint: env === 'demo' ? 'Optional' : 'Optional, for example which routes you checked' } });
    if (!c.ok) return;
    setBusy(env);
    try { done(await WayfindingService.publish(v, env, c.comment), `v${v} is on ${env}.`, 'wf-cur-h'); } catch (err) { fail(err); }
  };
  const rollback = async (v: number) => {
    const c = await confirmDialog({ title: `Roll back to v${v}?`, body: <p>Demo and production go back to {vOf(v)!.fileName}. v{w.production} stays in the history.</p>, confirmLabel: `Roll back to v${v}`, variant: 'danger', comment: { label: 'Reason for the rollback', required: true } });
    if (!c.ok) return;
    setBusy(`rb${v}`);
    try { done(await WayfindingService.rollback(v, c.comment), `Rolled back. Production is v${v}.`, 'wf-v-h'); } catch (err) { fail(err); }
  };
  const lastProd = prod && (w.history.filter(h => h.version === prod.version && h.environment === 'production').slice(-1)[0] || prod);
  return (
    <>
      <section className="card" aria-labelledby="wf-cur-h"><div className="card-head"><h2 id="wf-cur-h" tabIndex={-1}>Current version</h2><div className="card-actions"><Badge kind="mock" /></div></div><div className="card-body">
        <p className="lc-status wf-status">{val && <Badge kind="draft" text={`v${val.version} validated`} />}{demo && w.demo !== w.production && <Badge kind="demo" text={`Demo v${demo.version}`} />}
          {prod ? <Badge kind="production" text={`Production v${prod.version}`} /> : <span className="muted">Nothing published</span>}
          <span>{val ? 'Ready for demo.' : w.demo !== w.production ? 'Demo is ahead of production.' : 'Demo and production match.'}</span></p>
        <div className="wf-cur">{prod && <dl className="facts cols"><dt>Published version</dt><dd>v{prod.version} · {prod.fileName}</dd><dt>Last updated</dt><dd>{fmtDateTime(lastProd!.at)}</dd>
          <dt>Contents</dt><dd>{prod.buildings} buildings · {prod.floors} floors · {prod.destinations.toLocaleString('en-US')} destinations</dd><dt>Uploaded by</dt><dd>{UserService.name(prod.by)}{prod.comment ? ` – “${prod.comment}”` : ''}</dd></dl>}</div>
        {canPub ? <div className="lc-actions">
          {val && <Btn label={`Publish v${val.version} to demo`} icon="science" variant="primary" data-w="demo" data-v={val.version} busy={busy === 'demo'} busyLabel="Publishing" onClick={() => publish('demo', val.version)} />}
          {w.demo !== w.production && <Btn label={`Publish demo v${w.demo} to production`} icon="public" variant={val ? 'secondary' : 'primary'} data-w="prod" data-v={w.demo!} busy={busy === 'production'} busyLabel="Publishing" onClick={() => publish('production', w.demo!)} />}
        </div> : <p className="role-note"><Icon name="info" size={20} /><span>Your role can view wayfinding. Admins and Super Admins upload and publish.</span></p>}
      </div></section>
      {canPub && <Upload onSaved={next => done(next, 'Saved as a validated version. Publish it to demo when you’re ready.', 'wf-cur-h')} />}
      <section className="card" aria-labelledby="wf-v-h"><div className="card-head"><h2 id="wf-v-h" tabIndex={-1}>Published versions</h2><div className="card-actions"><Badge kind="pending" text="Rollback supported – assumed, pending confirmation" /></div></div><div className="card-body" id="wf-versions">
        <DataTable<WayVersion> id="wfv" caption="Wayfinding versions" noun="version" rows={w.versions} defaultSort={{ key: 'version', dir: 'desc' }} searchText={v => `${v.fileName} ${v.comment}`} rowKey={v => String(v.version)}
          empty={{ icon: 'history', title: 'No versions yet' }}
          columns={[
            { key: 'version', label: 'Version', sortable: true, render: v => `v${v.version}`, cls: 'num' },
            { key: 'fileName', label: 'File', render: v => <><span className="mono">{v.fileName}</span><br /><span className="muted">{v.sizeKb.toLocaleString('en-US')} KB</span></> },
            { key: 'contents', label: 'Contents', render: v => <>{v.buildings} buildings · {v.floors} floors · {v.destinations.toLocaleString('en-US')} destinations{v.warnings ? <><br /><Badge kind="pending" text={`${v.warnings} warnings`} /></> : null}</> },
            { key: 'status', label: 'Status', render: v => { const [k, l] = WF_STATUS[v.status] || ['hidden', v.status]; return <Badge kind={k} text={l} />; } },
            { key: 'at', label: 'Uploaded', sortable: true, render: v => <><span className="nowrap">{fmtDateTime(v.at)}</span><br /><span className="muted">{UserService.name(v.by)}</span></> },
            { key: 'acts', label: 'Actions', hideLabel: true, render: v => canPub && v.version !== w.production && ['retired', 'demo'].includes(v.status)
              ? <Btn label={`Roll back to v${v.version}`} icon="history" variant="text" data-w="rollback" data-v={v.version} busy={busy === `rb${v.version}`} busyLabel="Rolling back" onClick={() => rollback(v.version)} /> : null }]} />
      </div></section>
      <section className="card" aria-labelledby="wf-h-h"><div className="card-head"><h2 id="wf-h-h">Publication history</h2></div><div className="card-body" id="wf-hist">
        <DataTable<WayHistory> id="wfh" caption="Publication history" noun="event" rows={w.history} defaultSort={{ key: 'at', dir: 'desc' }} searchText={h => `${h.action} ${h.comment} ${UserService.name(h.by)}`} rowKey={(h, i) => `${h.at}-${i}`}
          filters={[{ key: 'env', label: 'Environment', options: [['draft', 'Upload'], ['demo', 'Demo'], ['production', 'Production']], match: (h, v) => h.environment === v }]}
          empty={{ icon: 'history', title: 'No events yet' }}
          columns={[
            { key: 'at', label: 'When', sortable: true, render: h => <span className="nowrap">{fmtDateTime(h.at)}</span> },
            { key: 'action', label: 'Event', render: h => h.action },
            { key: 'version', label: 'Version', render: h => `v${h.version}`, cls: 'num' },
            { key: 'environment', label: 'Environment', render: h => h.environment === 'draft' ? <Badge kind="draft" text="Upload" /> : <Badge kind={h.environment} /> },
            { key: 'by', label: 'By', render: h => UserService.name(h.by) },
            { key: 'comment', label: 'Comment', render: h => h.comment || <span className="muted">None</span>, cls: 'wrap' }]} />
      </div></section>
    </>
  );
}

/* Upload: a file (chosen or dropped) or a sample, a simulated upload bar, then the validation result */
function Upload({ onSaved }: { onSaved: (w: Wayfinding) => void }) {
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState<{ name: string; size: number; pct: number; checking: boolean } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const show = (r: Result) => {
    setResult(r); setComment('');
    focusSoon('wf-result');
    announce(r.res.ok ? 'File passed validation' : `File failed validation with ${plural(r.res.errors.length, 'error')}`);
  };
  const tooBig = (f: File) => show({ res: { ok: false, errors: [`${f.name} is ${(f.size / 1048576).toFixed(1)} MB. The limit is 10 MB.`], warnings: [], stats: null }, name: f.name, size: f.size });
  const process = async (name: string, size: number, text: string) => {
    setResult(null);
    for (let p = 0; p <= 100; p += 20) { setProgress({ name, size, pct: p, checking: false }); await new Promise(r => setTimeout(r, 140)); }
    setProgress({ name, size, pct: 100, checking: true });
    try { const res = await WayfindingService.validate(text); setProgress(null); show({ res, name, size }); }
    catch (err) { setProgress(null); show({ res: { ok: false, errors: [(err as Error).message], warnings: [], stats: null }, name, size }); }
  };
  const read = (f: File) => { const r = new FileReader(); r.onload = () => process(f.name, f.size, String(r.result)); r.readAsText(f); };
  const onFile = () => { const f = input.current?.files?.[0]; if (!f) return; if (f.size > 10 * 1024 * 1024) { tooBig(f); return; } read(f); };
  const onDrop = (e: DragEvent) => {
    e.preventDefault(); setOver(false);
    const f = e.dataTransfer.files[0]; if (!f) return;
    if (!/\.json$/i.test(f.name)) { show({ res: { ok: false, errors: [`${f.name} isn’t a JSON file. Export the wayfinding data from Gozio as JSON.`], warnings: [], stats: null }, name: f.name, size: f.size }); return; }
    read(f);
  };
  const sample = (ok: boolean) => { const text = ok ? SAMPLE_GOZIO() : SAMPLE_BAD(); process(ok ? 'gozio-export-sample.json' : 'gozio-export-with-errors.json', text.length, text); };
  const discard = () => { setResult(null); if (input.current) input.current.value = ''; requestAnimationFrame(() => document.querySelector<HTMLElement>('[for="wf-file"]')?.focus()); };
  const save = async () => {
    if (!result || !result.res.stats) return;
    setBusy(true);
    try { const next = await WayfindingService.upload(result.name, Math.max(1, Math.round(result.size / 1024)), { ...result.res.stats, warnings: result.res.warnings.length }, comment.trim()); setResult(null); onSaved(next); }
    catch (err) { setBusy(false); toast((err as Error).message, { kind: 'error', ms: 8000 }); }
  };
  const res = result?.res;
  return (
    <section className="card" aria-labelledby="wf-up-h"><div className="card-head"><h2 id="wf-up-h" tabIndex={-1}>Upload a file</h2></div><div className="card-body">
      <div className={`drop${over ? ' over' : ''}`} id="wf-drop" onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
        <Icon name="upload_file" size={32} />
        <p className="drop-t">Drag a Gozio JSON export here, or</p>
        <label className="btn btn-primary" htmlFor="wf-file"><Icon name="folder_open" size={20} /><span className="lbl">Choose a file</span></label>
        <input type="file" id="wf-file" accept=".json,application/json" className="vh" ref={input} onChange={onFile} />
        <p className="hint">JSON only, up to 10 MB. The file is checked in your browser and isn’t sent anywhere.</p>
        <p className="drop-or">No export to hand? <Btn label="Use a valid sample file" variant="text" data-sample="ok" onClick={() => sample(true)} /> <Btn label="Use a sample with errors" variant="text" data-sample="bad" onClick={() => sample(false)} /></p>
      </div>
      <div id="wf-progress">{progress && <div className="upl"><p><span className="mono">{progress.name}</span> · {(progress.size / 1024).toFixed(1)} KB</p>
        <div className="bar" role="progressbar" aria-label={`Uploading ${progress.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.pct}><span style={{ width: `${progress.pct}%` }}></span></div>
        <p className="hint" id="wf-pt">{progress.checking ? 'Checking the file…' : 'Uploading…'}</p></div>}</div>
      <div id="wf-result" tabIndex={-1}>{result && res && (res.ok
        ? <div className="val ok"><h3><Icon name="check_circle" size={24} className="f1" /> {result.name} passed validation</h3>
            <p>{res.stats!.buildings} buildings · {res.stats!.floors} floors · {res.stats!.destinations} destinations{res.stats!.venue ? ` · ${res.stats!.venue}` : ''}</p>
            {res.warnings.length > 0 && <details open><summary>{plural(res.warnings.length, 'warning')} – you can still continue</summary><ul>{res.warnings.map((x, i) => <li key={i}>{x}</li>)}</ul></details>}
            <div className="field"><label htmlFor="wf-comment">Comment for the history</label><input className="input" id="wf-comment" type="text" maxLength={120} placeholder="For example, what changed in this export" value={comment} onChange={e => setComment(e.target.value)} /></div>
            <div className="lc-actions"><Btn label="Discard file" variant="text" data-up="discard" onClick={discard} /><Btn label="Save as a validated version" icon="save" variant="primary" data-up="save" busy={busy} busyLabel="Saving" onClick={save} /></div>
            <p className="muted">Saving doesn’t publish anything. Publish to demo is a separate step.</p></div>
        : <div className="val bad"><h3><Icon name="error" size={24} className="f1" /> {result.name} didn’t pass validation</h3><p>Fix these in Gozio, export again and upload the new file. Nothing was saved.</p>
            <ul className="val-errs">{res.errors.map((x, i) => <li key={i}>{x}</li>)}</ul>{res.moreErrors ? <p>And {res.moreErrors} more.</p> : null}
            {res.warnings && res.warnings.length > 0 && <details><summary>{plural(res.warnings.length, 'warning')}</summary><ul>{res.warnings.map((x, i) => <li key={i}>{x}</li>)}</ul></details>}</div>)}
      </div>
    </div></section>
  );
}
