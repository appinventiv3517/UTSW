/* ---------- Toasts, modal dialogs and confirm dialogs ----------
   Both are opened from anywhere (toast('Saved'), await confirmDialog({...})) and drawn by hosts mounted once in the app.
   Dialogs are native <dialog> elements opened with showModal: inert background, Escape closes, focus returns. */
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Btn, Icon, type BtnVariant } from './kit';
import { cx } from '../app/util';

/* A tiny observable list, used by both hosts */
function listStore<T>() {
  let items: T[] = [];
  const subs = new Set<() => void>();
  return {
    get: () => items,
    set(next: T[]) { items = next; subs.forEach(f => f()); },
    subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }
  };
}

/* ---------- Toast: polite live region, optional action (Undo), 5 seconds ---------- */
interface ToastItem { id: number; msg: string; kind: 'info' | 'success' | 'error'; action?: string; onAction?: () => void; ms: number }
const toasts = listStore<ToastItem>();
let toastSeq = 0;
export function toast(msg: string, { kind = 'info', action, onAction, ms = 5000 }: { kind?: ToastItem['kind']; action?: string; onAction?: () => void; ms?: number } = {}): void {
  toasts.set([...toasts.get(), { id: ++toastSeq, msg, kind, action, onAction, ms }]);
}
function ToastView({ t }: { t: ToastItem }) {
  const [out, setOut] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const kill = () => { clearTimeout(timer.current); setOut(true); setTimeout(() => toasts.set(toasts.get().filter(x => x.id !== t.id)), 200); };
  const arm = () => { clearTimeout(timer.current); timer.current = setTimeout(kill, t.ms); };
  const hold = () => clearTimeout(timer.current);
  useEffect(() => { arm(); return hold; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={cx('toast', `toast-${t.kind}`, out && 'out')} onMouseEnter={hold} onMouseLeave={arm} onFocus={hold} onBlur={arm}>
      <Icon name={t.kind === 'error' ? 'error' : t.kind === 'success' ? 'check_circle' : 'info'} size={20} className="f1" />
      <span className="toast-msg">{t.msg}</span>
      {t.action && <button type="button" className="toast-act" onClick={() => { kill(); t.onAction && t.onAction(); }}>{t.action}</button>}
      <button type="button" className="toast-x" aria-label="Dismiss notification" onClick={kill}><Icon name="close" size={20} /></button>
    </div>
  );
}
export function ToastHost() {
  const list = useSyncExternalStore(toasts.subscribe, toasts.get);
  const host = document.getElementById('toasts');
  return host ? createPortal(list.map(t => <ToastView key={t.id} t={t} />), host) : null;
}

/* ---------- Modal ---------- */
export interface ModalCtl { close: () => void }
interface ModalItem { id: number; wide: boolean; render: (ctl: ModalCtl) => ReactNode; from: Element | null; onClose?: () => void }
const modals = listStore<ModalItem>();
let modalSeq = 0;
/* render returns a <ModalFrame>: the heading, body and actions of the dialog */
export function openModal({ wide = false, render, onClose }: { wide?: boolean; render: (ctl: ModalCtl) => ReactNode; onClose?: () => void }): ModalCtl {
  const id = ++modalSeq;
  modals.set([...modals.get(), { id, wide, render, from: document.activeElement, onClose }]);
  return { close: () => { const d = document.querySelector<HTMLDialogElement>(`dialog[data-modal="${id}"]`); if (d && d.open) d.close(); } };
}
function ModalDialog({ m }: { m: ModalItem }) {
  const ref = useRef<HTMLDialogElement>(null);
  const ctl: ModalCtl = { close: () => { const d = ref.current; if (d && d.open) d.close(); } };
  useEffect(() => {
    const d = ref.current!;
    const done = () => {
      modals.set(modals.get().filter(x => x.id !== m.id));
      if (m.onClose) m.onClose();
      const from = m.from as HTMLElement | null;
      if (from && from.isConnected) from.focus();
    };
    d.addEventListener('close', done);
    d.showModal();
    (d.querySelector<HTMLElement>('[autofocus]') || d.querySelector<HTMLElement>('#modal-h'))?.focus();
    return () => d.removeEventListener('close', done);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <dialog ref={ref} className={cx('modal', m.wide && 'wide')} aria-labelledby="modal-h" data-modal={m.id}>{m.render(ctl)}</dialog>;
}
export function ModalHost() {
  const list = useSyncExternalStore(modals.subscribe, modals.get);
  return <>{list.map(m => <ModalDialog key={m.id} m={m} />)}</>;
}
/* The dialog's content: a form, so Enter submits and a submit button confirms */
export function ModalFrame({ title, close, onSubmit, actions, children }: { title: string; close: () => void; onSubmit?: (e: FormEvent<HTMLFormElement>) => void; actions: ReactNode; children: ReactNode }) {
  return (
    <form method="dialog" className="modal-form" noValidate onSubmit={e => { e.preventDefault(); onSubmit ? onSubmit(e) : close(); }}>
      <div className="modal-head"><h2 id="modal-h" tabIndex={-1}>{title}</h2><Btn label="Close" icon="close" variant="text" iconOnly data-close="" onClick={close} /></div>
      <div className="modal-body">{children}</div>
      <div className="modal-actions">{actions}</div>
    </form>
  );
}

/* ---------- Confirm dialog: resolves { ok, comment }. A required comment is checked before confirming. ---------- */
export interface CommentOpt { label: string; hint?: string; required?: boolean; value?: string }
export interface ConfirmOpts { title: string; body: ReactNode; confirmLabel: string; variant?: BtnVariant; comment?: CommentOpt | null; cancelLabel?: string; wide?: boolean }
export interface ConfirmResult { ok: boolean; comment: string }
function ConfirmBody({ o, close, resolve }: { o: ConfirmOpts; close: () => void; resolve: (r: ConfirmResult) => void }) {
  const [text, setText] = useState(o.comment?.value || '');
  const [err, setErr] = useState('');
  const ta = useRef<HTMLTextAreaElement>(null);
  const c = o.comment;
  const submit = () => {
    if (c && c.required && !text.trim()) { setErr(`Enter ${c.label.toLowerCase()} so others know why.`); ta.current?.focus(); return; }
    resolve({ ok: true, comment: text.trim() }); close();
  };
  const desc = [c?.hint && 'cf-comment-hint', err && 'cf-comment-err'].filter(Boolean).join(' ') || undefined;
  return (
    <ModalFrame title={o.title} close={close} onSubmit={submit}
      actions={<><Btn label={o.cancelLabel || 'Cancel'} variant="text" data-close="" onClick={close} /><Btn label={o.confirmLabel} variant={o.variant || 'primary'} type="submit" data-confirm="" /></>}>
      {o.body}
      {c && (
        <div className={cx('field', err && 'has-error')}>
          <label htmlFor="cf-comment">{c.label}{c.required && <> <span className="req">(required)</span></>}</label>
          {c.hint && <p className="hint" id="cf-comment-hint">{c.hint}</p>}
          <textarea ref={ta} className="input" rows={3} id="cf-comment" name="cf-comment" required={!!c.required} aria-required={c.required || undefined}
            aria-invalid={err ? true : undefined} aria-describedby={desc} value={text} onChange={e => setText(e.target.value)} />
          <p className="err" id="cf-comment-err" hidden={!err}><Icon name="error" size={16} /><span>{err}</span></p>
        </div>
      )}
    </ModalFrame>
  );
}
export function confirmDialog(o: ConfirmOpts): Promise<ConfirmResult> {
  return new Promise(resolve => {
    let done = false;
    const res = (r: ConfirmResult) => { done = true; resolve(r); };
    openModal({ wide: !!o.wide, render: ({ close }) => <ConfirmBody o={o} close={close} resolve={res} />, onClose: () => { if (!done) resolve({ ok: false, comment: '' }); } });
  });
}
