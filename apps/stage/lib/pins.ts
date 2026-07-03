

import { createSetStore } from './persistedStore';

const store = createSetStore('channels.pinned');

export const loadPinnedIds = (): Promise<Set<string>> => store.load();

export const isPinned = (convId: string): boolean => store.has(convId);

export const togglePin = (convId: string): Promise<Set<string>> => store.toggle(convId);

export const subscribePins = (cb: () => void): () => void => store.subscribe(cb);
