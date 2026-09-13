
import { makeListeners, useStoreValue } from './storeCore';

let epoch = 0;
const { notify, subscribe } = makeListeners();

export function bumpAccountEpoch(): void {
  epoch += 1;
  notify();
}

export function getAccountEpoch(): number { return epoch; }

export const subscribeAccountEpoch = subscribe;

export function useAccountEpoch(): number {
  return useStoreValue(subscribe, getAccountEpoch);
}
