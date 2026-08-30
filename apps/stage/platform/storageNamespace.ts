export const STORAGE_NAMESPACE = 'stage.';

export interface WebStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export function namespacedKey(key: string): string {
  return STORAGE_NAMESPACE + key;
}

export function adoptLegacyKey(store: WebStorageLike, key: string): void {
  const legacy = store.getItem(key);
  if (legacy === null) return;
  const scoped = namespacedKey(key);
  if (store.getItem(scoped) === null) store.setItem(scoped, legacy);
  store.removeItem(key);
}

export function readNamespaced(store: WebStorageLike, key: string): string | null {
  adoptLegacyKey(store, key);
  return store.getItem(namespacedKey(key));
}

export function removeNamespaced(store: WebStorageLike, key: string): void {
  store.removeItem(namespacedKey(key));
  store.removeItem(key);
}
