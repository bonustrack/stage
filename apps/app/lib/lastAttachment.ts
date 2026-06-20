
import { createValueStore } from './persistedStore';

const KEY = 'composer:lastAttachment';

const store = createValueStore<string | undefined>({
  key: KEY,
  default: undefined,
  serialize: (v) => v ?? '',
  deserialize: (raw) => raw,
});

export const loadLastAttachment = (): void => { store.loadAsync(); };

export const getLastAttachment = (): string | undefined => store.get();

export const setLastAttachment = (label: string): void => { store.set(label); };

export const subscribeLastAttachment = (fn: () => void): () => void => store.subscribe(fn);
