import type { AppStorage, SecureStorage } from './types';

const SECURE_PREFIX = 'secure.';

interface WebStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

function webStorage(): WebStorageLike | null {
  const scope = globalThis as { localStorage?: WebStorageLike };
  return typeof scope.localStorage === 'undefined' ? null : scope.localStorage;
}

export const secureStorage: SecureStorage = {
  get: (key) => Promise.resolve(webStorage()?.getItem(SECURE_PREFIX + key) ?? null),
  set: (key, value) => {
    webStorage()?.setItem(SECURE_PREFIX + key, value);
    return Promise.resolve();
  },
  delete: (key) => {
    webStorage()?.removeItem(SECURE_PREFIX + key);
    return Promise.resolve();
  },
};

export const appStorage: AppStorage = {
  get: (key) => Promise.resolve(webStorage()?.getItem(key) ?? null),
  set: (key, value) => {
    webStorage()?.setItem(key, value);
    return Promise.resolve();
  },
  delete: (key) => {
    webStorage()?.removeItem(key);
    return Promise.resolve();
  },
  multiGet: (keys) => {
    const store = webStorage();
    return Promise.resolve(keys.map((key) => [key, store?.getItem(key) ?? null] as const));
  },
  clear: () => {
    webStorage()?.clear();
    return Promise.resolve();
  },
};
