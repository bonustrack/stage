import { createValueStore, type ValueStore, type ValueStoreOptions } from '../persistedStore';
import { makeListeners, useStoreValue } from '../storeCore';

export interface SettingChange<T> {
  accountId: string;
  state: T;
}

export interface SyncedSetting<T> {
  onLocalChange: (cb: (change: SettingChange<T>) => void) => () => void;
  load: (accountId: string) => Promise<T | null>;
  applyRemote: (accountId: string, incoming: T) => Promise<void>;
}

export function settingChanges<T>(): { notify: (change: SettingChange<T>) => void; subscribe: SyncedSetting<T>['onLocalChange'] } {
  const changes = makeListeners<SettingChange<T>>();
  return { notify: changes.notify, subscribe: changes.subscribe };
}

interface SettingPolicy<T> {
  receive: (current: T, incoming: T, accountId: string) => T;
  synced?: (state: T) => T;
}

type Edited<T> = (accountId: string, previous: T, next: T) => void;

export interface Setting<T> {
  prefs: ValueStore<T>;
  sync: SyncedSetting<T>;
  edit: (next: (current: T) => T, edited?: Edited<T>) => void;
  editStored: (next: (current: T) => T, announce?: boolean) => Promise<void>;
  changedLocally: (accountId: string, state: T) => void;
  loaded: () => boolean;
  useLoaded: () => boolean;
}

function makeSetting<T>(store: ValueStoreOptions<T>, policy: SettingPolicy<T>, isSet: (state: T) => boolean): Setting<T> {
  const prefs = createValueStore(store);
  const changes = settingChanges<T>();
  const synced = policy.synced ?? ((state: T): T => state);
  const loaded = (): boolean => prefs.accountId() !== null;
  const changedLocally = (accountId: string, state: T): void => {
    changes.notify({ accountId, state: synced(state) });
  };
  return {
    prefs,
    sync: {
      onLocalChange: changes.subscribe,
      load: async (accountId) => {
        const state = await prefs.loadFor(accountId);
        return isSet(state) ? synced(state) : null;
      },
      applyRemote: (accountId, incoming) => prefs.updateFor(accountId, (current) => policy.receive(current, incoming, accountId)),
    },
    edit(next, edited) {
      const accountId = prefs.accountId();
      if (accountId === null && store.restore === undefined) return;
      const previous = prefs.get();
      const value = next(previous);
      if (value === previous) return;
      prefs.set(value);
      if (accountId === null) return;
      edited?.(accountId, previous, value);
      changedLocally(accountId, value);
    },
    async editStored(next, announce = true) {
      await prefs.update(next);
      const accountId = prefs.accountId();
      if (announce && accountId !== null) changedLocally(accountId, prefs.get());
    },
    changedLocally,
    loaded,
    useLoaded: () => useStoreValue(prefs.subscribe, loaded, prefs.loadAsync),
  };
}

export function syncedSetting<T extends { at: number }>(store: ValueStoreOptions<T>, policy: SettingPolicy<T>): Setting<T> {
  return makeSetting(store, policy, (state) => state.at > 0);
}

export function orderSetting(store: ValueStoreOptions<readonly string[]>): Setting<readonly string[]> {
  return makeSetting(store, { receive: (_current, incoming) => incoming }, (order) => order.length > 0);
}
