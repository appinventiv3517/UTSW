/* ---------- Declarative forms: render, read, validate ----------
   Field: { key, label, type, hint, required, max, options, show(data), placeholder, min, maxNum, readonly }
   Types: text, textarea, select, number, datetime (a Date and a Time input, one YYYY-MM-DDTHH:MM value), switch, color, icon,
   alertIcon, image, destination, segment, radio, rules. Hints sit below their control. f.default: radio value when data has none;
   f.onSet(data): runs after the field changes. Every change hands the whole new data object to onChange. */
/* EXTRA_GLYPHS: error hide_image remove_circle add lock help */
import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from './kit';
import { Select, type Opt } from './Select';
import { ConfigService, latestData } from '../services/services';
import { APPROVED_ICONS, ALERT_ICONS, ART, ART_NAMES, APP_SCREENS, MYCHART_TARGETS, DEST_TYPES, AUDIENCE_ATTRS, destLabel } from '../mock/seed';
import { clone, same, plural, fmtLocal, announce, cx } from '../app/util';
import type { Data, Destination } from '../app/types';

export type FieldType = 'text' | 'textarea' | 'select' | 'number' | 'datetime' | 'switch' | 'color' | 'icon' | 'alertIcon' | 'image' | 'destination' | 'segment' | 'radio' | 'rules';
export interface FieldDef {
  key: string; label: string; type?: FieldType; hint?: string; required?: boolean; max?: number; rows?: number;
  options?: (string | [string, string])[] | ((d: Data) => (string | [string, string])[]); show?: (d: Data) => boolean;
  placeholder?: string; min?: number; maxNum?: number; readonly?: boolean; default?: string; onSet?: (d: Data) => void; wide?: boolean; noNone?: boolean;
}
export interface FormSection { title?: string; note?: ReactNode; fields: FieldDef[] }
export type Errors = Record<string, string | undefined>;
type AttrKey = keyof typeof AUDIENCE_ATTRS;
type ArtKey = keyof typeof ART;
export interface Rule { attr: string; op: string; value: string }

export const segmentOptions = (): [string, string][] => ConfigService.peekAll('segment').map(r => [r.id, (latestData(r) || {}).name || r.name]);
export const segmentName = (id: string): string => { const r = ConfigService.peek(id); return r ? (latestData(r) || {}).name || r.name : 'Unknown audience'; };
const optList = (o: (string | [string, string])[]): Opt[] => o.map(x => Array.isArray(x) ? [String(x[0]), x[1]] as Opt : [x, x] as Opt);

function ErrP({ id, err }: { id: string; err?: string }) {
  return <p className="err" id={`${id}-err`} hidden={!err}><Icon name="error" size={16} /><span>{err || ''}</span></p>;
}
const Req = ({ f }: { f: FieldDef }) => f.required ? <> <span className="req">(required)</span></> : null;

