import { secureStorage } from '../platform/storage';
import { persistenceBackend } from './cache';
import { hydrateOnce, makeListeners } from './storeCore';
import { report, attempt } from './errorPolicy';

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
  for (const s of dirtyStores) attempt(() => { s.flushNow(); }, 'cache');
}

export class PersistentStore<T> {
  private value: T | null = null;
  private readonly hydration = hydrateOnce<T | null>(() => this.readBacking());
  private readonly pubsub = makeListeners<T | null>();
  private notify(v: T | null): void { this.pubsub.notify(v); }
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;

  constructor(
    private readonly fileName: string,
    private readonly flushDelayMs = FLUSH_DEBOUNCE_MS,
  ) {
    if (!flushSignalWired) {
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
    this.dirty = true;
    dirtyStores.add(this);
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.writeBacking();
    }, this.flushDelayMs);
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

export async function getSecure(key: string): Promise<string | null> {
  try { return await secureStorage.get(key); } catch { return null; }
}
export async function setSecure(key: string, value: string): Promise<void> {
  try {
    await secureStorage.set(key, value);
  } catch (err) {
    report('storage.setSecure', err);
  }
}
