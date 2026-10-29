import { appStorage } from '../platform/storage';
import type { AppStorage } from '../platform/types';
import { getActiveAccount } from './accounts';
import { getAccountEpoch, subscribeAccountEpoch } from './accountEpoch';
import { hydrateOnce, makeListeners, useStoreValue } from './storeCore';
import { report, reported } from './errorPolicy';

export interface ValueStoreOptions<T> {
  key: string;
  default: T;
  serialize?: (value: T) => string;
  deserialize: (raw: string) => T | undefined;
  storage?: Pick<AppStorage, 'get' | 'set'>;
  perAccount?: boolean;
  durable?: boolean;
  restore?: (local: T, stored: T) => T;
}

export interface ValueStore<T> {
  load: () => Promise<T>;
  loadAsync: () => void;
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

type StoreStorage = Pick<AppStorage, 'get' | 'set'>;

interface StoreState<T> {
  cache: T;
  accountId: string | null | undefined;
  accountEpoch: number | undefined;
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

function parseRaw<T>(opts: ValueStoreOptions<T>, raw: string | null): T | undefined {
  return raw == null ? undefined : opts.deserialize(raw);
}

function applyRaw<T>(opts: ValueStoreOptions<T>, state: StoreState<T>, raw: string | null): boolean {
  const parsed = parseRaw(opts, raw);
  if (parsed === undefined) return false;
  state.cache = opts.restore ? opts.restore(state.cache, parsed) : parsed;
  return true;
}

async function readStored<T>(
  opts: ValueStoreOptions<T>,
  storage: StoreStorage,
  state: StoreState<T>,
  ready: () => Promise<void>,
): Promise<boolean> {
  if (!opts.perAccount) return applyRaw(opts, state, await storage.get(opts.key));
  const epoch = getAccountEpoch();
  const id = (await getActiveAccount())?.id ?? null;
  if (id === state.accountId) {
    const changed = state.accountEpoch !== epoch;
    state.accountEpoch = epoch;
    return changed;
  }
  await ready();
  const raw = id === null ? null : await storage.get(opts.key + id);
  if (epoch !== getAccountEpoch()) return readStored(opts, storage, state, ready);
  if (!opts.restore || state.accountId !== undefined) state.cache = opts.default;
  state.accountId = id;
  state.accountEpoch = epoch;
  applyRaw(opts, state, raw);
  return true;
}

function storeHydration<T>(opts: ValueStoreOptions<T>, storage: StoreStorage, state: StoreState<T>, ready: () => Promise<void>) {
  const read = (): Promise<boolean> => readStored(opts, storage, state, ready);
  return hydrateOnce(async (): Promise<boolean> => {
    if (opts.perAccount) return read();
    try {
      return await read();
    } catch (err) {
      report(`store.${opts.key}`, err);
      return false;
    }
  });
}

export function createValueStore<T>(opts: ValueStoreOptions<T>): ValueStore<T> {
  const serialize = opts.serialize ?? ((v: T): string => String(v));
  const storage = opts.storage ?? appStorage;
  const state: StoreState<T> = { cache: opts.default, accountId: undefined, accountEpoch: undefined };
  const { notify, subscribe } = makeListeners();
  const durable = durableWriter(
    storedFor,
    (id, value) => storage.set(opts.key + id, serialize(value)),
    (id, value) => {
      if (id === state.accountId && serialize(state.cache) !== serialize(value)) commit(value);
    },
  );
  const hydration = storeHydration(opts, storage, state, () => durable.ready());

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
    return storage.set(key, serialize(state.cache)).catch(reported(`store.${opts.key}`));
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
    return parseRaw(opts, await storage.get(opts.key + id)) ?? opts.default;
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
    if (value !== stored) await storage.set(opts.key + id, serialize(value));
  }

  if (opts.perAccount)
    subscribeAccountEpoch(() => {
      void reload().catch(reported(`store.${opts.key}`));
    });

  const use = (): T => useStoreValue(subscribe, get, loadAsync);

  return {
    load,
    loadAsync,
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
