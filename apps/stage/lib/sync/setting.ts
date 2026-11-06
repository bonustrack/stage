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

export interface Setting<T> {
  prefs: ValueStore<T>;
  sync: SyncedSetting<T>;
  changedLocally: (accountId: string, state: T) => void;
  loaded: () => boolean;
  useLoaded: () => boolean;
}

export function syncedSetting<T extends { at: number }>(store: ValueStoreOptions<T>, policy: SettingPolicy<T>): Setting<T> {
  const prefs = createValueStore(store);
  const changes = settingChanges<T>();
  const synced = policy.synced ?? ((state: T): T => state);
  const loaded = (): boolean => prefs.accountId() !== null;
  return {
    prefs,
    sync: {
      onLocalChange: changes.subscribe,
      load: async (accountId) => {
        const state = await prefs.loadFor(accountId);
        return state.at > 0 ? synced(state) : null;
      },
      applyRemote: (accountId, incoming) => prefs.updateFor(accountId, (current) => policy.receive(current, incoming, accountId)),
    },
    changedLocally: (accountId, state) => {
      changes.notify({ accountId, state: synced(state) });
    },
    loaded,
    useLoaded: () => useStoreValue(prefs.subscribe, loaded, prefs.loadAsync),
  };
}
