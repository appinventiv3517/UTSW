/* ---------- Dropdown: one design for every select in the portal ----------
   A native <select> stays in the DOM as the source of truth (tests and assistive fallbacks can still set it) but is
   hidden from view and from assistive tech. A button shows the current choice and opens a listbox in the top layer
   (popover), so it is never clipped by a table, card or dialog.
   - Single select: pick one option, the list closes.
   - Multiple select: options have checkboxes and the list stays open; an "All" row clears the choice. Used by table filters.
   Keyboard: Enter, Space, Alt+Down or Down opens. Up, Down, Home, End and typing move. Enter or Space picks.
   Escape closes without picking, Tab closes. The listbox uses aria-activedescendant, so focus stays on the button. */
/* EXTRA_GLYPHS: expand_more check */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './kit';
import { announce, cx } from '../app/util';

export type Opt = [string, string] | [string, string, { disabled?: boolean }];
export interface SelectProps {
  id: string; options: Opt[]; className?: string;
  value?: string; onChange?: (v: string) => void;
  multiple?: boolean; values?: string[]; onChangeMulti?: (v: string[]) => void; allLabel?: string;
  icons?: boolean; labelId?: string; ariaLabel?: string; describedby?: string; invalid?: boolean; required?: boolean; disabled?: boolean;
  placeholder?: boolean; data?: Record<string, string | number>;
}
const popoverOk = typeof HTMLElement !== 'undefined' && 'popover' in HTMLElement.prototype;
let closeOpen: (() => void) | null = null;