/* Date and time are kept separately while one of them is still empty, so a half-entered value isn't lost */
function DateTime({ f, id, v, err, desc, set }: { f: FieldDef; id: string; v: string; err?: string; desc: string; set: (v: string) => void }) {
  const [d, setD] = useState((v || '').slice(0, 10)), [t, setT] = useState((v || '').slice(11, 16));
  useEffect(() => { if (v && v !== `${d}T${t}`) { setD(v.slice(0, 10)); setT(v.slice(11, 16)); } }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  const upd = (nd: string, nt: string) => { setD(nd); setT(nt); set(nd && nt ? `${nd}T${nt}` : ''); };
  const a = { 'data-key': f.key, 'aria-describedby': desc, 'aria-invalid': err ? true : undefined, 'aria-required': f.required || undefined, disabled: f.readonly };
  return (
    <fieldset className={cx('field field-dt', err && 'has-error')} data-field={f.key}><legend>{f.label}<Req f={f} /></legend>
      <div className="dt-row">
        <div className="dt-part"><label className="dt-l" htmlFor={id}>Date</label><input className="input" type="date" id={id} data-part="date" value={d} onChange={e => upd(e.target.value, t)} {...a} /></div>
        <div className="dt-part"><label className="dt-l" htmlFor={`${id}-t`}>Time</label><input className="input" type="time" id={`${id}-t`} data-part="time" value={t} onChange={e => upd(d, e.target.value)} {...a} /></div>
      </div>
      {f.hint && <p className="hint" id={`${id}-hint`}>{f.hint}</p>}<ErrP id={id} err={err} />
    </fieldset>
  );
}
/* The color picker follows the hex field whenever it holds a full color */
function ColorField({ f, id, v, set, a }: { f: FieldDef; id: string; v: string; set: (v: string) => void; a: Record<string, unknown> }) {
  const [sw, setSw] = useState(/^#[0-9a-f]{6}$/i.test(v || '') ? v : '#000000');
  useEffect(() => { if (/^#[0-9a-f]{6}$/i.test(v || '')) setSw(v); }, [v]);
  return (
    <div className="color-row">
      <input type="color" className="swatch" value={sw} data-key={f.key} aria-label={`${f.label} picker`} tabIndex={-1} onChange={e => { setSw(e.target.value); set(e.target.value); }} />
      <input className="input input-hex" type="text" value={v ?? ''} spellCheck={false} id={id} onChange={e => set(e.target.value.trim())} {...a} />
    </div>
  );
}

export function Field({ f, data, err, prefix, onChange }: { f: FieldDef; data: Data; err?: string; prefix: string; onChange: (d: Data) => void }) {
  const id = `${prefix}-${f.key}`, v = data[f.key];
  const desc = [f.hint && `${id}-hint`, `${id}-err`].filter(Boolean).join(' ');
  const set = (val: unknown) => { const next = { ...data, [f.key]: val }; if (f.onSet) f.onSet(next); onChange(next); };
  const hint = f.hint ? <p className="hint" id={`${id}-hint`}>{f.hint}</p> : null;
  const a = { id, 'data-key': f.key, 'aria-describedby': desc, 'aria-invalid': err ? true : undefined, 'aria-required': f.required || undefined, disabled: f.readonly };
  /* Long text always shows its count; short fields only once they near the limit */
  const len = String(v || '').length;
  const counter = f.max ? <p className="count-line" id={`${id}-cnt`} hidden={!(f.type === 'textarea' || len >= f.max * .7)}>{len} of {f.max} characters</p> : null;
  const wrap = (control: ReactNode, selectLabel = false) => (
    <div className={cx('field', err && 'has-error')} data-field={f.key}>
      <label htmlFor={selectLabel ? `${id}-dd` : id} id={selectLabel ? `${id}-lbl` : undefined}>{f.label}<Req f={f} /></label>{control}{hint}{counter}<ErrP id={id} err={err} />
    </div>
  );
  const selProps = { id, labelId: `${id}-lbl`, describedby: desc, invalid: !!err, required: f.required, disabled: f.readonly, data: { key: f.key } };
  switch (f.type) {
    case 'textarea': return wrap(<textarea className="input" rows={f.rows || 3} value={v || ''} onChange={e => set(e.target.value)} {...a} />);
    case 'number': return wrap(<input className="input input-num" type="number" inputMode="numeric" value={v ?? ''} min={f.min} max={f.maxNum} onChange={e => set(e.target.value === '' ? '' : Number(e.target.value))} {...a} />);
    case 'datetime': return <DateTime f={f} id={id} v={v} err={err} desc={desc} set={set} />;
    case 'color': return wrap(<ColorField f={f} id={id} v={v} set={set} a={a} />);
    case 'select': case 'segment': {
      const opts = f.type === 'segment' ? segmentOptions() : optList(typeof f.options === 'function' ? f.options(data) : f.options || []);
      const all: Opt[] = f.placeholder ? [['', f.placeholder], ...opts] : opts;
      return wrap(<Select {...selProps} options={all} value={v == null ? '' : String(v)} placeholder={!!f.placeholder} onChange={set} />, true);
    }
    case 'icon': case 'alertIcon': {
      const list = f.type === 'icon' ? APPROVED_ICONS : ALERT_ICONS;
      return wrap(<div className="icon-row"><span className="icon-prev" aria-hidden="true"><Icon name={v || 'help'} /></span>
        <Select {...selProps} icons options={list.map(i => [i.glyph, i.label] as Opt)} value={v || ''} onChange={set} /></div>, true);
    }
    case 'switch':
      return (
        <div className="field field-switch" data-field={f.key}><span className="sw-txt"><span className="sw-l" id={`${id}-l`}>{f.label}</span>{f.hint && <span className="hint" id={`${id}-hint`}>{f.hint}</span>}</span>
          <button type="button" className="switch" role="switch" id={id} data-key={f.key} aria-checked={!!v} aria-labelledby={`${id}-l`} aria-describedby={f.hint ? `${id}-hint` : undefined} disabled={f.readonly}
            onClick={() => set(!v)}><span className="track" aria-hidden="true"></span></button></div>
      );
    case 'radio': {
      const cur = v == null ? f.default : v;
      return (
        <fieldset className={cx('field field-radio', err && 'has-error')} data-field={f.key}><legend>{f.label}<Req f={f} /></legend>
          <div className="radio-row">{optList(typeof f.options === 'function' ? f.options(data) : f.options || []).map(([ov, ol]) => (
            <label key={ov} className="radio-card" htmlFor={`${id}-${ov}`}><input type="radio" name={id} id={`${id}-${ov}`} value={ov} data-key={f.key} checked={ov === cur} disabled={f.readonly} onChange={() => set(ov)} /><span>{ol}</span></label>))}
          </div>{hint}<ErrP id={id} err={err} /></fieldset>
      );
    }
    case 'image':
      return (
        <fieldset className="field" data-field={f.key}><legend>{f.label}</legend><div className="img-grid">{['none', ...Object.keys(ART)].map(k => (
          <label key={k} className="img-opt" htmlFor={`${id}-${k}`}><input type="radio" name={id} id={`${id}-${k}`} value={k} data-key={f.key} checked={k === (v || 'none')} disabled={f.readonly} onChange={() => set(k)} />
            <span className="img-th">{k === 'none' ? <Icon name="hide_image" size={24} /> : <svg viewBox="0 0 304 144" preserveAspectRatio="xMidYMid slice" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ART[k as ArtKey] }} />}</span>
            <span className="img-l">{k === 'none' ? 'No image' : `Sample ${k.toUpperCase()}`}</span></label>))}
        </div>{hint}</fieldset>
      );
    case 'destination': {
      const d: Destination = v || { type: 'none', value: '' };
      const setType = (t: string) => set({ type: t, value: t === 'screen' ? APP_SCREENS[0] : t === 'mychart' ? MYCHART_TARGETS[0] : '' });
      const setVal = (val: string) => set({ ...d, value: val });
      const vc = { id: `${id}-v`, 'data-key': f.key, 'data-part': 'value', 'aria-describedby': `${id}-err` };
      const valueCtl = d.type === 'screen' ? <Select id={`${id}-v`} ariaLabel={`${f.label}: app screen`} describedby={`${id}-err`} options={APP_SCREENS.map(s => [s, s] as Opt)} value={d.value} onChange={setVal} data={{ key: f.key, part: 'value' }} />
        : d.type === 'mychart' ? <Select id={`${id}-v`} ariaLabel={`${f.label}: MyChart destination`} describedby={`${id}-err`} options={MYCHART_TARGETS.map(s => [s, s] as Opt)} value={d.value} onChange={setVal} data={{ key: f.key, part: 'value' }} />
        : d.type === 'url' ? <input className="input" type="url" {...vc} value={d.value} placeholder="https://" aria-label={`${f.label}: web address`} aria-invalid={err ? true : undefined} onChange={e => setVal(e.target.value)} />
        : d.type === 'phone' ? <input className="input" type="tel" {...vc} value={d.value} placeholder="214-555-0100" aria-label={`${f.label}: phone number`} aria-invalid={err ? true : undefined} onChange={e => setVal(e.target.value)} /> : null;
      return (
        <fieldset className={cx('field', err && 'has-error')} data-field={f.key}><legend>{f.label}<Req f={f} /></legend>
          <div className="dest-row"><Select id={id} ariaLabel={`${f.label}: type`} disabled={f.readonly} data={{ key: f.key, part: 'type' }}
            options={DEST_TYPES.filter(([k]) => !f.noNone || k !== 'none').map(([k, l]) => [k, l] as Opt)} value={d.type} onChange={setType} />{valueCtl}</div>
          {hint}{d.type === 'mychart' && <p className="hint"><Icon name="lock" size={16} /> Opens MyChart sign-in, then the MyChart screen. The Admin never edits MyChart content.</p>}<ErrP id={id} err={err} />
        </fieldset>
      );
    }
    case 'rules': {
      const rules: Rule[] = v || [];
      const setRule = (i: number, part: keyof Rule, val: string) => {
        const next = clone(rules); next[i][part] = val;
        if (part === 'attr') { const A = AUDIENCE_ATTRS[val as AttrKey]; next[i].op = A.ops[0]; next[i].value = A.values[0]; }
        set(next);
      };
      const add = () => {
        set([...rules, { attr: 'signedIn', op: 'is', value: 'Guest' }]); announce(`Rule ${rules.length + 1} added`);
        requestAnimationFrame(() => document.getElementById(`${id}-a${rules.length}-dd`)?.focus());
      };
      const remove = (i: number) => { set(rules.filter((_, k) => k !== i)); announce('Rule removed'); requestAnimationFrame(() => document.getElementById(`${id}-add`)?.focus()); };
      return (
        <fieldset className={cx('field', err && 'has-error')} data-field={f.key}><legend>{f.label}</legend>
          {rules.length ? <ol className="rules">{rules.map((r, i) => {
            const A = AUDIENCE_ATTRS[r.attr as AttrKey];
            return (
              <li className="rule-row" key={i}><span className="rule-n" aria-hidden="true">{i + 1}</span>
                <Select id={`${id}-a${i}`} ariaLabel={`Rule ${i + 1}: attribute`} disabled={f.readonly} data={{ key: f.key, rule: i, part: 'attr' }}
                  options={Object.entries(AUDIENCE_ATTRS).map(([k, x]) => [k, x.label] as Opt)} value={r.attr} onChange={x => setRule(i, 'attr', x)} />
                <Select id={`${id}-o${i}`} ariaLabel={`Rule ${i + 1}: condition`} disabled={f.readonly} data={{ key: f.key, rule: i, part: 'op' }} options={A.ops.map(o => [o, o] as Opt)} value={r.op} onChange={x => setRule(i, 'op', x)} />
                <Select id={`${id}-v${i}`} ariaLabel={`Rule ${i + 1}: value`} disabled={f.readonly} data={{ key: f.key, rule: i, part: 'value' }} options={A.values.map(o => [o, o] as Opt)} value={r.value} onChange={x => setRule(i, 'value', x)} />
                {!f.readonly && <button type="button" className="btn btn-text btn-icon" data-rule-remove={i} data-key={f.key} aria-label={`Remove rule ${i + 1}`} onClick={() => remove(i)}><Icon name="remove_circle" size={20} /></button>}
              </li>);
          })}</ol> : <p className="hint-line">No rules: this segment includes every app user.</p>}
          {!f.readonly && <button type="button" className="btn btn-tonal" data-rule-add="" data-key={f.key} id={`${id}-add`} onClick={add}><Icon name="add" size={20} /><span className="lbl">Add rule</span></button>}
          {hint}<ErrP id={id} err={err} />
        </fieldset>
      );
    }
    default: return wrap(<input className="input" type="text" value={v == null ? '' : v} maxLength={f.max ? f.max + 20 : undefined} placeholder={f.placeholder} onChange={e => set(e.target.value)} {...a} />);
  }
}

/* Error summary: each problem links to its field */
export function ErrorSummary({ errors, prefix }: { errors: Errors; prefix: string }) {
  const errs = Object.entries(errors).filter(([, m]) => m);
  if (!errs.length) return null;
  const jump = (k: string) => { const el = document.getElementById(`${prefix}-${k}-dd`) || document.getElementById(`${prefix}-${k}`) || document.getElementById(`${prefix}-${k}-v`); el && el.focus(); };
  return (
    <div className="err-summary" role="alert" tabIndex={-1} id={`${prefix}-errsum`}>
      <h3><Icon name="error" size={20} /> Fix {plural(errs.length, 'problem')} before saving</h3>
      <ul>{errs.map(([k, m]) => <li key={k}><a href={`#${prefix}-${k}`} data-jump={`${prefix}-${k}`} onClick={e => { e.preventDefault(); jump(k); }}>{m}</a></li>)}</ul>
    </div>
  );
}
/* sections: [{ title, fields }] */
export function Form({ sections, data, errors = {}, prefix = 'f', onChange }: { sections: FormSection[]; data: Data; errors?: Errors; prefix?: string; onChange: (d: Data) => void }) {
  return (
    <>
      <ErrorSummary errors={errors} prefix={prefix} />
      {sections.map((s, i) => {
        const fs = s.fields.filter(f => !f.show || f.show(data));
        if (!fs.length) return null;
        return (
          <div className="form-sec" key={s.title || i}>{s.title && <h3 className="sub-h">{s.title}</h3>}{s.note && <p className="hint-line">{s.note}</p>}
            <div className="form-grid">{fs.map(f => <div key={f.key} className={f.wide === false ? '' : 'span-2'}><Field f={f} data={data} err={errors[f.key]} prefix={prefix} onChange={onChange} /></div>)}</div>
          </div>
        );
      })}
    </>
  );
}

/* Generic validation from field rules, plus a custom hook */
export function validateData(fields: FieldDef[], data: Data, custom?: (d: Data) => Errors | null | undefined): Errors {
  const errors: Errors = {};
  fields.filter(f => !f.show || f.show(data)).forEach(f => {
    const v = data[f.key];
    if (f.required && f.type === 'datetime' && !v) { errors[f.key] = `Enter a date and a time for ${f.label.replace(/ \(.*\)$/, '').toLowerCase()}.`; return; }
    if (f.required && (v == null || v === '' || (f.type === 'destination' && v.type !== 'none' && !String(v.value || '').trim()))) { errors[f.key] = `Enter ${f.label.toLowerCase()}.`; return; }
    if (f.max && typeof v === 'string' && v.length > f.max) errors[f.key] = `${f.label} is ${v.length - f.max} characters too long. Keep it to ${f.max}.`;
    if (f.type === 'number' && v !== '' && v != null && ((f.min != null && v < f.min) || (f.maxNum != null && v > f.maxNum))) errors[f.key] = `${f.label} must be between ${f.min} and ${f.maxNum}.`;
    if (f.type === 'color' && !/^#[0-9a-f]{6}$/i.test(v || '')) errors[f.key] = `${f.label} must be a hex color like #004278.`;
    if (f.type === 'destination' && v) {
      if (v.type === 'url' && !/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v.value || '')) errors[f.key] = 'Enter a full web address that starts with https://.';
      if (v.type === 'phone' && !/^\d{3}-\d{3}-\d{4}$/.test(v.value || '')) errors[f.key] = 'Enter the phone number as 214-555-0100.';
      if (f.required && v.type === 'none') errors[f.key] = `Choose ${f.label.toLowerCase()}.`;
    }
    if (f.key === 'videoUrl' && v && !/^https:\/\/\S+$/.test(v)) errors[f.key] = 'Enter a video address that starts with https://.';
  });
  Object.assign(errors, custom ? custom(data) || {} : {});
  return errors;
}
/* Plain-language change list between two data objects */
export function describeData(from: Data | null | undefined, to: Data, fields: FieldDef[]): string[] {
  if (!from) return ['New item – everything is added'];
  const out: string[] = [];
  const label = (k: string) => (fields.find(f => f.key === k) || { label: k }).label;
  const show = (k: string, v: unknown): string => {
    const f = fields.find(x => x.key === k) || ({} as FieldDef);
    if (f.type === 'destination') return destLabel(v as Destination);
    if (f.type === 'segment') return segmentName(v as string);
    if (f.type === 'switch' || typeof v === 'boolean') return v ? 'on' : 'off';
    if (f.type === 'datetime') return fmtLocal(v as string);
    if (f.type === 'image') return v === 'none' ? 'no image' : ART_NAMES[v as ArtKey];
    return String(v);
  };
  new Set([...Object.keys(from), ...Object.keys(to)]).forEach(k => {
    if (same(from[k], to[k])) return;
    const a = show(k, from[k]), b = show(k, to[k]);
    out.push(a.length + b.length < 90 ? `${label(k)}: “${a || 'empty'}” → “${b || 'empty'}”` : `${label(k)} is edited`);
  });
  return out;
}
