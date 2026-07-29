
import { makeListeners, useStoreValue } from './storeCore';

let epoch = 0;
const { listeners, notify } = makeListeners();

export function bumpAccountEpoch(): void {
  epoch += 1;
  notify();
}

export function getAccountEpoch(): number { return epoch; }

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function useAccountEpoch(): number {
  return useStoreValue(subscribe, getAccountEpoch);
}
