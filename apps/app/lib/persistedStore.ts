/** @file Generic AsyncStorage-backed store factories (`createSetStore`, `createValueStore`) providing the shared load/save/subscribe/hydrate boilerplate for the small device-local preference stores. */

/*
 * Generic persisted-store factories - the shared load/save/subscribe/hydrate
 *  boilerplate that the small device-local preference stores (pins, archived,
 *  notifReadState, pushPref, lastAttachment, …) all hand-rolled near-identically.
 *
 *  Two factories cover the two real shapes in lib/:
 *
 *   - `createSetStore`   - a `Set<string>` persisted as a JSON array to
 *     AsyncStorage (pins / archived / notifReadState). Async one-time load,
 *     synchronous membership reads from an in-memory mirror, dependency-free
 *     pub/sub so consumers repaint the instant the set changes.
 *
 *   - `createValueStore` - a single value of type `T` mirrored in memory and
 *     persisted to AsyncStorage with caller-supplied serialize/deserialize
 *     (pushPref boolean, lastAttachment string, …). Load can be awaited
 *     (async) or fire-and-forget (sync style) per the caller.
 *
 *  Each store exposes the same low-level surface the originals used internally
 *  (load / get / set / subscribe + a `notify`/listeners-equivalent), and the
 *  per-store modules re-export their EXACT historical public API as thin
 *  wrappers so every consumer stays untouched. Storage keys, defaults, and
 *  serialization are passed in verbatim so previously-persisted data keeps
 *  loading after the update.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { hydrateOnce, makeListeners } from './storeCore';

export interface SetStore {
  /** Read the persisted set once and cache it; later calls return the cache without touching storage. Corrupt/missing → empty set. */
  load: () => Promise<Set<string>>;
  /** Synchronous membership check from the in-memory mirror (false until load). */
  has: (id: string) => boolean;
  /** Synchronous snapshot of the in-memory set. */
  get: () => Set<string>;
  /** Replace the set with `next`, persist, notify, and return the new set. */
  set: (next: Set<string>) => Promise<Set<string>>;
  /** Flip one id's membership, persist, notify, and return the new set. */
  toggle: (id: string) => Promise<Set<string>>;
  /** Subscribe to changes. Returns an unsubscribe fn. */
  subscribe: (cb: () => void) => () => void;
}

/** Build a `Set<string>` store persisted as a JSON string array under `key`. */
export function createSetStore(key: string): SetStore {
  let cache = new Set<string>();
  const { listeners, notify } = makeListeners();
  const hydration = hydrateOnce(async (): Promise<Set<string>> => {
    try {
      const raw = await AsyncStorage.getItem(key);
      const ids: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(ids)) cache = new Set(ids.filter((x): x is string => typeof x === 'string'));
    } catch { /* corrupt/missing → start empty */ }
    return cache;
  });

  /** Persist helper. */
  async function persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify([...cache]));
    } catch { /* best-effort - the in-memory cache still reflects the change */ }
  }

  /** Load helper. */
  async function load(): Promise<Set<string>> {
    if (hydration.done()) return cache;
    return hydration.run();
  }

  /** Has helper. */
  function has(id: string): boolean { return cache.has(id); }
  /** Get helper. */
  function get(): Set<string> { return cache; }

  /** Set helper. */
  async function set(next: Set<string>): Promise<Set<string>> {
    cache = next;
    hydration.markDone();
    notify();
    await persist();
    return cache;
  }

  /** Toggle helper. */
  async function toggle(id: string): Promise<Set<string>> {
    const next = new Set(cache);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return set(next);
  }

  /** Subscribe helper. */
  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }

  return { load, has, get, set, toggle, subscribe };
}

export interface ValueStoreOptions<T> {
  /** AsyncStorage key (kept verbatim per store so old data still loads). */
  key: string;
  /** Effective value before/while load runs and the fallback for empty/corrupt. */
  default: T;
  /** Serialize a value to the stored string. Default: `String(value)`. */
  serialize?: (value: T) => string;
  /** Parse a stored string back to a value; return `undefined` to keep the current value (e.g. unrecognised/corrupt input). */
  deserialize: (raw: string) => T | undefined;
  /** When false (default), `set` short-circuits if the value is `===` the current one. Set true to always notify + persist (matching stores whose historical setter fired on every call). */
  alwaysNotify?: boolean;
}

export interface ValueStore<T> {
  /** Await the one-time load and get the resulting value (async consumers). */
  load: () => Promise<T>;
  /** Fire-and-forget the one-time load; notifies subscribers when it lands (sync-style consumers that read via `get` on the next render). */
  loadAsync: () => void;
  /** Synchronous snapshot of the in-memory value. */
  get: () => T;
  /** Replace the value, persist, and notify (no-op if unchanged by `===`, unless `alwaysNotify`). Fire-and-forget persistence. */
  set: (value: T) => void;
  /** Like `set` but awaits the AsyncStorage write (for callers whose historical setter returned a Promise). Always notifies + persists. */
  setAsync: (value: T) => Promise<void>;
  /** Subscribe to changes. Returns an unsubscribe fn. */
  subscribe: (cb: () => void) => () => void;
}

/** Build a single-value store mirrored in memory + persisted to AsyncStorage. */
export function createValueStore<T>(opts: ValueStoreOptions<T>): ValueStore<T> {
  const serialize = opts.serialize ?? ((v: T): string => String(v));
  let cache: T = opts.default;
  const { listeners, notify } = makeListeners();

  /** Apply helper. */
  function apply(raw: string | null): boolean {
    if (raw == null) return false;
    const parsed = opts.deserialize(raw);
    if (parsed === undefined) return false;
    cache = parsed;
    return true;
  }

  /** Read once; returns true when it changed `cache` (so loadAsync can notify). */
  const hydration = hydrateOnce(async (): Promise<boolean> => {
    try { return apply(await AsyncStorage.getItem(opts.key)); }
    catch { return false; /* best-effort → keep default */ }
  });

  /** Persist helper. */
  function persist(): void {
    void AsyncStorage.setItem(opts.key, serialize(cache)).catch(() => { /* best-effort */ });
  }

  /** Load helper. */
  async function load(): Promise<T> {
    if (!hydration.done()) await hydration.run();
    return cache;
  }

  /** Load the persisted value asynchronously. */
  function loadAsync(): void {
    if (hydration.done()) return;
    void hydration.run().then((changed) => { if (changed) notify(); });
  }

  /** Get helper. */
  function get(): T { return cache; }

  /** Set helper. */
  function set(value: T): void {
    if (!opts.alwaysNotify && value === cache) return;
    cache = value;
    hydration.markDone();
    notify();
    persist();
  }

  /** Set the persisted value asynchronously. */
  async function setAsync(value: T): Promise<void> {
    cache = value;
    hydration.markDone();
    notify();
    try { await AsyncStorage.setItem(opts.key, serialize(cache)); }
    catch { /* best-effort, the in-memory cache still reflects the change */ }
  }

  /** Subscribe helper. */
  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }

  return { load, loadAsync, get, set, setAsync, subscribe };
}
