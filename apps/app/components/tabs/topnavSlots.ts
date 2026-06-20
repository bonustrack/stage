
import { useEffect, useSyncExternalStore } from 'react';

export interface TopnavSlot {
  right?: React.ReactNode;
  override?: React.ReactNode;
}

let slot: TopnavSlot | undefined;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function useTopnavSlot(): TopnavSlot | undefined {
  return useSyncExternalStore(subscribe, () => slot, () => slot);
}

export function usePublishTopnavSlot(next: TopnavSlot): void {
  useEffect(() => {
    slot = next;
    emit();
    return () => { slot = undefined; emit(); };
  }, [next.right, next.override]);
}
