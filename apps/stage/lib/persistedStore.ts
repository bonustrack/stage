import { appStorage } from '../platform/storage';
import type { AppStorage } from '../platform/types';
import { getAccountEpoch, subscribeAccountEpoch } from './accountEpoch';
import { readActiveAccountId } from './accountSelection';
import { hydrateOnce, jsonWith, makeListeners, useStoreValue, type StoredSchema } from './storeCore';
import { report, reported } from './errorPolicy';

type StoreStorage = Pick<AppStorage, 'get' | 'set' | 'getSync'>;

interface StoreOptions<T> {
  key: string;
  default: T;
  storage?: StoreStorage;
  perAccount?: boolean;
  durable?: boolean;
  restore?: (local: T, stored: T) => T;
  readNow?: boolean;
}

interface JsonStoreOptions<T> extends StoreOptions<T> {
  schema: StoredSchema<T>;
  serialize?: never;
  deserialize?: never;
}

interface RawStoreOptions<T> extends StoreOptions<T> {
  schema?: never;
  serialize?: (value: T) => string;
  deserialize: (raw: string) => T | undefined;
}

export type ValueStoreOptions<T> = JsonStoreOptions<T> | RawStoreOptions<T>;

export interface ValueStore<T> {
  load: () => Promise<T>;
  loadAsync: () => void;
  reload: () => Promise<T>;
  get: () => T;
  set: (value: T) => void;
  setAsync: (value: T) => Promise<void>;
  update: (next: (current: T) => T, onlyFor?: string) => Promise<void>;
  loadFor: (accountId: string) => Promise<T>;
  updateFor: (accountId: string, next: (current: T) => T) => Promise<void>;
  accountId: () => string | null;
  isCurrentAccount: () => boolean;
  subscribe: (cb: () => void) => () => void;
  use: () => T;
}

interface StoreCodec<T> {
  parse: (raw: string) => T | undefined;
  serialize: (value: T) => string;
}

interface StoreState<T> {
  cache: T;
  accountId: string | null | undefined;
  accountEpoch: number | undefined;
}

function codecOf<T>(opts: ValueStoreOptions<T>): StoreCodec<T> {
  if (opts.schema) return { parse: jsonWith(opts.schema), serialize: JSON.stringify };
  return { parse: opts.deserialize, serialize: opts.serialize ?? ((v: T): string => String(v)) };
}

function durableWriter<T>(
  read: (id: string) => Promise<T>,
  write: (id: string, value: T) => Promise<void>,
  publish: (id: string, value: T) => void,
) {
  let pending = Promise.resolve();
  return {
    ready: () => pending,
    update: (id: string, next: (current: T) => T): Promise<void> => {
      const result = pending.then(async () => {
        const stored = await read(id);
        const value = next(stored);
        if (value !== stored) await write(id, value);
        publish(id, value);
      });
      pending = result.catch(reported('store.durable'));
      return result;
    },
  };
}

function parseRaw<T>(codec: StoreCodec<T>, raw: string | null): T | undefined {
  return raw == null ? undefined : codec.parse(raw);
}

function applyRaw<T>(opts: ValueStoreOptions<T>, codec: StoreCodec<T>, state: StoreState<T>, raw: string | null): boolean {
  const parsed = parseRaw(codec, raw);
  if (parsed === undefined) return false;
  state.cache = opts.restore ? opts.restore(state.cache, parsed) : parsed;
  return true;
}

interface StoreReader<T> {
  opts: ValueStoreOptions<T>;
  codec: StoreCodec<T>;
  storage: StoreStorage;
  state: StoreState<T>;
  ready: () => Promise<void>;
}

async function readStored<T>(reader: StoreReader<T>): Promise<boolean> {
  const { opts, codec, storage, state } = reader;
  if (!opts.perAccount) return applyRaw(opts, codec, state, await storage.get(opts.key));
  const epoch = getAccountEpoch();
  const id = await readActiveAccountId();
  if (id === state.accountId) {
    const changed = state.accountEpoch !== epoch;
    state.accountEpoch = epoch;
    return changed;
  }
  await reader.ready();
  const raw = id === null ? null : await storage.get(opts.key + id);
  if (epoch !== getAccountEpoch()) return readStored(reader);
  if (!opts.restore || state.accountId !== undefined) state.cache = opts.default;
  state.accountId = id;
  state.accountEpoch = epoch;
  applyRaw(opts, codec, state, raw);
  return true;
}

