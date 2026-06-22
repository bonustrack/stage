import type { AccountRecord } from './types';
import { addLocalAccountToList, resolveActiveAccount } from './registry';

export interface KeyValueStore {
  get(key: string): string | null | Promise<string | null>;
  set(key: string, value: string): void | Promise<void>;
  remove(key: string): void | Promise<void>;
}

export interface AccountStoreKeys {
  list: string;
  active: string;
}

const DEFAULT_KEYS: AccountStoreKeys = { list: 'accounts.list', active: 'accounts.active' };

export interface AccountStore {
  loadAccounts(): Promise<AccountRecord[]>;
  persist(list: AccountRecord[]): Promise<void>;
  getActiveAccountId(): Promise<string | null>;
  setActiveAccountId(id: string): Promise<void>;
  getActiveAccount(): Promise<AccountRecord | null>;
  addLocalAccount(
    id: string,
    address: string,
    type: 'generated' | 'privateKey',
  ): Promise<AccountRecord>;
  removeAccount(id: string): Promise<AccountRecord[]>;
}

export function createAccountStore(
  kv: KeyValueStore,
  keys?: Partial<AccountStoreKeys>,
): AccountStore {
  const k: AccountStoreKeys = { ...DEFAULT_KEYS, ...keys };

  async function loadAccounts(): Promise<AccountRecord[]> {
    const raw = await kv.get(k.list);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as AccountRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function persist(list: AccountRecord[]): Promise<void> {
    await kv.set(k.list, JSON.stringify(list));
  }

  async function getActiveAccountId(): Promise<string | null> {
    return (await kv.get(k.active)) ?? null;
  }

  async function setActiveAccountId(id: string): Promise<void> {
    await kv.set(k.active, id);
  }

  async function getActiveAccount(): Promise<AccountRecord | null> {
    const list = await loadAccounts();
    if (!list.length) return null;
    const id = await getActiveAccountId();
    return resolveActiveAccount(list, id);
  }

  async function addLocalAccount(
    id: string,
    address: string,
    type: 'generated' | 'privateKey',
  ): Promise<AccountRecord> {
    const list = await loadAccounts();
    const { list: next, record } = addLocalAccountToList(list, id, address, type);
    await persist(next);
    return record;
  }

  async function removeAccount(id: string): Promise<AccountRecord[]> {
    const list = await loadAccounts();
    const next = list.filter(a => a.id !== id);
    await persist(next);
    const active = await getActiveAccountId();
    if (active === id) {
      const nextActive = resolveActiveAccount(next, null);
      if (nextActive) await setActiveAccountId(nextActive.id);
      else await kv.remove(k.active);
    }
    return next;
  }

  return {
    loadAccounts,
    persist,
    getActiveAccountId,
    setActiveAccountId,
    getActiveAccount,
    addLocalAccount,
    removeAccount,
  };
}
