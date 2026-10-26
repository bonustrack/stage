import { makeValue } from './storeCore';

const epoch = makeValue(0);

export function bumpAccountEpoch(): void {
  epoch.set(epoch.get() + 1);
}

export const getAccountEpoch = epoch.get;

export const subscribeAccountEpoch = epoch.subscribe;

export const useAccountEpoch = epoch.use;