export function Select(p: SelectProps) {
  const { id, options, multiple = false } = p;
  const sel = useRef<HTMLSelectElement>(null), btn = useRef<HTMLButtonElement>(null), list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [host, setHost] = useState<Element | null>(null);
  const type = useRef({ s: '', t: 0 as unknown as ReturnType<typeof setTimeout> });
  const values = multiple ? (p.values || []) : [p.value ?? ''];
  const isOn = (v: string) => values.includes(v);
  const rows: { all?: boolean; v: string; text: string; disabled?: boolean }[] = [
    ...(multiple ? [{ all: true, v: '', text: p.allLabel || 'All' }] : []),
    ...options.map(o => ({ v: o[0], text: o[1], disabled: o[2]?.disabled }))
  ];
  const rowOn = (r: typeof rows[number]) => r.all ? !values.length : isOn(r.v);
  const text = multiple
    ? (!values.length ? (p.allLabel || 'All') : values.length === 1 ? (options.find(o => o[0] === values[0])?.[1] ?? values[0]) : `${options.find(o => o[0] === values[0])?.[1] ?? values[0]} +${values.length - 1}`)
    : (options.find(o => o[0] === p.value)?.[1] ?? options[0]?.[1] ?? '');
  const vid = `${id}-ddv`;

  const close = (focus = false) => {
    setOpen(false);
    if (closeOpen === closer.current) closeOpen = null;
    if (focus) btn.current?.focus();
  };
  const closer = useRef<() => void>(() => close());
  closer.current = () => close();
  const show = () => {
    if (closeOpen) closeOpen();
    closeOpen = () => closer.current();
    setHost(btn.current?.closest('dialog') || document.body);
    setActive(Math.max(0, rows.findIndex(rowOn)));
    setOpen(true);
  };

  /* Place the list under the button (or above it when there is more room there) */
  const place = () => {
    const l = list.current, b = btn.current; if (!l || !b) return;
    const r = b.getBoundingClientRect(), gap = 4, vh = innerHeight;
    l.style.minWidth = `${Math.max(r.width, 200)}px`;
    l.style.maxWidth = `${Math.min(420, innerWidth - 16)}px`;
    const below = vh - r.bottom - gap - 8, above = r.top - gap - 8, need = Math.min(l.scrollHeight, 320);
    const up = below < need && above > below;
    l.style.maxHeight = `${Math.max(120, Math.min(320, up ? above : below))}px`;
    l.style.left = `${Math.max(8, Math.min(r.left, innerWidth - l.offsetWidth - 8))}px`;
    l.style.top = up ? `${Math.max(8, r.top - gap - l.offsetHeight)}px` : `${r.bottom + gap}px`;
    l.classList.toggle('up', up);
  };
  useLayoutEffect(() => {
    if (!open || !list.current) return;
    const l = list.current;
    if (popoverOk) { l.setAttribute('popover', 'manual'); try { l.showPopover(); } catch (e) { /* already shown */ } }
    place();
    const outside = (e: PointerEvent) => { const t = e.target as Node; if (!l.contains(t) && !btn.current?.contains(t)) close(); };
    const scroll = (e: Event) => { if (!l.contains(e.target as Node)) place(); };
    document.addEventListener('pointerdown', outside, true);
    addEventListener('resize', place); addEventListener('scroll', scroll, true);
    return () => { document.removeEventListener('pointerdown', outside, true); removeEventListener('resize', place); removeEventListener('scroll', scroll, true); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) list.current?.querySelector(`#${CSS.escape(`${id}-o${active}`)}`)?.scrollIntoView({ block: 'nearest' }); }, [open, active, id]);
  useEffect(() => () => { if (closeOpen === closer.current) closeOpen = null; }, []);

  const pick = (k: number) => {
    const r = rows[k]; if (!r || r.disabled) return;
    if (multiple) {
      const next = r.all ? [] : isOn(r.v) ? values.filter(v => v !== r.v) : [...values, r.v];
      p.onChangeMulti && p.onChangeMulti(options.map(o => o[0]).filter(v => next.includes(v)));
      setActive(k);
      announce(r.all ? 'All selected' : `${r.text} ${next.includes(r.v) ? 'selected' : 'not selected'}`);
      return;
    }
    close(true);
    if (r.v !== p.value) p.onChange && p.onChange(r.v);
  };
  const key = (e: KeyboardEvent) => {
    if (!open) { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show(); } return; }
    const n = rows.length, mv = (k: number) => setActive(Math.max(0, Math.min(n - 1, k)));
    if (e.key === 'ArrowDown') { e.preventDefault(); mv(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); e.altKey ? close(true) : mv(active - 1); }
    else if (e.key === 'Home' || e.key === 'PageUp') { e.preventDefault(); mv(0); }
    else if (e.key === 'End' || e.key === 'PageDown') { e.preventDefault(); mv(n - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(active); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
    else if (e.key === 'Tab') close();
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {        /* type to jump */
      const t = type.current; clearTimeout(t.t); t.s += e.key.toLowerCase(); t.t = setTimeout(() => { t.s = ''; }, 600);
      const k = rows.findIndex((r, i) => r.text.toLowerCase().startsWith(t.s) && (t.s.length > 1 || i > active));
      const k2 = k >= 0 ? k : rows.findIndex(r => r.text.toLowerCase().startsWith(t.s));
      if (k2 >= 0) mv(k2);
    }
  };
  const nativeChange = () => {
    const s = sel.current!;
    if (multiple) p.onChangeMulti && p.onChangeMulti([...s.selectedOptions].map(o => o.value));
    else p.onChange && p.onChange(s.value);
  };
  const dataAttrs = Object.fromEntries(Object.entries(p.data || {}).map(([k, v]) => [`data-${k}`, String(v)]));
  const labelledby = p.labelId ? `${p.labelId} ${vid}` : undefined;
  const lead = p.icons ? (p.value || '') : '';
  return (
    <>
      <select ref={sel} id={id} className={cx(p.className || 'input', 'dd-native')} tabIndex={-1} aria-hidden="true" data-dd="" multiple={multiple}
        value={multiple ? values : (p.value ?? '')} onChange={nativeChange} onFocus={() => btn.current?.focus()} disabled={p.disabled}
        aria-invalid={p.invalid || undefined} aria-describedby={p.describedby} aria-required={p.required || undefined} data-all-label={multiple ? (p.allLabel || 'All') : undefined}
        {...(p.icons ? { 'data-dd-icons': '' } : {})} {...dataAttrs}>
        {options.map(o => <option key={o[0]} value={o[0]} disabled={o[2]?.disabled}>{o[1]}</option>)}
      </select>
      <button ref={btn} type="button" id={`${id}-dd`} className={cx(p.className || 'input', 'dd-btn', !multiple && p.placeholder && p.value === '' && 'dd-placeholder', multiple && values.length > 0 && 'dd-on')}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-lb` : undefined} aria-activedescendant={open ? `${id}-o${active}` : undefined}
        aria-labelledby={labelledby} aria-label={labelledby ? undefined : p.ariaLabel} aria-describedby={p.describedby ?? (labelledby ? undefined : vid)}
        aria-invalid={p.invalid || undefined} aria-required={p.required || undefined} disabled={p.disabled} data-multi={multiple ? '' : undefined}
        onClick={() => (open ? close() : show())} onKeyDown={key}>
        {p.icons && <span className="dd-lead" aria-hidden="true">{lead && <Icon name={lead} size={20} />}</span>}
        <span className="dd-v" id={vid}>{text}</span><Icon name="expand_more" size={20} className="dd-chev" />
      </button>
      {open && host && createPortal(
        <div ref={list} className="dd-list" id={`${id}-lb`} role="listbox" aria-labelledby={labelledby || (p.ariaLabel ? undefined : `${id}-dd`)} aria-label={labelledby ? undefined : p.ariaLabel}
          aria-multiselectable={multiple || undefined} onPointerDown={e => e.preventDefault()}>
          {rows.map((r, k) => (
            <div key={k} className={cx('dd-opt', r.all && 'dd-all', k === active && 'active')} role="option" id={`${id}-o${k}`} data-k={k} aria-selected={rowOn(r)} aria-disabled={r.disabled || undefined}
              onClick={() => pick(k)} onPointerMove={() => { if (k !== active) setActive(k); }}>
              {multiple && <span className="dd-box" aria-hidden="true"><Icon name="check" size={16} /></span>}
              {p.icons && !r.all && <span className="dd-oic" aria-hidden="true"><Icon name={r.v} size={20} /></span>}
              <span className="dd-t">{r.text}</span>
              {!multiple && <span className="dd-tick" aria-hidden="true"><Icon name="check" size={20} /></span>}
            </div>
          ))}
        </div>, host)}
    </>
  );
}
