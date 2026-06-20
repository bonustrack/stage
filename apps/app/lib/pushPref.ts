

import { createValueStore } from './persistedStore';

const STORAGE_KEY = 'push.enabled';

const store = createValueStore<boolean>({
  key: STORAGE_KEY,
  default: true,
  serialize: (v) => (v ? '1' : '0'),
  deserialize: (raw) => (raw === '0' || raw === 'false' ? false : true),
  alwaysNotify: true,
});

export const loadPushEnabled = (): Promise<boolean> => store.load();

export const isPushEnabledSync = (): boolean => store.get();

export const setPushEnabled = (enabled: boolean): Promise<void> => store.setAsync(enabled);

export const subscribePushPref = (cb: () => void): () => void => store.subscribe(cb);
