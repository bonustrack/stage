
import { appStorage } from '../platform/storage';
import type { AppStorage } from '../platform/types';
import { hydrateOnce, makeListeners, useStoreValue } from './storeCore';
import { report, reported } from './errorPolicy';

export interface ValueStoreOptions<T> {
  key: string;
  default: T;
  serialize?: (value: T) => string;
  deserialize: (raw: string) => T | undefined;
  storage?: Pick<AppStorage, 'get' | 'set'>;
}

export interface ValueStore<T> {
  load: () => Promise<T>;
  loadAsync: () => void;
  get: () => T;
  set: (value: T) => void;
  setAsync: (value: T) => Promise<void>;
  subscribe: (cb: () => void) => () => void;
  use: () => T;
}

export function createValueStore<T>(opts: ValueStoreOptions<T>): ValueStore<T> {
  const serialize = opts.serialize ?? ((v: T): string => String(v));
  const storage = opts.storage ?? appStorage;
  let cache: T = opts.default;
  const { notify, subscribe } = makeListeners();

  function apply(raw: string | null): boolean {
    if (raw == null) return false;
    const parsed = opts.deserialize(raw);
    if (parsed === undefined) return false;
    cache = parsed;
    return true;
  }

  const hydration = hydrateOnce(async (): Promise<boolean> => {
    try {
      return apply(await storage.get(opts.key));
    } catch (err) {
      report(`store.${opts.key}`, err);
      return false;
    }
  });

  function persist(): void {
    void storage.set(opts.key, serialize(cache)).catch(reported(`store.${opts.key}`));
  }

  async function load(): Promise<T> {
    if (!hydration.done()) await hydration.run();
    return cache;
  }

  function loadAsync(): void {
    if (hydration.done()) return;
    void hydration.run().then((changed) => { if (changed) notify(); });
  }

  function get(): T { return cache; }

  function commit(value: T): void {
    cache = value;
    hydration.markDone();
    notify();
  }

  function set(value: T): void {
    if (value === cache) return;
    commit(value);
    persist();
  }

  async function setAsync(value: T): Promise<void> {
    commit(value);
    await storage.set(opts.key, serialize(cache)).catch(reported(`store.${opts.key}`));
  }

  const use = (): T => useStoreValue(subscribe, get, loadAsync);

  return { load, loadAsync, get, set, setAsync, subscribe, use };
}
