
import { AppState } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { hydrateOnce, makeListeners } from './storeCore';

const FLUSH_DEBOUNCE_MS = 1_500;

const dirtyStores = new Set<{ flushNow: () => void }>();
let appStateFlushWired = false;
function wireAppStateFlush(): void {
  if (appStateFlushWired) return;
  appStateFlushWired = true;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') return;
    for (const s of dirtyStores) { try { s.flushNow(); } catch { } }
  });
}

function metroDir(): Directory {
  const dir = new Directory(Paths.document, 'metro');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
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
    if (debounced) wireAppStateFlush();
  }

  private file(): File { return new File(metroDir(), this.fileName); }

  private writeToDisk(): void {
    try {
      const f = this.file();
      if (this.value === null) { if (f.exists) f.delete(); }
      else f.write(JSON.stringify(this.value));
    } catch { }
    this.dirty = false;
    dirtyStores.delete(this);
  }

  flushNow(): void {
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
    if (this.dirty) this.writeToDisk();
  }

  private async readDisk(): Promise<T | null> {
    try {
      const f = this.file();
      if (f.exists) {
        const parsed = JSON.parse(await f.text()) as T;
        this.value = parsed;
        this.notify(this.value);
      }
    } catch { }
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
    try { const f = this.file(); if (f.exists) f.delete(); } catch { }
    this.notify(null);
  }

  subscribe(l: (v: T | null) => void): () => void {
    this.listeners.add(l);
    return () => { this.listeners.delete(l); };
  }
}

export class MemoryStore<K, V> {
  private readonly map = new Map<K, V>();
  private readonly keyed = new Map<K, Set<(v: V | undefined) => void>>();
  private readonly global = new Set<(key: K, v: V | undefined) => void>();

  get(key: K): V | undefined { return this.map.get(key); }
  has(key: K): boolean { return this.map.has(key); }

  set(key: K, value: V): void {
    this.map.set(key, value);
    const ls = this.keyed.get(key);
    if (ls) for (const l of ls) l(value);
    for (const l of this.global) l(key, value);
  }

  subscribeAll(l: (key: K, v: V | undefined) => void): () => void {
    this.global.add(l);
    return () => { this.global.delete(l); };
  }

  subscribe(key: K, l: (v: V | undefined) => void): () => void {
    let ls = this.keyed.get(key);
    if (!ls) { ls = new Set(); this.keyed.set(key, ls); }
    ls.add(l);
    return () => { ls.delete(l); };
  }

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

export async function getSecure(key: string): Promise<string | null> {
  try { return await SecureStore.getItemAsync(key); } catch { return null; }
}
export async function setSecure(key: string, value: string): Promise<void> {
  try { await SecureStore.setItemAsync(key, value); } catch { }
}
