

import './cryptoShim';
import * as SecureStore from 'expo-secure-store';
import type { PrivateKeyAccount } from 'viem/accounts';
const setActiveAccountForCache = async (id: string | null): Promise<void> => {
  const { setActiveAccountForCache: fn } = await import('./channelsCache');
  fn(id);
};
import { getViemAccount, adoptLegacyKey, deleteKey, clearLegacyKey } from './zerodev/keyring';
import { LEGACY_DB_DIR } from '@stage-labs/client/accounts/keys';
import { resolveActiveAccount } from '@stage-labs/client/accounts/registry';

export { canExportPrivateKey } from '@stage-labs/client/accounts/keys';
export { getViemAccount, revealPrivateKey as getPrivateKey } from './zerodev/keyring';

export type { AccountRecord } from '@stage-labs/client/accounts/types';
import type { AccountRecord } from '@stage-labs/client/accounts/types';

const LIST_KEY = 'accounts.list';
const ACTIVE_KEY = 'accounts.active';

let cache: AccountRecord[] | null = null;

async function persist(list: AccountRecord[]): Promise<void> {
  cache = list;
  await SecureStore.setItemAsync(LIST_KEY, JSON.stringify(list));
}

export async function loadAccounts(): Promise<AccountRecord[]> {
  if (cache) return cache;
  const raw = await SecureStore.getItemAsync(LIST_KEY).catch(() => null);
  if (raw) {
    try { cache = JSON.parse(raw) as AccountRecord[]; return cache; }
    catch { }
  }
  const list: AccountRecord[] = [];
  const adopted = await adoptLegacyKey();
  if (adopted) {
    list.push({
      id: adopted.id, address: adopted.address, type: 'generated',
      dbDir: LEGACY_DB_DIR, registered: true, createdAt: Date.now(),
    });
    await SecureStore.setItemAsync(ACTIVE_KEY, adopted.id);
  }
  await persist(list);
  return list;
}

export async function getActiveAccountId(): Promise<string | null> {
  const id = await SecureStore.getItemAsync(ACTIVE_KEY).catch(() => null);
  if (id) await setActiveAccountForCache(id);
  return id;
}

export async function setActiveAccountId(id: string): Promise<void> {
  await SecureStore.setItemAsync(ACTIVE_KEY, id);
  await setActiveAccountForCache(id);
}

export async function getActiveAccount(): Promise<AccountRecord | null> {
  const list = await loadAccounts();
  if (!list.length) return null;
  const id = await getActiveAccountId();
  return resolveActiveAccount(list, id);
}

export async function getActiveViemAccount(): Promise<PrivateKeyAccount | null> {
  const rec = await getActiveAccount();
  if (!rec || rec.type === 'smart' || rec.type === 'walletconnect') return null;
  return getViemAccount(rec.id);
}

export async function addSmartAccount(rec: AccountRecord): Promise<AccountRecord> {
  const id = rec.id.toLowerCase();
  const list = await loadAccounts();
  const existing = list.find(a => a.id === id);
  if (existing) {
    Object.assign(existing, rec, { id });
    await persist(list);
    await setActiveAccountId(id);
    return existing;
  }
  const created = { ...rec, id };
  const next = [...list, created];
  await persist(next);
  await setActiveAccountId(id);
  return created;
}

export async function updateSmartAccount(
  id: string, patch: Partial<Pick<AccountRecord, 'deployed' | 'scwXmtp' | 'passkeyCredId' | 'passkey' | 'passkeySudo' | 'label' | 'guardians' | 'guardianThreshold' | 'guardianDelay'>>,
): Promise<void> {
  const list = await loadAccounts();
  const rec = list.find(a => a.id === id.toLowerCase());
  if (!rec) return;
  Object.assign(rec, patch);
  await persist(list);
}

export async function nextSmartHdIndex(): Promise<number> {
  const list = await loadAccounts();
  return list.filter(a => a.type === 'smart').length;
}

export async function markRegistered(id: string): Promise<void> {
  const list = await loadAccounts();
  const rec = list.find(a => a.id === id);
  if (rec && !rec.registered) { rec.registered = true; await persist(list); }
}

export async function removeAccount(id: string): Promise<AccountRecord[]> {
  const list = await loadAccounts();
  const next = list.filter(a => a.id !== id);
  await deleteKey(id);
  await persist(next);
  const active = await getActiveAccountId();
  if (active === id) {
    const first = next[0];
    if (first) await setActiveAccountId(first.id);
    else await SecureStore.deleteItemAsync(ACTIVE_KEY).catch(() => undefined);
  }
  return next;
}

export async function clearAllAccounts(): Promise<AccountRecord[]> {
  const list = await loadAccounts();
  for (const a of list) await deleteKey(a.id);
  await SecureStore.deleteItemAsync(LIST_KEY).catch(() => undefined);
  await SecureStore.deleteItemAsync(ACTIVE_KEY).catch(() => undefined);
  await clearLegacyKey();
  cache = null;
  return list;
}
