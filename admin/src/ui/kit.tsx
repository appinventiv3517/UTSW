/* ==========================================================================================
   Core components. Class names and ids match the earlier portal, so admin.css and the tests apply unchanged.
   Patterns follow designs/guest (buttons, switch, toast with Undo, states with retry, focus ring).
   ========================================================================================== */
import { useRef, type ReactNode, type ButtonHTMLAttributes, type KeyboardEvent } from 'react';
import { cx } from '../app/util';

/* Material Symbols Rounded only. vite.config.ts collects every glyph named in the code into the font subset. */
export function Icon({ name, size = 24, className }: { name: string; size?: number; className?: string }) {
  return <span className={cx('ms', size !== 24 && `s${size}`, className)} aria-hidden="true">{name}</span>;
}

/* ---------- Button ---------- variants: primary, secondary, tonal, text, danger; size: md (44), lg (48) or sm */
export type BtnVariant = 'primary' | 'secondary' | 'tonal' | 'text' | 'danger';
export interface BtnProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  label: string; icon?: string; variant?: BtnVariant; size?: 'md' | 'lg' | 'sm'; iconOnly?: boolean; type?: 'button' | 'submit';
  /* Busy while a mock service call runs: dots replace the label and the name says what is happening */
  busy?: boolean; busyLabel?: string;
  [data: `data-${string}`]: string | number | boolean | undefined;
}
export function Btn({ label, icon, variant = 'secondary', size = 'md', iconOnly = false, type = 'button', busy = false, busyLabel, className, ...rest }: BtnProps) {
  const aria = rest['aria-label'] ?? (iconOnly ? label : undefined);
  return (
    <button type={type} className={cx('btn', `btn-${variant}`, size === 'lg' && 'btn-lg', size === 'sm' && 'btn-sm', iconOnly && 'btn-icon', busy && 'loading', className)}
      title={iconOnly ? label : undefined} {...rest} aria-label={busy ? (busyLabel || 'Working') : aria} aria-busy={busy || undefined}>
      {icon && <Icon name={icon} size={20} />}{!iconOnly && <span className="lbl">{label}</span>}<span className="dots" aria-hidden="true"><i></i><i></i><i></i></span>
    </button>
  );
}

/* ---------- Status badge: always an icon and a word, never color alone ---------- */
export const BADGES: Record<string, [string, string]> = {
  draft: ['edit_note', 'Draft'], demo: ['science', 'Demo'], production: ['public', 'Production'],
  unsaved: ['pending', 'Unsaved changes'], review: ['rate_review', 'Review requested'], changes: ['undo', 'Changes requested'],
  mock: ['database', 'Mock data'], simulated: ['sync_alt', 'Simulated'], planned: ['schedule', 'Planned'],
  visible: ['visibility', 'Visible'], hidden: ['visibility_off', 'Hidden'], fixed: ['lock', 'Fixed'],
  pending: ['help', 'Pending confirmation'], error: ['error', 'Error'], live: ['check_circle', 'Live']
};
/* EXTRA_GLYPHS: edit_note science public pending rate_review undo database sync_alt schedule visibility visibility_off lock help error check_circle info */
export function Badge({ kind, text }: { kind: string | null | undefined; text?: ReactNode }) {
  const k = kind || 'info';
  const [icon, word] = BADGES[k] || ['info', k];
  return <span className={`badge badge-${k}`}><Icon name={icon} size={16} /><span>{text ?? word}</span></span>;
}

/* ---------- Switch (role="switch") and checkbox ---------- */
export function Switch({ id, checked, label, labelledby, describedby, disabled, onChange, ...rest }: { id?: string; checked: boolean; label?: string; labelledby?: string; describedby?: string; disabled?: boolean; onChange?: (v: boolean) => void; [data: `data-${string}`]: string | undefined }) {
  return (
    <button type="button" className="switch" role="switch" id={id} aria-checked={!!checked} aria-labelledby={labelledby} aria-label={labelledby ? undefined : label}
      aria-describedby={describedby} disabled={disabled} onClick={() => onChange && onChange(!checked)} {...rest}><span className="track" aria-hidden="true"></span></button>
  );
}
export function Checkbox({ id, label, checked, onChange, disabled }: { id: string; label: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="check" htmlFor={id}><input type="checkbox" id={id} checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span className="box" aria-hidden="true"><Icon name="check" size={16} /></span><span>{label}</span></label>
  );
}