function storeHydration<T>(reader: StoreReader<T>) {
  const { opts } = reader;
  return hydrateOnce(async (): Promise<boolean> => {
    if (opts.perAccount) return readStored(reader);
    try {
      return await readStored(reader);
    } catch (err) {
      report(`store.${opts.key}`, err);
      return false;
    }
  });
}

function readNow<T>(reader: StoreReader<T>): boolean {
  const { opts, storage } = reader;
  if (!opts.readNow || opts.perAccount || !storage.getSync) return false;
  applyRaw(opts, reader.codec, reader.state, storage.getSync(opts.key));
  return true;
}

export function createValueStore<T>(opts: ValueStoreOptions<T>): ValueStore<T> {
  const codec = codecOf(opts);
  const storage = opts.storage ?? appStorage;
  const state: StoreState<T> = { cache: opts.default, accountId: undefined, accountEpoch: undefined };
  const { notify, subscribe } = makeListeners();
  const durable = durableWriter(
    storedFor,
    (id, value) => storage.set(opts.key + id, codec.serialize(value)),
    (id, value) => {
      if (id === state.accountId && codec.serialize(state.cache) !== codec.serialize(value)) commit(value);
    },
  );
  const reader: StoreReader<T> = { opts, codec, storage, state, ready: () => durable.ready() };
  const hydration = storeHydration(reader);
  if (readNow(reader)) hydration.markDone();

  function storageKey(): string | null {
    return opts.perAccount ? (typeof state.accountId === 'string' ? opts.key + state.accountId : null) : opts.key;
  }

  async function reload(): Promise<T> {
    if (await hydration.run()) notify();
    return state.cache;
  }

  async function load(): Promise<T> {
    if (opts.perAccount ? state.accountId !== undefined : hydration.done()) return state.cache;
    if (opts.perAccount) return reload();
    await hydration.run();
    return state.cache;
  }

  function loadAsync(): void {
    if (opts.perAccount ? state.accountId !== undefined : hydration.done()) return;
    void reload().catch(reported(`store.${opts.key}`));
  }

  function get(): T {
    return state.cache;
  }

  function commit(value: T): void {
    state.cache = value;
    hydration.markDone();
    notify();
  }

  function write(): Promise<void> {
    const key = storageKey();
    if (key === null) return Promise.resolve();
    return storage.set(key, codec.serialize(state.cache)).catch(reported(`store.${opts.key}`));
  }

  function set(value: T): void {
    if (value === state.cache) return;
    commit(value);
    void write();
  }

  async function setAsync(value: T): Promise<void> {
    commit(value);
    await write();
  }

  async function change(next: (current: T) => T): Promise<void> {
    const value = next(state.cache);
    if (value !== state.cache) await setAsync(value);
  }

  async function update(next: (current: T) => T, onlyFor?: string): Promise<void> {
    await (opts.perAccount ? reload() : load());
    if (onlyFor === undefined || onlyFor === state.accountId) await change(next);
  }

  async function storedFor(id: string): Promise<T> {
    return parseRaw(codec, await storage.get(opts.key + id)) ?? opts.default;
  }

  async function loadFor(id: string): Promise<T> {
    await load();
    await durable.ready();
    return id === state.accountId ? state.cache : storedFor(id);
  }

  async function updateFor(id: string, next: (current: T) => T): Promise<void> {
    await reload();
    if (opts.durable) return durable.update(id, next);
    if (id === state.accountId) return change(next);
    const stored = await storedFor(id);
    const value = next(stored);
    if (value !== stored) await storage.set(opts.key + id, codec.serialize(value));
  }

  if (opts.perAccount)
    subscribeAccountEpoch(() => {
      void reload().catch(reported(`store.${opts.key}`));
    });

  const use = (): T => useStoreValue(subscribe, get, loadAsync);

  return {
    load,
    loadAsync,
    reload,
    get,
    set,
    setAsync,
    update,
    loadFor,
    updateFor,
    accountId: () => state.accountId ?? null,
    isCurrentAccount: () => !opts.perAccount || state.accountEpoch === getAccountEpoch(),
    subscribe,
    use,
  };
}
