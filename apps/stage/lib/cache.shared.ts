import { secureStorage } from '../platform/storage';
import { persistenceBackend } from './cache';
import { makeListeners } from './storeCore';
import { report, attempt } from './errorPolicy';
import { writeBehind, type WriteBehind } from './writeBehind';

const FLUSH_DEBOUNCE_MS = 1_500;

interface PersistenceBackend {
  read(name: string): Promise<unknown>;
  write(name: string, value: unknown): void;
  onFlushSignal(flushAll: () => void): void;
}

const backend: PersistenceBackend = persistenceBackend;

const stores = new Set<{ flushNow: () => void }>();
let flushSignalWired = false;

function wireFlushSignal(): void {
  if (flushSignalWired) return;
  flushSignalWired = true;
  backend.onFlushSignal(() => {
    for (const store of stores)
      attempt(() => {
        store.flushNow();
      }, 'cache');
  });
}

type Edit<T> = (current: T | null) => T | null;

export interface PersistentStoreOptions<T> {
  parse: (stored: unknown) => T | null;
  flushDelayMs?: number;
  restore?: (value: T) => Promise<T>;
}

export class PersistentStore<T> {
  private value: T | null = null;
  private hydrated = false;
  private reading: Promise<T | null> | null = null;
  private edits: Edit<T>[] = [];
  private readonly pubsub = makeListeners<T | null>();
  private readonly writes: WriteBehind<T | null>;

  constructor(
    private readonly fileName: string,
    private readonly options: PersistentStoreOptions<T>,
  ) {
    this.writes = writeBehind<T | null>({ delayMs: options.flushDelayMs ?? FLUSH_DEBOUNCE_MS }, (name, value) => {
      backend.write(name, value);
    });
    stores.add(this);
    wireFlushSignal();
  }

  flushNow(): void {
    this.writes.flush(this.fileName);
  }

  private async readStored(): Promise<T | null> {
    const raw = await backend.read(this.fileName);
    const parsed = raw === null ? null : this.options.parse(raw);
    return parsed !== null && this.options.restore ? this.options.restore(parsed) : parsed;
  }

  private async readBacking(): Promise<T | null> {
    let stored: T | null;
    try {
      stored = await this.readStored();
    } catch (err) {
      report(`cache.read.${this.fileName}`, err);
      return this.value;
    }
    if (this.hydrated) return this.value;
    const edits = this.edits;
    this.edits = [];
    this.hydrated = true;
    if (stored === null && edits.length === 0) return this.value;
    this.value = edits.reduce<T | null>((current, edit) => edit(current), stored);
    this.pubsub.notify(this.value);
    if (edits.length > 0) this.writes.set(this.fileName, this.value);
    return this.value;
  }

  hydrate(): Promise<T | null> {
    if (this.hydrated) return Promise.resolve(this.value);
    this.reading ??= this.readBacking().finally(() => {
      this.reading = null;
    });
    return this.reading;
  }

  get(): T | null {
    return this.value;
  }

  set(next: T | null): void {
    this.value = next;
    this.hydrated = true;
    this.edits = [];
    this.pubsub.notify(next);
    this.writes.set(this.fileName, next);
  }

  update(edit: Edit<T>): void {
    if (this.hydrated) {
      this.set(edit(this.value));
      return;
    }
    this.value = edit(this.value);
    this.edits.push(edit);
    this.pubsub.notify(this.value);
    void this.hydrate();
  }

  subscribe(l: (v: T | null) => void): () => void {
    return this.pubsub.subscribe(l);
  }
}

export async function getSecure(key: string): Promise<string | null> {
  try {
    return await secureStorage.get(key);
  } catch {
    return null;
  }
}
export async function setSecure(key: string, value: string): Promise<void> {
  try {
    await secureStorage.set(key, value);
  } catch (err) {
    report('storage.setSecure', err);
  }
}
