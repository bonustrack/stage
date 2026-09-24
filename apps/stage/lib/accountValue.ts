import { appStorage } from '../platform/storage';
import { getActiveAccount } from './accounts';
import { subscribeAccountEpoch } from './accountEpoch';
import { reported } from './errorPolicy';

export interface AccountValue<T> {
  ready: () => Promise<void>;
  get: () => T;
  update: (next: (current: T) => T) => Promise<void>;
}

export function makeAccountValue<T>(
  keyPrefix: string, empty: T, parse: (raw: string) => T, serialize: (value: T) => string,
): AccountValue<T> {
  let accountId: string | null = null;
  let value = empty;
  let loaded = false;
  let loading: Promise<void> | null = null;

  async function load(): Promise<void> {
    const id = (await getActiveAccount())?.id ?? null;
    if (loaded && id === accountId) return;
    const raw = id === null ? null : await appStorage.get(keyPrefix + id);
    accountId = id;
    value = raw === null ? empty : parse(raw);
    loaded = true;
  }

  function reload(): Promise<void> {
    loading ??= load().finally(() => { loading = null; });
    return loading;
  }

  subscribeAccountEpoch(() => { void reload().catch(reported(`${keyPrefix}load`)); });

  return {
    ready: () => (loaded ? Promise.resolve() : reload()),
    get: () => value,
    update: async (next) => {
      await reload();
      const updated = next(value);
      if (updated === value) return;
      value = updated;
      if (accountId !== null) {
        await appStorage.set(keyPrefix + accountId, serialize(updated)).catch(reported(`${keyPrefix}save`));
      }
    },
  };
}