/* ---------- Segmented control (radio group); arrow keys move the selection, as radios do ---------- */
export function Segmented<V extends string>({ id, label, options, value, onChange }: { id?: string; label: string; options: [V, ReactNode][]; value: V; onChange: (v: V) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = (e: KeyboardEvent, i: number) => {
    const d = ['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + options.length) % options.length;
    onChange(options[n][0]);
    requestAnimationFrame(() => (ref.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[n])?.focus());
  };
  return (
    <div className="seg" role="radiogroup" aria-label={label} id={id} ref={ref}>
      {options.map(([v, l], i) => <button key={v} type="button" role="radio" data-value={v} aria-checked={v === value} tabIndex={v === value ? 0 : -1}
        onClick={() => onChange(v)} onKeyDown={e => key(e, i)}>{l}</button>)}
    </div>
  );
}

/* ---------- Card ---------- */
export function Card({ title, titleId, actions, className, level = 2, children, headTabIndex }: { title?: ReactNode; titleId?: string; actions?: ReactNode; className?: string; level?: 2 | 3; children?: ReactNode; headTabIndex?: number }) {
  const H = `h${level}` as 'h2' | 'h3';
  return (
    <section className={cx('card', className)} aria-labelledby={title ? titleId : undefined}>
      {title && <div className="card-head"><H id={titleId} tabIndex={headTabIndex}>{title}</H>{actions && <div className="card-actions">{actions}</div>}</div>}
      <div className="card-body">{children}</div>
    </section>
  );
}

/* ---------- Loading, error and empty states ---------- */
export const LoadingState = ({ text = 'Loading' }: { text?: string }) => (
  <div className="state state-loading" role="status"><span className="vh">{text}…</span>
    <div className="sk-stack" aria-hidden="true"><span className="sk sk-w1"></span><span className="sk sk-w2"></span><span className="sk sk-w3"></span><span className="sk sk-block"></span></div></div>
);
export const ErrorState = ({ msg, onRetry }: { msg: string; onRetry: () => void }) => (
  <div className="state state-error" role="alert"><Icon name="error" size={32} className="f1" /><h2>We couldn’t load this</h2><p>{msg}</p>
    <Btn label="Try again" icon="refresh" variant="primary" data-retry="" onClick={onRetry} /></div>
);
export function EmptyState({ icon = 'inbox', title, text, action, level = 2 }: { icon?: string; title: string; text?: ReactNode; action?: ReactNode; level?: 2 | 3 }) {
  const H = `h${level}` as 'h2' | 'h3';
  return <div className="state state-empty"><Icon name={icon} size={32} /><H>{title}</H>{text && <p>{text}</p>}{action}</div>;
}

/* ---------- Stepper: ordered steps with a state word each ---------- */
export interface Step { title: string; state: 'done' | 'current' | 'todo'; detail?: ReactNode }
const STEP_WORD = { done: 'Completed', current: 'Current step', todo: 'Not started' };
const STEP_GLYPH = { done: 'check_circle', current: 'radio_button_checked', todo: 'radio_button_unchecked' };
/* EXTRA_GLYPHS: radio_button_checked radio_button_unchecked */
export function Stepper({ steps, label }: { steps: Step[]; label: string }) {
  return (
    <ol className="stepper" aria-label={label}>{steps.map(s => (
      <li key={s.title} className={`step step-${s.state}`} aria-current={s.state === 'current' ? 'step' : undefined}>
        <span className="step-ic"><Icon name={STEP_GLYPH[s.state]} size={24} className={s.state === 'todo' ? undefined : 'f1'} /></span>
        <span className="step-txt"><span className="step-t">{s.title} <span className="vh">– {STEP_WORD[s.state]}</span></span>{s.detail && <span className="step-d">{s.detail}</span>}</span>
      </li>))}
    </ol>
  );
}

/* A labelled description list (facts) */
export const Muted = ({ children }: { children: ReactNode }) => <span className="muted">{children}</span>;
