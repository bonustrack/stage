


import { createSetStore } from './persistedStore';

const store = createSetStore('channels.archived');

export const loadArchivedIds = (): Promise<Set<string>> => store.load();

export const isArchived = (convId: string): boolean => store.has(convId);

export const toggleArchived = (convId: string): Promise<Set<string>> => store.toggle(convId);

export const subscribeArchived = (cb: () => void): () => void => store.subscribe(cb);
