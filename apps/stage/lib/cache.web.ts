import { PersistentStore as SharedStore, type PersistenceBackend } from './cache.shared';

const DB_NAME = 'stage-cache';
const DB_VERSION = 1;
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const scope = globalThis as { indexedDB?: IDBFactory };
      if (!scope.indexedDB) { resolve(null); return; }
      const req = scope.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => { resolve(req.result); };
      req.onerror = () => { resolve(null); };
      req.onblocked = () => { resolve(null); };
    } catch { resolve(null); }
  });
  return dbPromise;
}

async function idbRead<T>(key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise<T | null>((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => { resolve((req.result as T | undefined) ?? null); };
      req.onerror = () => { resolve(null); };
    } catch { resolve(null); }
  });
}

async function idbWrite(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
    if (value === null) store.delete(key); else store.put(value, key);
  } catch { }
}

const idbBackend: PersistenceBackend = {
  read: idbRead,
  write(name: string, value: unknown): void { void idbWrite(name, value); },
  onFlushSignal(flushAll: () => void): void {
    if (typeof window !== 'undefined') window.addEventListener('pagehide', flushAll);
  },
};

export class PersistentStore<T> extends SharedStore<T> {
  constructor(fileName: string, debounced = false) { super(idbBackend, fileName, debounced); }
}

export { MemoryStore, getSecure, setSecure } from './cache.shared';
