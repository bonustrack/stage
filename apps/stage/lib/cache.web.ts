import { attempt, recover, reported } from './errorPolicy';
const DB_NAME = 'stage-cache';
const DB_VERSION = 1;
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const scope = globalThis as { indexedDB?: IDBFactory };
      if (!scope.indexedDB) {
        resolve(null);
        return;
      }
      const req = scope.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => {
        resolve(req.result);
      };
      req.onerror = () => {
        resolve(null);
      };
      req.onblocked = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function idbRead<T>(key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise<T | null>((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => {
        resolve((req.result as T | undefined) ?? null);
      };
      req.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

async function idbWrite(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  if (!db) return;
  attempt(() => {
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
    if (value === null) store.delete(key);
    else store.put(value, key);
  }, 'cache');
}

export const persistenceBackend = {
  read: idbRead,
  write(name: string, value: unknown): void {
    void idbWrite(name, value);
  },
  onFlushSignal(flushAll: () => void): void {
    if (typeof window !== 'undefined') window.addEventListener('pagehide', flushAll);
  },
};

const SEAL_KEY_NAME = 'sealed.key';
const SEAL_IV_BYTES = 12;

interface Sealed {
  iv: Uint8Array<ArrayBuffer>;
  data: ArrayBuffer;
}

async function loadSealKey(): Promise<CryptoKey | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const stored = await idbRead<CryptoKey>(SEAL_KEY_NAME);
  if (stored) return stored;
  const fresh = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const db = await openDb();
  if (!db) return null;
  return new Promise<CryptoKey>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.get(SEAL_KEY_NAME);
    let key = fresh;
    req.onsuccess = () => {
      if (req.result) key = req.result as CryptoKey;
      else store.put(fresh, SEAL_KEY_NAME);
    };
    tx.oncomplete = () => {
      resolve(key);
    };
    tx.onabort = () => {
      reject(tx.error ?? new Error('Could not save cache key'));
    };
  });
}

let sealKey: Promise<CryptoKey | null> | null = null;

function currentSealKey(): Promise<CryptoKey | null> {
  sealKey ??= loadSealKey().catch(recover('cache.sealKey', null));
  return sealKey;
}

async function openSealed(key: CryptoKey, sealed: Sealed, name: string): Promise<string | null> {
  try {
    const additionalData = new TextEncoder().encode(name);
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv, additionalData }, key, sealed.data));
  } catch {
    return null;
  }
}

async function sealedRead(name: string): Promise<string | null> {
  const key = await currentSealKey();
  const sealed = key ? await idbRead<Sealed>(name) : null;
  return key && sealed ? openSealed(key, sealed, name) : null;
}

async function sealedWrite(name: string, text: string | null): Promise<void> {
  if (text === null) {
    await idbWrite(name, null);
    return;
  }
  const key = await currentSealKey();
  if (!key) return;
  const iv = crypto.getRandomValues(new Uint8Array(SEAL_IV_BYTES));
  const additionalData = new TextEncoder().encode(name);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData }, key, new TextEncoder().encode(text));
  await idbWrite(name, { iv, data } satisfies Sealed);
}

export const sealedCache = { read: sealedRead, write: sealedWrite };

export interface RecordStore {
  read(name: string): Promise<string | null>;
  write(name: string, text: () => string | Promise<string>): void;
  remove(name: string): Promise<void>;
}

const RECORD_WRITE_DELAY_MS = 1_000;

export function createRecordStore(writeErrorTag: string): RecordStore {
  const texts = new Map<string, () => string | Promise<string>>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let queue: Promise<void> = Promise.resolve();
  function queued(task: () => Promise<void>): Promise<void> {
    const run = queue.then(task);
    queue = run.catch(reported(writeErrorTag));
    return queue;
  }
  function writeNow(name: string): void {
    clearTimeout(timers.get(name));
    timers.delete(name);
    const text = texts.get(name);
    texts.delete(name);
    if (text !== undefined) void queued(async () => sealedWrite(name, await text()));
  }
  persistenceBackend.onFlushSignal(() => {
    for (const name of [...timers.keys()]) writeNow(name);
  });
  return {
    read: sealedRead,
    write(name, text) {
      texts.set(name, text);
      if (timers.has(name)) return;
      timers.set(
        name,
        setTimeout(() => {
          writeNow(name);
        }, RECORD_WRITE_DELAY_MS),
      );
    },
    remove(name) {
      clearTimeout(timers.get(name));
      timers.delete(name);
      texts.delete(name);
      return queued(() => sealedWrite(name, null));
    },
  };
}
