
import { useSyncExternalStore } from 'react';

let epoch = 0;
const listeners = new Set<() => void>();

export function bumpAccountEpoch(): void {
  epoch += 1;
  for (const l of listeners) l();
}

export function getAccountEpoch(): number { return epoch; }

export function useAccountEpoch(): number {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => epoch,
  );
}
