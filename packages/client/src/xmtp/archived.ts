import type { KeyValueStore } from '../accounts/store';

export const DEFAULT_ARCHIVED_KEY = 'channels.archived';

function parseIds(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((x): x is string => typeof x === 'string'));
    }
  } catch {
    return new Set();
  }
  return new Set();
}

export interface ArchivedStore {
  load(): Promise<Set<string>>;
  has(id: string): boolean;
  get(): Set<string>;
  toggle(id: string): Promise<Set<string>>;
  subscribe(cb: () => void): () => void;
}

export function createArchivedStore(
  storage: KeyValueStore,
  key: string = DEFAULT_ARCHIVED_KEY,
): ArchivedStore {
  let cache = new Set<string>();
  let hydrated = false;
  let inFlight: Promise<Set<string>> | null = null;
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const cb of listeners) {
      try { cb(); } catch { }
    }
  }

  async function persist(): Promise<void> {
    try { await storage.set(key, JSON.stringify([...cache])); }
    catch { }
  }

  function hydrate(): Promise<Set<string>> {
    if (inFlight) return inFlight;
    inFlight = (async (): Promise<Set<string>> => {
      try {
        const raw = await storage.get(key);
        cache = parseIds(raw);
      } catch {
        cache = new Set();
      } finally {
        hydrated = true;
        inFlight = null;
      }
      return cache;
    })();
    return inFlight;
  }

  async function load(): Promise<Set<string>> {
    if (hydrated) return cache;
    return hydrate();
  }

  function has(id: string): boolean { return cache.has(id); }
  function get(): Set<string> { return cache; }

  async function toggle(id: string): Promise<Set<string>> {
    if (!hydrated) await load();
    const next = new Set(cache);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    cache = next;
    hydrated = true;
    notify();
    await persist();
    return cache;
  }

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }

  return { load, has, get, toggle, subscribe };
}

export interface SyncKeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface SyncArchivedStore {
  read(): Set<string>;
  loadCopy(): Set<string>;
  has(id: string): boolean;
  toggle(id: string): Set<string>;
  subscribe(cb: () => void): () => void;
}

export function createSyncArchivedStore(
  storage: SyncKeyValueStore,
  key: string = DEFAULT_ARCHIVED_KEY,
): SyncArchivedStore {
  let cache: Set<string> | null = null;
  const listeners = new Set<() => void>();

  function read(): Set<string> {
    if (cache) return cache;
    try { cache = parseIds(storage.get(key)); }
    catch { cache = new Set(); }
    return cache;
  }

  function write(next: Set<string>): void {
    cache = next;
    try { storage.set(key, JSON.stringify([...next])); }
    catch { }
    for (const cb of listeners) cb();
  }

  function loadCopy(): Set<string> { return new Set(read()); }
  function has(id: string): boolean { return read().has(id); }

  function toggle(id: string): Set<string> {
    const next = new Set(read());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    write(next);
    return new Set(next);
  }

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }

  return { read, loadCopy, has, toggle, subscribe };
}
