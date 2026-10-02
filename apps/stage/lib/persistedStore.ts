import { appStorage } from '../platform/storage';
import type { AppStorage } from '../platform/types';
import { getActiveAccount } from './accounts';
import { subscribeAccountEpoch } from './accountEpoch';
import { hydrateOnce, makeListeners, useStoreValue } from './storeCore';
import { report, reported } from './errorPolicy';

export interface ValueStoreOptions<T> {
  key: string;
  default: T;
  serialize?: (value: T) => string;
  deserialize: (raw: string) => T | undefined;
  storage?: Pick<AppStorage, 'get' | 'set'>;
  perAccount?: boolean;
}

export interface ValueStore<T> {
  load: () => Promise<T>;
  loadAsync: () => void;
  get: () => T;
  set: (value: T) => void;
  setAsync: (value: T) => Promise<void>;
  update: (next: (current: T) => T, onlyFor?: string) => Promise<void>;
  accountId: () => string | null;
  subscribe: (cb: () => void) => () => void;
  use: () => T;
}

export function createValueStore<T>(opts: ValueStoreOptions<T>): ValueStore<T> {
  const serialize = opts.serialize ?? ((v: T): string => String(v));
  const storage = opts.storage ?? appStorage;
  let cache: T = opts.default;
  let accountId: string | null | undefined;
  const { notify, subscribe } = makeListeners();

  function storageKey(): string | null {
    if (!opts.perAccount) return opts.key;
    return typeof accountId === 'string' ? opts.key + accountId : null;
  }

  function apply(raw: string | null): boolean {
    if (raw == null) return false;
    const parsed = opts.deserialize(raw);
    if (parsed === undefined) return false;
    cache = parsed;
    return true;
  }

  async function read(): Promise<boolean> {
    if (!opts.perAccount) return apply(await storage.get(opts.key));
    const id = (await getActiveAccount())?.id ?? null;
    if (id === accountId) return false;
    const raw = id === null ? null : await storage.get(opts.key + id);
    accountId = id;
    cache = opts.default;
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

  async function setAsync(value: T): Promise<void> {
    commit(value);
    await write();
  }

  async function update(next: (current: T) => T, onlyFor?: string): Promise<void> {
    await (opts.perAccount ? reload() : load());
    if (onlyFor !== undefined && onlyFor !== accountId) return;
    const value = next(cache);
    if (value !== cache) await setAsync(value);
  }

  if (opts.perAccount) subscribeAccountEpoch(() => { void reload().catch(reported(`store.${opts.key}`)); });

  const use = (): T => useStoreValue(subscribe, get, loadAsync);

  return { load, loadAsync, get, set, setAsync, update, accountId: () => accountId ?? null, subscribe, use };
}
