import { hydrateOnce, makeListeners } from './storeCore';
import { secureStorage } from '../platform/storage';

const FLUSH_DEBOUNCE_MS = 1_500;
const DB_NAME = 'stage-cache';
const DB_VERSION = 1;
const STORE = 'kv';

const dirtyStores = new Set<{ flushNow: () => void }>();
let unloadFlushWired = false;
let dbPromise: Promise<IDBDatabase | null> | null = null;

function wireUnloadFlush(): void {
  if (unloadFlushWired || typeof window === 'undefined') return;
  unloadFlushWired = true;
  window.addEventListener('pagehide', () => {
    for (const s of dirtyStores) { try { s.flushNow(); } catch { } }
  });
}

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

export class PersistentStore<T> {
  private value: T | null = null;
  private readonly hydration = hydrateOnce<T | null>(() => this.readDisk());
  private readonly pubsub = makeListeners<T | null>();
  private get listeners(): Set<(v: T | null) => void> { return this.pubsub.listeners; }
  private notify(v: T | null): void { this.pubsub.notify(v); }
  private flushTimer: number | null = null;
  private dirty = false;

  constructor(private readonly fileName: string, private readonly debounced = false) {
    if (debounced) wireUnloadFlush();
  }

  private writeToDisk(): void {
    void idbWrite(this.fileName, this.value);
    this.dirty = false;
    dirtyStores.delete(this);
  }

  flushNow(): void {
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
    if (this.dirty) this.writeToDisk();
  }

  private async readDisk(): Promise<T | null> {
    const stored = await idbRead<T>(this.fileName);
    if (stored !== null) {
      this.value = stored;
      this.notify(this.value);
    }
    return this.value;
  }

  async hydrate(): Promise<T | null> {
    if (this.hydration.done()) return this.value;
    return this.hydration.run();
  }

  get(): T | null { return this.value; }

  set(next: T | null): void {
    this.value = next;
    this.hydration.markDone();
    this.notify(this.value);
    if (!this.debounced) { this.writeToDisk(); return; }
    this.dirty = true;
    dirtyStores.add(this);
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.writeToDisk();
    }, FLUSH_DEBOUNCE_MS) as unknown as number;
  }

  clear(): void {
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
    this.dirty = false;
    dirtyStores.delete(this);
    this.value = null;
    this.hydration.reset();
    void idbWrite(this.fileName, null);
    this.notify(null);
  }

  subscribe(l: (v: T | null) => void): () => void {
    this.listeners.add(l);
    return () => { this.listeners.delete(l); };
  }
}

export { MemoryStore } from './cache.shared';

export async function getSecure(key: string): Promise<string | null> {
  try { return await secureStorage.get(key); } catch { return null; }
}
export async function setSecure(key: string, value: string): Promise<void> {
  try { await secureStorage.set(key, value); } catch { }
}
