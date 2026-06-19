/** @file Device-local persisted store (built on lib/persistedStore) of the user's most-recently-used composer attachment label, for a quick-access shortcut beside the composer "+" menu. */

import { createValueStore } from './persistedStore';

const KEY = 'composer:lastAttachment';

const store = createValueStore<string | undefined>({
  key: KEY,
  default: undefined,
  serialize: (v) => v ?? '',
  deserialize: (raw) => raw,
});

/** Kick off the one-time load from storage; notify subscribers when it lands. */
export const loadLastAttachment = (): void => { store.loadAsync(); };

/** Synchronous snapshot, undefined until the first pick / load resolves. */
export const getLastAttachment = (): string | undefined => store.get();

/** Record a label as last-used and persist it (best-effort). Notifies subscribers. */
export const setLastAttachment = (label: string): void => { store.set(label); };

/** Subscribe to changes (load + picks). Returns an unsubscribe fn. */
export const subscribeLastAttachment = (fn: () => void): () => void => store.subscribe(fn);
