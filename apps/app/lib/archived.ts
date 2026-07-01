import AsyncStorage from '@react-native-async-storage/async-storage';
import { createArchivedStore } from '@stage-labs/client/xmtp/archived';

const store = createArchivedStore({
  get: (key: string): Promise<string | null> => AsyncStorage.getItem(key),
  set: (key: string, value: string): Promise<void> => AsyncStorage.setItem(key, value),
  remove: (key: string): Promise<void> => AsyncStorage.removeItem(key),
}, 'channels.archived');

export const loadArchivedIds = (): Promise<Set<string>> => store.load();

export const isArchived = (convId: string): boolean => store.has(convId);

export const toggleArchived = (convId: string): Promise<Set<string>> => store.toggle(convId);

export const subscribeArchived = (cb: () => void): (() => void) => store.subscribe(cb);
