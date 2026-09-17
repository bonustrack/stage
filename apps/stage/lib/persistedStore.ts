
import { appStorage } from '../platform/storage';
import { hydrateOnce, makeListeners } from './storeCore';

export interface ValueStoreOptions<T> {
  key: string;
  default: T;
  serialize?: (value: T) => string;
  deserialize: (raw: string) => T | undefined;
  alwaysNotify?: boolean;
}

export interface ValueStore<T> {
  load: () => Promise<T>;
  loadAsync: () => void;
  get: () => T;
  set: (value: T) => void;
  setAsync: (value: T) => Promise<void>;
  subscribe: (cb: () => void) => () => void;
}

export function createValueStore<T>(opts: ValueStoreOptions<T>): ValueStore<T> {
  const serialize = opts.serialize ?? ((v: T): string => String(v));
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
    try { return apply(await appStorage.get(opts.key)); }
    catch { return false; }
  });

  function persist(): void {
    void appStorage.set(opts.key, serialize(cache)).catch(() => undefined);
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

  function set(value: T): void {
    if (!opts.alwaysNotify && value === cache) return;
    cache = value;
    hydration.markDone();
    notify();
    persist();
  }

  async function setAsync(value: T): Promise<void> {
    cache = value;
    hydration.markDone();
    notify();
    try { await appStorage.set(opts.key, serialize(cache)); }
    catch { }
  }

  return { load, loadAsync, get, set, setAsync, subscribe };
}
