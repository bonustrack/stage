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
  subscribe: (cb: () => void) => () => void;
  use: () => T;
}

function durableWriter<T>(
  read: (id: string) => Promise<T>, write: (id: string, value: T) => Promise<void>, publish: (id: string, value: T) => void,
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

export function createValueStore<T>(opts: ValueStoreOptions<T>): ValueStore<T> {
  const serialize = opts.serialize ?? ((v: T): string => String(v));
  const storage = opts.storage ?? appStorage;
  let cache: T = opts.default;
  let accountId: string | null | undefined;
  const { notify, subscribe } = makeListeners();
  const durable = durableWriter(storedFor, (id, value) => storage.set(opts.key + id, serialize(value)), (id, value) => {
    if (id === accountId && serialize(cache) !== serialize(value)) commit(value);
  });

  function storageKey(): string | null { return opts.perAccount ? (typeof accountId === 'string' ? opts.key + accountId : null) : opts.key; }

  function parse(raw: string | null): T | undefined {
    return raw == null ? undefined : opts.deserialize(raw);
  }

  function apply(raw: string | null): boolean {
    const parsed = parse(raw);
    if (parsed === undefined) return false;
    cache = opts.restore ? opts.restore(cache, parsed) : parsed;
    return true;
  }

  async function read(): Promise<boolean> {
    if (!opts.perAccount) return apply(await storage.get(opts.key));
    const epoch = getAccountEpoch();
    const id = (await getActiveAccount())?.id ?? null;
    if (id === accountId) return false;
    await durable.ready();
    const raw = id === null ? null : await storage.get(opts.key + id);
    if (epoch !== getAccountEpoch()) return read();
    if (!opts.restore || accountId !== undefined) cache = opts.default;
    accountId = id;
    apply(raw);
    return true;
  }

  const hydration = hydrateOnce(async (): Promise<boolean> => {
    if (opts.perAccount) return read();
    try {
      return await read();
    } catch (err) {
      report(`store.${opts.key}`, err);
      return false;
    }
  });

  async function reload(): Promise<T> {
    if (await hydration.run()) notify();
    return cache;
  }

  async function load(): Promise<T> {
    if (opts.perAccount ? accountId !== undefined : hydration.done()) return cache;
    if (opts.perAccount) return reload();
    await hydration.run();
    return cache;
  }

  function loadAsync(): void {
    if (opts.perAccount ? accountId !== undefined : hydration.done()) return;
    void reload().catch(reported(`store.${opts.key}`));
  }

  function get(): T { return cache; }

  function commit(value: T): void {
    cache = value;
    hydration.markDone();
    notify();
  }

  function write(): Promise<void> {
    const key = storageKey();
    if (key === null) return Promise.resolve();
    return storage.set(key, serialize(cache)).catch(reported(`store.${opts.key}`));
  }

  function set(value: T): void {
    if (value === cache) return;
    commit(value);
    void write();
  }

  async function setAsync(value: T): Promise<void> { commit(value); await write(); }

  async function change(next: (current: T) => T): Promise<void> {
    const value = next(cache);
    if (value !== cache) await setAsync(value);
  }

  async function update(next: (current: T) => T, onlyFor?: string): Promise<void> {
    await (opts.perAccount ? reload() : load());
    if (onlyFor === undefined || onlyFor === accountId) await change(next);
  }

  async function storedFor(id: string): Promise<T> { return parse(await storage.get(opts.key + id)) ?? opts.default; }

  async function loadFor(id: string): Promise<T> {
    await load();
    await durable.ready();
    return id === accountId ? cache : storedFor(id);
  }

  async function updateFor(id: string, next: (current: T) => T): Promise<void> {
    await reload();
    if (opts.durable) return durable.update(id, next);
    if (id === accountId) return change(next);
    const stored = await storedFor(id);
    const value = next(stored);
    if (value !== stored) await storage.set(opts.key + id, serialize(value));
  }

  if (opts.perAccount) subscribeAccountEpoch(() => { void reload().catch(reported(`store.${opts.key}`)); });

  const use = (): T => useStoreValue(subscribe, get, loadAsync);

  return { load, loadAsync, get, set, setAsync, update, loadFor, updateFor, accountId: () => accountId ?? null, subscribe, use };
}
