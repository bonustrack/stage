import { createValueStore, flagCodec } from './persistedStore';

const STORAGE_KEY = 'push.enabled';

const store = createValueStore<boolean>({ key: STORAGE_KEY, default: true, ...flagCodec(true) });

export const loadPushEnabled = (): Promise<boolean> => store.load();

export const isPushEnabledSync = (): boolean => store.get();

export const setPushEnabled = (enabled: boolean): Promise<void> => store.setAsync(enabled);

export const usePushEnabled = (): boolean => store.use();
