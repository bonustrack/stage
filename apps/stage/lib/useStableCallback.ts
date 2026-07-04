
import { useCallback, useRef } from 'react';

export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const latest = useRef(fn);
  latest.current = fn;
  return useCallback((...args: A): R => latest.current(...args), []);
}
