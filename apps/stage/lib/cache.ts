
import { AppState } from 'react-native';
import { File } from 'expo-file-system';
import { appDocumentsDir } from './appDocuments';
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

export class PersistentStore<T> {
  private value: T | null = null;
  private readonly hydration = hydrateOnce<T | null>(() => this.readDisk());
  private readonly pubsub = makeListeners<T | null>();
  private notify(v: T | null): void { this.pubsub.notify(v); }
  private flushTimer: number | null = null;
  private dirty = false;

  constructor(private readonly fileName: string, private readonly debounced = false) {
    if (debounced) wireAppStateFlush();
  }

  private file(): File { return new File(appDocumentsDir(), this.fileName); }

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
    return this.pubsub.subscribe(l);
  }
}

export { MemoryStore, getSecure, setSecure } from './cache.shared';
