/* ---------- Table with search, a filter panel, sortable headers and pagination (8 rows a page) ----------
   Filters live behind one Filters button: the panel holds every filter and applies them together with Apply.
   Applied filters show as removable chips, so nothing is hidden from view once it's in effect. */
/* EXTRA_GLYPHS: arrow_upward arrow_downward unfold_more filter_list close search search_off chevron_left chevron_right */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Btn, EmptyState, Icon } from './kit';
import { Select } from './Select';
import { announce, plural, cx } from '../app/util';

export interface Column<T> { key: string; label: string; sortable?: boolean; sortValue?: (r: T) => string | number; render: (r: T) => ReactNode; cls?: string; hideLabel?: boolean }
export interface TableFilter<T> { key: string; label: string; options: [string, string][]; match: (r: T, v: string) => boolean }
export interface TableProps<T> {
  id: string; caption: string; noun?: string; rows: T[]; columns: Column<T>[]; searchText: (r: T) => string; searchPlaceholder?: string;
  filters?: TableFilter<T>[]; defaultSort?: { key: string; dir: 'asc' | 'desc' } | null; initialFilters?: Record<string, string | string[]>;
  empty: { icon?: string; title: string; text?: ReactNode; action?: ReactNode }; actions?: ReactNode; rowKey?: (r: T, i: number) => string;
}
export const TABLE_PAGE_SIZE = 8;
type Filters = Record<string, string[]>;

