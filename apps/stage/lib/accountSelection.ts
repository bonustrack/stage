import { makeValue } from './storeCore';

const version = makeValue(0);

export function accountSelectionChanged(): void {
  version.set(version.get() + 1);
}

export const getAccountSelection = version.get;

export const subscribeAccountSelection = version.subscribe;

export const useAccountSelection = version.use;
