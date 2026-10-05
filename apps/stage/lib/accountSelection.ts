import { makeListeners, useStoreValue } from './storeCore';

let version = 0;
const { notify, subscribe } = makeListeners();

export function accountSelectionChanged(): void {
  version += 1;
  notify();
}

export function getAccountSelection(): number { return version; }

export const subscribeAccountSelection = subscribe;

export function useAccountSelection(): number {
  return useStoreValue(subscribe, getAccountSelection);
}
