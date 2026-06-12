/** Unified client/cache persistence layer. The app's caches sit on three small
 *  primitives defined here:
 *    - `PersistentStore<T>`  in-memory value mirrored to a JSON file in the app
 *                            document dir, with pub/sub + lazy hydration.
 *    - `MemoryStore<K,V>`    in-memory Map (no disk) with pub/sub, for session
 *                            caches that don't need to survive a reload.
 *    - SecureStore helpers   `getSecure / setSecure` for small string keys that
 *                            must live in the device keystore. */

import { AppState } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

/** Trailing flush window for debounced PersistentStores. A streamed message can
 *  fire set() many times a second with a 100s-of-KB payload; coalescing the
 *  SYNCHRONOUS disk write to one pass per window keeps the JS thread free. */
const FLUSH_DEBOUNCE_MS = 1_500;

/** Every debounced store with a pending in-memory change, so a single AppState
 *  background/inactive transition can flush them ALL synchronously (nothing is
 *  lost on kill). WeakRef-free on purpose: stores are app-lived singletons. */
const dirtyStores = new Set<{ flushNow: () => void }>();
let appStateFlushWired = false;
function wireAppStateFlush(): void {
  if (appStateFlushWired) return;
  appStateFlushWired = true;
  /** On the way to background/inactive, flush every dirty debounced store NOW so
   *  a process kill can't drop the last in-memory writes. */
  AppState.addEventListener('change', (state) => {
    if (state === 'active') return;
    for (const s of dirtyStores) { try { s.flushNow(); } catch { /* best-effort */ } }
  });
}

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
  /** In-flight hydration promise, memoized so concurrent boot callers await the
   *  SAME disk read instead of racing. Previously `hydrated` flipped true before
   *  `await f.text()` resolved, so a second caller arriving mid-read returned a
   *  still-null value. Set on the first call, cleared once the read settles (and
   *  on clear()). */
  private hydrating: Promise<T | null> | null = null;
  private readonly listeners = new Set<(v: T | null) => void>();
  /** Pending trailing-flush timer (debounced stores only). `number` RN timer id
   *  — the Railgun SDK pulls @types/node in, whose Timeout collides with DOM. */
  private flushTimer: number | null = null;
  /** True when in-memory `value` differs from what's on disk (a debounced set()
   *  ran but the flush hasn't landed yet). */
  private dirty = false;

  /** @param fileName  JSON file under the metro document dir.
   *  @param debounced When true, set() updates memory + notifies subscribers
   *    immediately but defers the SYNCHRONOUS disk write to a trailing timer
   *    (and an AppState background flush), instead of writing on every call.
   *    Opt-in so other stores keep their write-through behaviour. */
  constructor(private readonly fileName: string, private readonly debounced = false) {
    if (debounced) wireAppStateFlush();
  }

  private file(): File { return new File(metroDir(), this.fileName); }

  /** Write the current in-memory value to disk synchronously (or delete the file
   *  when null). Clears the dirty flag + dirty-set membership. */
  private writeToDisk(): void {
    try {
      const f = this.file();
      if (this.value === null) { if (f.exists) f.delete(); }
      else f.write(JSON.stringify(this.value));
    } catch { /* best-effort */ }
    this.dirty = false;
    dirtyStores.delete(this);
  }

  /** Flush any pending debounced write immediately (timer + AppState background).
   *  No-op when nothing is pending. */
  flushNow(): void {
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
    if (this.dirty) this.writeToDisk();
  }

  /** Read the persisted value off disk into memory once. Idempotent; the file
   *  read only happens on the first call. Subsequent calls return the cached
   *  in-memory value synchronously after the await resolves. */
  async hydrate(): Promise<T | null> {
    if (this.hydrated) return this.value;
    // A concurrent caller is already reading disk — await the SAME read so we
    // don't return a half-populated value or kick off a second read.
    if (this.hydrating) return this.hydrating;
    this.hydrating = (async (): Promise<T | null> => {
      try {
        const f = this.file();
        if (f.exists) {
          const parsed = JSON.parse(await f.text()) as T;
          this.value = parsed;
          for (const l of this.listeners) l(this.value);
        }
      } catch { /* corrupted cache — next set() overwrites it */ }
      // Mark hydrated only AFTER the read resolves, so the synchronous fast path
      // above can never observe `hydrated === true` with a stale/null value.
      this.hydrated = true;
      this.hydrating = null;
      return this.value;
    })();
    return this.hydrating;
  }

  get(): T | null { return this.value; }

  set(next: T | null): void {
    this.value = next;
    /** Notify subscribers immediately so the UI reflects the change without
     *  waiting on disk. */
    for (const l of this.listeners) l(this.value);
    if (!this.debounced) { this.writeToDisk(); return; }
    /** Debounced: mark dirty + (re)arm the trailing flush. A burst of streamed
     *  set()s collapses to ONE synchronous write per FLUSH_DEBOUNCE_MS; the
     *  AppState background handler flushes early so a kill loses nothing. */
    this.dirty = true;
    dirtyStores.add(this);
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.writeToDisk();
    }, FLUSH_DEBOUNCE_MS) as unknown as number;
  }

  /** Clear in-memory + on-disk and reset hydration so a fresh account hydrates
   *  from a clean slate. */
  clear(): void {
    /** Cancel any pending debounced flush so it can't resurrect the file we're
     *  about to delete. */
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
    this.dirty = false;
    dirtyStores.delete(this);
    this.value = null;
    this.hydrated = false;
    // Drop any in-flight hydration so a new account re-reads from a clean slate.
    this.hydrating = null;
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
  /** Global listeners notified for ANY key's change. The feed→TanStack-Query
   *  bridge uses this to mirror every feedCache slice write into the shared
   *  query cache without wrapping each individual `set` call site. */
  private readonly global = new Set<(key: K, v: V | undefined) => void>();

  get(key: K): V | undefined { return this.map.get(key); }
  has(key: K): boolean { return this.map.has(key); }

  set(key: K, value: V): void {
    this.map.set(key, value);
    const ls = this.keyed.get(key);
    if (ls) for (const l of ls) l(value);
    for (const l of this.global) l(key, value);
  }

  /** Subscribe to changes for ANY key. Returns an unsubscribe fn. */
  subscribeAll(l: (key: K, v: V | undefined) => void): () => void {
    this.global.add(l);
    return () => { this.global.delete(l); };
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
    const keys = new Set<K>([...this.keyed.keys(), ...this.map.keys()]);
    this.map.clear();
    for (const k of keys) {
      const ls = this.keyed.get(k);
      if (ls) for (const l of ls) l(undefined);
      for (const l of this.global) l(k, undefined);
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
