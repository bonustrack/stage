import { useEffect } from 'react';
import { makeListeners, useStoreValue } from '../../lib/storeCore';

export interface TopnavSlot {
  right?: React.ReactNode;
  override?: React.ReactNode;
}

let slot: TopnavSlot | undefined;
const listeners = makeListeners();
const getSlot = (): TopnavSlot | undefined => slot;

export function useTopnavSlot(): TopnavSlot | undefined {
  return useStoreValue(listeners.subscribe, getSlot);
}

export function usePublishTopnavSlot(next: TopnavSlot, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    slot = next;
    listeners.notify();
    return () => {
      slot = undefined;
      listeners.notify();
    };
  }, [next.right, next.override, enabled]);
}
