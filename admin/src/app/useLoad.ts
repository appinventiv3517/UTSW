/* Loads data from a mock service for a page: loading, then the data or an error with a way to try again */
import { useCallback, useEffect, useRef, useState } from 'react';

export type Load<T> = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ok'; data: T };
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []): [Load<T>, () => void, (d: T) => void] {
  const [state, setState] = useState<Load<T>>({ status: 'loading' });
  const seq = useRef(0);
  const run = useCallback(() => {
    const n = ++seq.current;
    setState({ status: 'loading' });
    fn().then(data => { if (n === seq.current) setState({ status: 'ok', data }); }, err => { if (n === seq.current) setState({ status: 'error', error: (err as Error).message }); });
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { run(); return () => { seq.current++; }; }, [run]);
  return [state, run, (data: T) => setState({ status: 'ok', data })];
}
