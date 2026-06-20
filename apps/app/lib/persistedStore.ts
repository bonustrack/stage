
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hydrateOnce, makeListeners } from './storeCore';

export interface SetStore {
  load: () => Promise<Set<string>>;
  has: (id: string) => boolean;
  get: () => Set<string>;
  set: (next: Set<string>) => Promise<Set<string>>;
  toggle: (id: string) => Promise<Set<string>>;
  subscribe: (cb: () => void) => () => void;
}

export function createSetStore(key: string): SetStore {
  let cache = new Set<string>();
  const { listeners, notify } = makeListeners();
  const hydration = hydrateOnce(async (): Promise<Set<string>> => {
    try {
      const raw = await AsyncStorage.getItem(key);
      const ids: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(ids)) cache = new Set(ids.filter((x): x is string => typeof x === 'string'));
    } catch { }
    return cache;
  });

  async function persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify([...cache]));
    } catch { }
  }

  async function load(): Promise<Set<string>> {
    if (hydration.done()) return cache;
    return hydration.run();
  }

  function has(id: string): boolean { return cache.has(id); }
  function get(): Set<string> { return cache; }

  async function set(next: Set<string>): Promise<Set<string>> {
    cache = next;
    hydration.markDone();
    notify();
    await persist();
    return cache;
  }

  async function toggle(id: string): Promise<Set<string>> {
    const next = new Set(cache);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return set(next);
  }

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }

  return { load, has, get, set, toggle, subscribe };
}

export interface ValueStoreOptions<T> {
  key: string;
  default: T;
  serialize?: (value: T) => string;
  deserialize: (raw: string) => T | undefined;
  alwaysNotify?: boolean;
}

export interface ValueStore<T> {
  load: () => Promise<T>;
  loadAsync: () => void;
  get: () => T;
  set: (value: T) => void;
  setAsync: (value: T) => Promise<void>;
  subscribe: (cb: () => void) => () => void;
}

export function createValueStore<T>(opts: ValueStoreOptions<T>): ValueStore<T> {
  const serialize = opts.serialize ?? ((v: T): string => String(v));
  let cache: T = opts.default;
  const { listeners, notify } = makeListeners();

  function apply(raw: string | null): boolean {
    if (raw == null) return false;
    const parsed = opts.deserialize(raw);
    if (parsed === undefined) return false;
    cache = parsed;
    return true;
  }

  const hydration = hydrateOnce(async (): Promise<boolean> => {
    try { return apply(await AsyncStorage.getItem(opts.key)); }
    catch { return false; }
  });

  function persist(): void {
    void AsyncStorage.setItem(opts.key, serialize(cache)).catch(() => undefined);
  }

  async function load(): Promise<T> {
    if (!hydration.done()) await hydration.run();
    return cache;
  }

  function loadAsync(): void {
    if (hydration.done()) return;
    void hydration.run().then((changed) => { if (changed) notify(); });
  }

  function get(): T { return cache; }

  function set(value: T): void {
    if (!opts.alwaysNotify && value === cache) return;
    cache = value;
    hydration.markDone();
    notify();
    persist();
  }

  async function setAsync(value: T): Promise<void> {
    cache = value;
    hydration.markDone();
    notify();
    try { await AsyncStorage.setItem(opts.key, serialize(cache)); }
    catch { }
  }

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }

  return { load, loadAsync, get, set, setAsync, subscribe };
}