export function DataTable<T>(cfg: TableProps<T>) {
  const { id, filters = [], columns } = cfg;
  const size = TABLE_PAGE_SIZE;
  const [q, setQ] = useState('');
  const [applied, setApplied] = useState<Filters>(() => Object.fromEntries(Object.entries(cfg.initialFilters || {}).map(([k, v]) => [k, ([] as string[]).concat(v)])));
  const [sort, setSort] = useState(cfg.defaultSort || null);
  const [page, setPage] = useState(0);
  const [panel, setPanel] = useState(false);
  const [pending, setPending] = useState<Filters>({});
  const root = useRef<HTMLDivElement>(null);
  const focusAfter = useRef<string | null>(null);
  useEffect(() => {
    if (!focusAfter.current || !root.current) return;
    const el = root.current.querySelector<HTMLElement>(focusAfter.current); focusAfter.current = null;
    el && el.focus();
  });
  const fLabel = (f: TableFilter<T>, v: string) => f.options.find(x => String(x[0]) === String(v))?.[1] ?? v;

  /* Rows after search, filters and sort */
  const ql = q.trim().toLowerCase();
  let all = cfg.rows.filter(r => (!ql || cfg.searchText(r).toLowerCase().includes(ql)) &&
    filters.every(f => !(applied[f.key] || []).length || applied[f.key].some(v => f.match(r, v))));
  if (sort) {
    const col = columns.find(c => c.key === sort.key);
    if (col) {
      const v = col.sortValue || ((r: T) => (r as Record<string, unknown>)[col.key] as string | number);
      all = [...all].sort((a, b) => (v(a) > v(b) ? 1 : v(a) < v(b) ? -1 : 0) * (sort.dir === 'asc' ? 1 : -1));
    }
  }
  const pages = Math.max(1, Math.ceil(all.length / size));
  const pg = Math.min(page, pages - 1);
  const rows = all.slice(pg * size, pg * size + size);
  const filtered = !!q || Object.values(applied).some(v => v && v.length);
  const count = `${plural(all.length, cfg.noun || 'row')}${filtered ? ` of ${cfg.rows.length}` : ''}`;
  const on = filters.flatMap(f => (applied[f.key] || []).map(v => [f, v] as const));

  const apply = (next: Filters) => {
    setApplied(next); setPage(0);
    const n = Object.values(next).reduce((a, v) => a + (v ? v.length : 0), 0);
    const ql2 = q.trim().toLowerCase();
    const cnt = cfg.rows.filter(r => (!ql2 || cfg.searchText(r).toLowerCase().includes(ql2)) && filters.every(f => !(next[f.key] || []).length || next[f.key].some(v => f.match(r, v)))).length;
    const isF = !!q || n > 0;
    announce(`${n ? plural(n, 'filter') + ' applied' : 'Filters cleared'}. ${plural(cnt, cfg.noun || 'row')}${isF ? ` of ${cfg.rows.length}` : ''}.`);
  };
  const openPanel = () => { setPending(applied); setPanel(true); focusAfter.current = `#${CSS.escape(id)}-fp .dd-btn`; };
  const closePanel = (focusBtn: boolean) => { setPanel(false); if (focusBtn) focusAfter.current = `#${CSS.escape(id)}-fbtn`; };
  /* Clicking outside the open panel closes it (a dropdown list opened from the panel counts as inside) */
  useEffect(() => {
    if (!panel) return;
    const out = (e: PointerEvent) => { const t = e.target as Element; if (t.closest('.dd-list')) return; if (!t.closest('.tbl-fwrap') || !root.current?.contains(t)) setPanel(false); };
    document.addEventListener('pointerdown', out, true);
    return () => document.removeEventListener('pointerdown', out, true);
  }, [panel]);
  const clearAll = () => { setQ(''); setApplied({}); setPending({}); setPage(0); focusAfter.current = `#${CSS.escape(id)}-q`; };
  const goPage = (v: 'prev' | 'next' | number) => {
    const n = v === 'prev' ? pg - 1 : v === 'next' ? pg + 1 : v;
    setPage(n);
    const nPages = pages;
    focusAfter.current = (v === 'prev' && n === 0) || (v === 'next' && n >= nPages - 1) ? `[data-page="${n}"]` : `[data-page="${v}"]`;
    announce(`Page ${n + 1}`);
  };
  const sortBy = (c: Column<T>) => {
    const dir = sort && sort.key === c.key && sort.dir === 'asc' ? 'desc' : 'asc';
    setSort({ key: c.key, dir }); focusAfter.current = `[data-sort="${c.key}"]`;
    announce(`Sorted by ${c.label}, ${dir === 'asc' ? 'ascending' : 'descending'}`);
  };
  const removeChip = (k: string, v: string, i: number) => {
    const next = { ...applied }; next[k] = (next[k] || []).filter(x => x !== v); if (!next[k].length) delete next[k];
    apply(next);
    const left = on.length - 1;
    focusAfter.current = left ? `[data-chip]:nth-of-type(${Math.min(i, left - 1) + 1})` : `#${CSS.escape(id)}-fbtn`;
  };

  /* Page numbers: all of them up to 7, otherwise first, last and the pages around the current one */
  const nums: (number | '…')[] = [];
  for (let k = 0; k < pages; k++) if (pages <= 7 || k === 0 || k === pages - 1 || Math.abs(k - pg) <= 1) nums.push(k); else if (nums[nums.length - 1] !== '…') nums.push('…');
  const nOn = on.length;
  return (
    <div className="tbl-root" ref={root} onKeyDown={e => {
      if (e.key === 'Escape' && panel) { e.preventDefault(); e.stopPropagation(); closePanel(true); }
      if (e.key === 'Tab' && panel) {   /* keep Tab inside the open panel */
        const fp = root.current!.querySelector(`#${CSS.escape(id)}-fp`)!;
        const f = [...fp.querySelectorAll<HTMLButtonElement>('button')].filter(x => !x.disabled), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }}>
      <div className="tbl-tools" role="search" aria-label={cfg.caption}>
        <div className="tbl-search"><label htmlFor={`${id}-q`} className="vh">Search {cfg.caption.toLowerCase()}</label><Icon name="search" size={20} />
          <input className="input" type="search" id={`${id}-q`} placeholder={cfg.searchPlaceholder || 'Search'} value={q} onChange={e => { setQ(e.target.value); setPage(0); }} /></div>
        {filters.length > 0 && (
          <div className="tbl-fwrap">
            <button type="button" className={cx('tbl-fbtn', nOn > 0 && 'on')} id={`${id}-fbtn`} aria-expanded={panel} aria-controls={`${id}-fp`} aria-label={nOn ? `Filters, ${nOn} applied` : 'Filters'} title="Filters"
              onClick={() => (panel ? closePanel(true) : openPanel())}><Icon name="filter_list" size={20} /><span className="tbl-fcount" hidden={!nOn}>{nOn || ''}</span></button>
            <div className="tbl-fpanel" id={`${id}-fp`} role="dialog" aria-labelledby={`${id}-fp-h`} hidden={!panel}>
              <h3 className="fp-h" id={`${id}-fp-h`}>Filter {cfg.caption.toLowerCase()}</h3>
              <div className="fp-body">{filters.map(f => (
                <div className="field" key={f.key}><label className="label" htmlFor={`${id}-f-${f.key}-dd`} id={`${id}-f-${f.key}-lbl`}>{f.label}</label>
                  <Select id={`${id}-f-${f.key}`} multiple allLabel="All" options={f.options} values={pending[f.key] || []} labelId={`${id}-f-${f.key}-lbl`} data={{ filter: f.key }}
                    onChangeMulti={v => setPending(p => ({ ...p, [f.key]: v }))} /></div>))}
              </div>
              <div className="fp-foot">
                <Btn label="Clear all" variant="text" data-fp="clear" onClick={() => { setPending({}); apply({}); closePanel(true); }} />
                <Btn label="Apply" variant="primary" data-fp="apply" onClick={() => { apply(Object.fromEntries(Object.entries(pending).filter(([, v]) => v.length))); closePanel(true); }} />
              </div>
            </div>
          </div>
        )}
        <p className="tbl-count vh" id={`${id}-count`} role="status">{count}</p>
        {cfg.actions && <div className="tbl-actions">{cfg.actions}</div>}
      </div>
      {filters.length > 0 && (
        <div className="tbl-chips" aria-label="Applied filters" role="group" hidden={!nOn}>
          {on.map(([f, v], i) => (
            <button type="button" className="tbl-chip" key={`${f.key}-${v}`} data-chip={f.key} data-v={v} aria-label={`Remove filter ${f.label}: ${fLabel(f, v)}`} onClick={() => removeChip(f.key, v, i)}>
              <span><span className="chip-k">{f.label}:</span> {fLabel(f, v)}</span><Icon name="close" size={16} /></button>))}
          {nOn > 1 && <button type="button" className="text-link tbl-chip-clear" data-clear="" onClick={clearAll}>Clear all</button>}
        </div>
      )}
      <div className="tbl-wrap" tabIndex={0} role="region" aria-labelledby={`${id}-cap`} hidden={!all.length}>
        <table className="tbl"><caption id={`${id}-cap`} className="vh">{cfg.caption}</caption>
          <thead><tr>{columns.map(c => {
            const sorted = sort && sort.key === c.key;
            return (
              <th key={c.key} scope="col" className={c.cls || ''} aria-sort={c.sortable ? (sorted ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}>
                {c.sortable
                  ? <button type="button" className="th-sort" data-sort={c.key} onClick={() => sortBy(c)}>{c.label}<Icon name={sorted ? (sort!.dir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'} size={16} /></button>
                  : c.hideLabel ? <span className="vh">{c.label}</span> : c.label}
              </th>);
          })}</tr></thead>
          <tbody>{rows.map((r, ri) => (
            <tr key={cfg.rowKey ? cfg.rowKey(r, ri) : ri}>{columns.map((c, i) => i === 0
              ? <th key={c.key} scope="row" className={c.cls || ''}>{c.render(r)}</th>
              : <td key={c.key} className={['acts', 'v', 'details'].includes(c.key) ? 'acts' : c.cls || ''}>{c.render(r)}</td>)}</tr>))}
          </tbody>
        </table>
      </div>
      <div className="tbl-empty" hidden={!!all.length}>
        {!all.length && (filtered
          ? <EmptyState icon="search_off" title="No matches" text="Nothing matches this search and these filters." level={3} action={<Btn label="Clear search and filters" variant="secondary" data-clear="" onClick={clearAll} />} />
          : <EmptyState {...cfg.empty} level={3} />)}
      </div>
      <nav className="pager" aria-label={`${cfg.caption} pages`} hidden={pages < 2}>
        {pages > 1 && <>
          <span className="pg-info">{pg * size + 1}–{pg * size + rows.length} of {all.length}</span>
          <span className="pg-btns">
            <Btn label="Previous page" icon="chevron_left" variant="text" iconOnly data-page="prev" disabled={pg === 0} onClick={() => goPage('prev')} />
            {nums.map((k, i) => k === '…' ? <span key={`g${i}`} className="pg-gap" aria-hidden="true">…</span>
              : <button key={k} type="button" className="pg-n" data-page={k} aria-label={`Page ${k + 1}`} aria-current={k === pg ? 'page' : undefined} onClick={() => goPage(k)}>{k + 1}</button>)}
            <Btn label="Next page" icon="chevron_right" variant="text" iconOnly data-page="next" disabled={pg >= pages - 1} onClick={() => goPage('next')} />
          </span>
        </>}
      </nav>
    </div>
  );
}

