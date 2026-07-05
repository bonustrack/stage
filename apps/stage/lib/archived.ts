import { createArchivedStore } from '@stage-labs/client/xmtp/archived';
import { appStorage } from '../platform/storage';

const store = createArchivedStore({
  get: (key: string): Promise<string | null> => appStorage.get(key),
  set: (key: string, value: string): Promise<void> => appStorage.set(key, value),
  remove: (key: string): Promise<void> => appStorage.delete(key),
}, 'channels.archived');

export const loadArchivedIds = (): Promise<Set<string>> => store.load();

export const isArchived = (convId: string): boolean => store.has(convId);

export const toggleArchived = (convId: string): Promise<Set<string>> => store.toggle(convId);

export const subscribeArchived = (cb: () => void): (() => void) => store.subscribe(cb);
