import { createValueStore, flagCodec } from './persistedStore';

const store = createValueStore<boolean>({ key: 'push.enabled', default: true, ...flagCodec(true) });

export const loadPushEnabled = (): Promise<boolean> => store.load();

export const isPushEnabledSync = (): boolean => store.get();

export const setPushEnabled = (enabled: boolean): Promise<void> => store.setAsync(enabled);

export const usePushEnabled = (): boolean => store.use();
