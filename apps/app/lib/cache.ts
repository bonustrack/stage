/** Unified client/cache persistence layer. The app's caches sit on three small
 *  primitives defined here:
 *    - `PersistentStore<T>`  in-memory value mirrored to a JSON file in the app
 *                            document dir, with pub/sub + lazy hydration.
 *    - `MemoryStore<K,V>`    in-memory Map (no disk) with pub/sub, for session
 *                            caches that don't need to survive a reload.
 *    - SecureStore helpers   `getSecure / setSecure` for small string keys that
 *                            must live in the device keystore. */

import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

/** Shared document-dir folder for every JSON-file-backed store. */
function metroDir(): Directory {
  const dir = new Directory(Paths.document, 'metro');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** A single value persisted to one JSON file, mirrored in memory, with
 *  listeners. Used by the channels-list cache. Generic over the stored shape. */
export class PersistentStore<T> {
  private value: T | null = null;
  private hydrated = false;
  private readonly listeners = new Set<(v: T | null) => void>();

  constructor(private readonly fileName: string) {}

  private file(): File { return new File(metroDir(), this.fileName); }

  /** Read the persisted value off disk into memory once. Idempotent; the file
   *  read only happens on the first call. Subsequent calls return the cached
   *  in-memory value synchronously after the await resolves. */
  async hydrate(): Promise<T | null> {
    if (this.hydrated) return this.value;
    this.hydrated = true;
    try {
      const f = this.file();
      if (!f.exists) return this.value;
      const parsed = JSON.parse(await f.text()) as T;
      this.value = parsed;
      for (const l of this.listeners) l(this.value);
    } catch { /* corrupted cache — next set() overwrites it */ }
    return this.value;
  }

  get(): T | null { return this.value; }

  set(next: T | null): void {
    this.value = next;
    try {
      const f = this.file();
      if (next === null) { if (f.exists) f.delete(); }
      else f.write(JSON.stringify(next));
    } catch { /* best-effort */ }
    for (const l of this.listeners) l(this.value);
  }

  /** Clear in-memory + on-disk and reset hydration so a fresh account hydrates
   *  from a clean slate. */
  clear(): void {
    this.value = null;
    this.hydrated = false;
    try { const f = this.file(); if (f.exists) f.delete(); } catch { /* best-effort */ }
    for (const l of this.listeners) l(null);
  }

  subscribe(l: (v: T | null) => void): () => void {
    this.listeners.add(l);
    return () => { this.listeners.delete(l); };
  }
}

/** An in-memory keyed cache with pub/sub. Used by the per-conversation message
 *  cache + the inbox→eth cache: session-lived, never persisted, but they share
 *  the same get/set/subscribe/clear surface so callers don't re-implement it. */
export class MemoryStore<K, V> {
  private readonly map = new Map<K, V>();
  /** Keyed listeners (notified for a specific key's changes) + global listeners
   *  (notified for any change). */
  private readonly keyed = new Map<K, Set<(v: V | undefined) => void>>();

  get(key: K): V | undefined { return this.map.get(key); }
  has(key: K): boolean { return this.map.has(key); }

  set(key: K, value: V): void {
    this.map.set(key, value);
    const ls = this.keyed.get(key);
    if (ls) for (const l of ls) l(value);
  }

  /** Subscribe to changes for one key. Returns an unsubscribe fn. */
  subscribe(key: K, l: (v: V | undefined) => void): () => void {
    let ls = this.keyed.get(key);
    if (!ls) { ls = new Set(); this.keyed.set(key, ls); }
    ls.add(l);
    return () => { ls!.delete(l); };
  }

  /** Wipe everything (e.g. on account switch) + notify all keyed listeners. */
  clear(): void {
    const keys = [...this.keyed.keys()];
    this.map.clear();
    for (const k of keys) {
      const ls = this.keyed.get(k);
      if (ls) for (const l of ls) l(undefined);
    }
  }
}

/** SecureStore keys must match `[A-Za-z0-9._-]+` — colons are rejected on
 *  Android. Callers are responsible for sanitising any dynamic segment. */
export async function getSecure(key: string): Promise<string | null> {
  try { return await SecureStore.getItemAsync(key); } catch { return null; }
}
export async function setSecure(key: string, value: string): Promise<void> {
  try { await SecureStore.setItemAsync(key, value); } catch { /* best-effort */ }
}
