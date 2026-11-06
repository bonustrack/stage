import './cryptoShim';
import { secureStorage } from '../platform/storage';
import type { PrivateKeyAccount } from 'viem/accounts';
import type { Hex } from 'viem';
import { getViemAccount, adoptLegacyKey, deleteKey, deletePhrase, importPrivateKey, primaryPhraseId } from './zerodev/keyring';
import { LEGACY_DB_DIR, addLocalAccountToList, nextHdIndex, resolveActiveAccount } from '@stage-labs/client/accounts/registry';
import { readSmartHdIndexHighWater } from './zerodev/hdIndexStore';
import { ACCOUNT_TYPES, type AccountRecord } from '@stage-labs/client/accounts/types';
import { recover, ignored } from './errorPolicy';
import { accountSelectionChanged, knownActiveAccountId, provideActiveAccountReader, rememberActiveAccountId } from './accountSelection';
import { capabilities } from './capabilities';
import { jsonWith } from './storeCore';
import { z } from 'zod';

const LIST_KEY = 'accounts.list';
const ACTIVE_KEY = 'accounts.active';

let cache: AccountRecord[] | null = null;

secureStorage.subscribe?.([LIST_KEY, ACTIVE_KEY], () => {
  cache = null;
  accountSelectionChanged();
  capabilities.reload();
});

async function persist(list: AccountRecord[]): Promise<void> {
  await secureStorage.set(LIST_KEY, JSON.stringify(list));
  cache = list;
}

async function withPhraseIds(list: AccountRecord[]): Promise<AccountRecord[]> {
  if (!list.some((a) => a.type === 'smart' && a.phraseId === undefined)) return list;
  const primary = await primaryPhraseId().catch(recover('accounts.phraseIds', null));
  if (!primary) return list;
  const next = list.map((a) => (a.type === 'smart' && a.phraseId === undefined ? { ...a, phraseId: primary } : a));
  await persist(next);
  return next;
}

const storedListSchema = z
  .array(z.custom<AccountRecord>((item) => item !== null))
  .transform((list) => list.filter((a) => ACCOUNT_TYPES.includes(a.type)));

const parseStoredList = jsonWith(storedListSchema);

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
    if (stored === undefined) return unreadable(strict);
    cache = await withPhraseIds(stored);
    return cache;
  }
  const adopted = await adoptLegacyKey();
  if (!adopted) {
    cache = [];
    return cache;
  }
  const list: AccountRecord[] = [
    { id: adopted.id, address: adopted.address, type: 'generated', dbDir: LEGACY_DB_DIR, registered: true, createdAt: Date.now() },
  ];
  await secureStorage.set(ACTIVE_KEY, adopted.id);
  await persist(list);
  return list;
}

export function loadAccounts(): Promise<AccountRecord[]> {
  return loadList(false);
}

export function loadAccountsForWrite(): Promise<AccountRecord[]> {
  return loadList(true);
}

export async function getActiveAccountId(): Promise<string | null> {
  const id = await secureStorage.get(ACTIVE_KEY).catch(recover('accounts.activeId', null));
  if (id) rememberActiveAccountId(id);
  return id;
}

export async function setActiveAccountId(id: string): Promise<void> {
  const previous = await secureStorage.get(ACTIVE_KEY);
  await secureStorage.set(ACTIVE_KEY, id);
  if (previous !== id) accountSelectionChanged();
  rememberActiveAccountId(id);
}

export async function getSelectedAccount(): Promise<AccountRecord | null> {
  const list = await loadList(true);
  const id = await secureStorage.get(ACTIVE_KEY);
  return list.find((rec) => rec.id === id) ?? null;
}

async function activeAccount(strict: boolean): Promise<AccountRecord | null> {
  const list = await loadList(strict);
  if (!list.length) return null;
  const id = strict ? await secureStorage.get(ACTIVE_KEY) : await getActiveAccountId();
  if (strict && id) rememberActiveAccountId(id);
  return resolveActiveAccount(list, id);
}

export function getActiveAccount(): Promise<AccountRecord | null> {
  return activeAccount(false);
}
export function getActiveAccountStrict(): Promise<AccountRecord | null> {
  return activeAccount(true);
}

provideActiveAccountReader(async () => (await getActiveAccount())?.id ?? null);

export async function currentAccountId(): Promise<string | null> {
  return knownActiveAccountId() ?? (await getActiveAccountId());
}

export async function getActiveViemAccount(): Promise<PrivateKeyAccount | null> {
  const rec = await getActiveAccount();
  if (!rec || rec.type === 'smart') return null;
  return getViemAccount(rec.id);
}

export async function addSmartAccount(rec: AccountRecord): Promise<AccountRecord> {
  const id = rec.id.toLowerCase();
  const list = await loadAccountsForWrite();
  const existing = list.find((a) => a.id === id);
  const record = { ...existing, ...rec, id };
  await persist(existing ? list.map((a) => (a.id === id ? record : a)) : [...list, record]);
  await setActiveAccountId(id);
  return record;
}

export async function addPrivateKeyAccount(pk: Hex): Promise<AccountRecord> {
  const { id, address } = await importPrivateKey(pk);
  const list = await loadAccountsForWrite();
  const { list: next, record } = addLocalAccountToList(list, id, address, 'privateKey');
  await persist(next);
  await setActiveAccountId(record.id);
  return record;
}

export async function nextSmartHdIndex(phraseId: string): Promise<number> {
  const list = await loadAccountsForWrite();
  const used = list.flatMap((a) => (a.type === 'smart' && a.phraseId === phraseId && a.hdIndex !== undefined ? [a.hdIndex] : []));
  return nextHdIndex(used, await readSmartHdIndexHighWater(phraseId));
}

export async function markRegistered(id: string): Promise<void> {
  const list = await loadAccountsForWrite();
  const rec = list.find((a) => a.id === id);
  if (rec && !rec.registered) await persist(list.map((a) => (a.id === id ? { ...a, registered: true } : a)));
}

export async function removeAccount(id: string): Promise<AccountRecord[]> {
  const list = await loadAccountsForWrite();
  const rec = list.find((a) => a.id === id);
  const next = list.filter((a) => a.id !== id);
  try {
    await deleteKey(id);
    await persist(next);
    const active = await getActiveAccountId();
    if (active === id) {
      const first = next[0];
      if (first) await setActiveAccountId(first.id);
      else await secureStorage.delete(ACTIVE_KEY).catch(ignored(undefined, 'cleanup'));
    }
    const removedPhrase = rec?.type === 'smart' ? rec.phraseId : undefined;
    const stillUsed = new Set(next.flatMap((a) => (a.type === 'smart' && a.phraseId ? [a.phraseId] : [])));
    if (removedPhrase && !stillUsed.has(removedPhrase)) {
      await deletePhrase(removedPhrase, [...stillUsed][0] ?? null);
    }
    return next;
  } finally {
    accountSelectionChanged();
  }
}
