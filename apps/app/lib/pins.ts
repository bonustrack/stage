/** @file Device-only pinned-channel store (AsyncStorage set) so the channels list can float pinned conversations to the top, with pub/sub for instant re-render. */

/** Device-only pinned channels persisted as an AsyncStorage set (no cross-device sync) with dependency-free pub/sub, built on the shared lib/persistedStore.ts set-store factory. */

import { createSetStore } from './persistedStore';

const store = createSetStore('channels.pinned');

/** Read the persisted set once and cache it. Subsequent calls return the cached set without touching storage. */
export const loadPinnedIds = (): Promise<Set<string>> => store.load();

/** Synchronous membership check from the in-memory cache. Returns false until `loadPinnedIds` has run. */
export const isPinned = (convId: string): boolean => store.has(convId);

/** Flip a conv's pinned membership, persist, update the cache, notify subscribers, and return the new set. */
export const togglePin = (convId: string): Promise<Set<string>> => store.toggle(convId);

/** Subscribe to pin changes. Returns an unsubscribe fn. */
export const subscribePins = (cb: () => void): () => void => store.subscribe(cb);
