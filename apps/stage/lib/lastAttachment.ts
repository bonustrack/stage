
import { createValueStore } from './persistedStore';

const KEY = 'composer:lastAttachment';

const store = createValueStore<string | undefined>({
  key: KEY,
  default: undefined,
  serialize: (v) => v ?? '',
  deserialize: (raw) => raw,
});

export const setLastAttachment = (label: string): void => { store.set(label); };

export const useLastAttachment = (): string | undefined => store.use();
