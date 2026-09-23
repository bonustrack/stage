import { secureStorage } from '../platform/storage';
import { persistenceBackend } from './cache';
import { hydrateOnce, makeListeners } from './storeCore';

const FLUSH_DEBOUNCE_MS = 1_500;

interface PersistenceBackend {
  read<T>(name: string): Promise<T | null>;
  write(name: string, value: unknown): void;
  onFlushSignal(flushAll: () => void): void;
}

const backend: PersistenceBackend = persistenceBackend;

const dirtyStores = new Set<{ flushNow: () => void }>();
let flushSignalWired = false;

function flushDirtyStores(): void {
  for (const s of dirtyStores) { try { s.flushNow(); } catch { } }
}

export class PersistentStore<T> {
  private value: T | null = null;
  private readonly hydration = hydrateOnce<T | null>(() => this.readBacking());
  private readonly pubsub = makeListeners<T | null>();
  private notify(v: T | null): void { this.pubsub.notify(v); }
  private flushTimer: number | null = null;
  private dirty = false;

  constructor(
    private readonly fileName: string,
    private readonly debounced = false,
    private readonly flushDelayMs = FLUSH_DEBOUNCE_MS,
  ) {
    if (debounced && !flushSignalWired) {
      flushSignalWired = true;
      backend.onFlushSignal(flushDirtyStores);
    }
  }

  private writeBacking(): void {
    backend.write(this.fileName, this.value);
    this.dirty = false;
    dirtyStores.delete(this);
  }

  flushNow(): void {
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
    if (this.dirty) this.writeBacking();
  }

  private async readBacking(): Promise<T | null> {
    const stored = await backend.read<T>(this.fileName);
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
    if (!this.debounced) { this.writeBacking(); return; }
    this.dirty = true;
    dirtyStores.add(this);
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.writeBacking();
    }, this.flushDelayMs) as unknown as number;
  }

  clear(): void {
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
    this.dirty = false;
    dirtyStores.delete(this);
    this.value = null;
    this.hydration.reset();
    backend.write(this.fileName, null);
    this.notify(null);
  }

  subscribe(l: (v: T | null) => void): () => void {
    return this.pubsub.subscribe(l);
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
  try { return await secureStorage.get(key); } catch { return null; }
}
export async function setSecure(key: string, value: string): Promise<void> {
  try { await secureStorage.set(key, value); } catch { }
}
