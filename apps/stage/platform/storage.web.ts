import type { AppStorage, SecureStorage } from './types';
import {
  adoptLegacyKey, namespacedKey, readNamespaced, removeNamespaced,
  type WebStorageLike,
} from './storageNamespace';

const SECURE_PREFIX = 'secure.';
let legacySecureAdopted = false;

function adoptLegacySecureKeys(store: WebStorageLike): void {
  if (legacySecureAdopted) return;
  legacySecureAdopted = true;
  for (const key of Object.keys(store)) {
    if (key.startsWith(SECURE_PREFIX)) adoptLegacyKey(store, key);
  }
}

function webStorage(): WebStorageLike | null {
  const scope = globalThis as { localStorage?: WebStorageLike };
  if (typeof scope.localStorage === 'undefined') return null;
  adoptLegacySecureKeys(scope.localStorage);
  return scope.localStorage;
}

function readKey(key: string): string | null {
  const store = webStorage();
  return store ? readNamespaced(store, key) : null;
}

function writeKey(key: string, value: string): void {
  webStorage()?.setItem(namespacedKey(key), value);
}

function deleteKey(key: string): void {
  const store = webStorage();
  if (store) removeNamespaced(store, key);
}

export const secureStorage: SecureStorage = {
  get: (key) => Promise.resolve(readKey(SECURE_PREFIX + key)),
  set: (key, value) => {
    writeKey(SECURE_PREFIX + key, value);
    return Promise.resolve();
  },
  delete: (key) => {
    deleteKey(SECURE_PREFIX + key);
    return Promise.resolve();
  },
  subscribe: (keys, listener) => {
    const watched = new Set(keys.map((key) => namespacedKey(SECURE_PREFIX + key)));
    const changed = (event: StorageEvent): void => {
      if (event.storageArea === localStorage && (event.key === null || watched.has(event.key))) listener();
    };
    window.addEventListener('storage', changed);
    return () => { window.removeEventListener('storage', changed); };
  },
};

export const appStorage: AppStorage = {
  get: (key) => Promise.resolve(readKey(key)),
  set: (key, value) => {
    writeKey(key, value);
    return Promise.resolve();
  },
  delete: (key) => {
    deleteKey(key);
    return Promise.resolve();
  },
};
