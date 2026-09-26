

import './cryptoShim';
import { secureStorage } from '../platform/storage';
import type { PrivateKeyAccount } from 'viem/accounts';
import type { Hex } from 'viem';
const setActiveAccountForCache = async (id: string | null): Promise<void> => {
  const { setActiveAccountForCache: fn } = await import('./channelsCache');
  fn(id);
};
import { getViemAccount, adoptLegacyKey, deleteKey, deletePhrase, importPrivateKey, primaryPhraseId } from './zerodev/keyring';
import { LEGACY_DB_DIR } from '@stage-labs/client/accounts/keys';
import { addLocalAccountToList, resolveActiveAccount } from '@stage-labs/client/accounts/registry';
import { nextHdIndex } from '@stage-labs/client/accounts/hdIndex';
import { readSmartHdIndexHighWater } from './zerodev/hdIndexStore';

export { canExportPrivateKey } from '@stage-labs/client/accounts/keys';
export { getViemAccount, revealPrivateKey as getPrivateKey } from './zerodev/keyring';

export type { AccountRecord } from '@stage-labs/client/accounts/types';
import { ACCOUNT_TYPES, type AccountRecord } from '@stage-labs/client/accounts/types';
import { recover, ignored } from './errorPolicy';

const LIST_KEY = 'accounts.list';
const ACTIVE_KEY = 'accounts.active';

let cache: AccountRecord[] | null = null;

async function persist(list: AccountRecord[]): Promise<void> {
  cache = list;
  await secureStorage.set(LIST_KEY, JSON.stringify(list));
}

async function withPhraseIds(list: AccountRecord[]): Promise<AccountRecord[]> {
  if (!list.some(a => a.type === 'smart' && a.phraseId === undefined)) return list;
  const primary = await primaryPhraseId().catch(recover('accounts.phraseIds', null));
  if (!primary) return list;
  const next = list.map(a => (a.type === 'smart' && a.phraseId === undefined ? { ...a, phraseId: primary } : a));
  await persist(next);
  return next;
}

function parseStoredList(raw: string): AccountRecord[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AccountRecord[]).filter(a => ACCOUNT_TYPES.includes(a.type)) : null;
  } catch {
    return null;
  }
}

const UNREADABLE_LIST = 'The account list could not be read, so nothing was changed. Try again.';

function unreadable(strict: boolean): AccountRecord[] {
  if (strict) throw new Error(UNREADABLE_LIST);
  return [];
}

async function loadList(strict: boolean): Promise<AccountRecord[]> {
  if (cache) return cache;
  const raw = await secureStorage.get(LIST_KEY).catch(recover('accounts.list', undefined));
  if (raw === undefined) return unreadable(strict);
  if (raw !== null && raw !== '') {
    const stored = parseStoredList(raw);
    if (stored === null) return unreadable(strict);
    cache = await withPhraseIds(stored);
    return cache;
  }
  const adopted = await adoptLegacyKey();
  if (!adopted) { cache = []; return cache; }
  const list: AccountRecord[] = [{
    id: adopted.id, address: adopted.address, type: 'generated',
    dbDir: LEGACY_DB_DIR, registered: true, createdAt: Date.now(),
  }];
  await secureStorage.set(ACTIVE_KEY, adopted.id);
  await persist(list);
  return list;
}

export function loadAccounts(): Promise<AccountRecord[]> {
  return loadList(false);
}

function loadAccountsForWrite(): Promise<AccountRecord[]> {
  return loadList(true);
}

export async function hasAccounts(): Promise<boolean> {
  return (await loadAccountsForWrite()).length > 0;
}

export async function getActiveAccountId(): Promise<string | null> {
  const id = await secureStorage.get(ACTIVE_KEY).catch(recover('accounts.activeId', null));
  if (id) await setActiveAccountForCache(id);
  return id;
}

export async function setActiveAccountId(id: string): Promise<void> {
  await secureStorage.set(ACTIVE_KEY, id);
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
  if (!rec || rec.type === 'smart') return null;
  return getViemAccount(rec.id);
}

export async function addSmartAccount(rec: AccountRecord): Promise<AccountRecord> {
  const id = rec.id.toLowerCase();
  const list = await loadAccountsForWrite();
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

export async function addPrivateKeyAccount(pk: Hex): Promise<AccountRecord> {
  const { id, address } = await importPrivateKey(pk);
  const list = await loadAccountsForWrite();
  const { list: next, record } = addLocalAccountToList(list, id, address, 'privateKey');
  await persist(next);
  await setActiveAccountId(record.id);
  return record;
}

export async function updateSmartAccount(
  id: string, patch: Partial<Pick<AccountRecord, 'deployed' | 'scwXmtp' | 'passkeyCredId' | 'passkey' | 'passkeySudo' | 'label' | 'devicePasskey'>>,
): Promise<void> {
  const list = await loadAccountsForWrite();
  const rec = list.find(a => a.id === id.toLowerCase());
  if (!rec) return;
  Object.assign(rec, patch);
  await persist(list);
}

export async function nextSmartHdIndex(phraseId: string): Promise<number> {
  const list = await loadAccountsForWrite();
  const used = list.flatMap(a => (a.type === 'smart' && a.phraseId === phraseId && a.hdIndex !== undefined ? [a.hdIndex] : []));
  return nextHdIndex(used, await readSmartHdIndexHighWater(phraseId));
}

export async function markRegistered(id: string): Promise<void> {
  const list = await loadAccountsForWrite();
  const rec = list.find(a => a.id === id);
  if (rec && !rec.registered) { rec.registered = true; await persist(list); }
}

export async function removeAccount(id: string): Promise<AccountRecord[]> {
  const list = await loadAccountsForWrite();
  const rec = list.find(a => a.id === id);
  const next = list.filter(a => a.id !== id);
  await deleteKey(id);
  await persist(next);
  const active = await getActiveAccountId();
  if (active === id) {
    const first = next[0];
    if (first) await setActiveAccountId(first.id);
    else await secureStorage.delete(ACTIVE_KEY).catch(ignored(undefined, 'cleanup'));
  }
  const removedPhrase = rec?.type === 'smart' ? rec.phraseId : undefined;
  const stillUsed = new Set(next.flatMap(a => (a.type === 'smart' && a.phraseId ? [a.phraseId] : [])));
  if (removedPhrase && !stillUsed.has(removedPhrase)) {
    await deletePhrase(removedPhrase, [...stillUsed][0] ?? null);
  }
  return next;
}
