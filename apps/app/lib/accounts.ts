/** Multi-account registry for the mobile app.
 *
 *  The app holds several wallets at once and switches between them without a
 *  logout. Each account is one of:
 *    - 'generated'      — a random EOA minted in-app (key in SecureStore)
 *    - 'privateKey'     — an EOA imported from a pasted private key
 *    - 'walletconnect'  — a remote wallet; we store no key, signing is delegated
 *
 *  Private keys for the two local types live in expo-secure-store keyed by
 *  address (`wallet.pk.<id>`); WalletConnect accounts have no stored key (so
 *  they can't export one). Each account gets its own XMTP sqlite store
 *  (`xmtp-<id>`) so inboxes stay isolated and switching is just a client rebuild.
 *
 *  Migration: the pre-multi-account build kept a single key under
 *  `wallet.privateKey` with its XMTP db in `xmtp/`. On first load here we fold
 *  that into the registry as a 'generated' account pointing at the legacy dir. */

import './cryptoShim';
import * as SecureStore from 'expo-secure-store';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import type { Hex } from 'viem';

export type AccountType = 'generated' | 'privateKey' | 'walletconnect';

export interface AccountRecord {
  /** Lowercased address — stable, SecureStore-key-safe identifier. */
  id: string;
  /** Checksummed address for display + signing. */
  address: string;
  type: AccountType;
  label?: string;
  /** Dir name under the document dir for this account's XMTP store. */
  dbDir: string;
  /** An XMTP installation has been created in dbDir (so we Client.build, not create). */
  registered?: boolean;
  createdAt: number;
}

const LIST_KEY = 'accounts.list';
const ACTIVE_KEY = 'accounts.active';
const PK_PREFIX = 'wallet.pk.';
/** Pre-multi-account single-key location + its XMTP db dir. */
const LEGACY_PK_KEY = 'wallet.privateKey';
const LEGACY_DB_DIR = 'xmtp';

let cache: AccountRecord[] | null = null;

async function persist(list: AccountRecord[]): Promise<void> {
  cache = list;
  await SecureStore.setItemAsync(LIST_KEY, JSON.stringify(list));
}

/** Accept a private key with or without the `0x` prefix and any case; return a
 *  normalized lowercase `0x…` 32-byte hex, or throw if it isn't 64 hex chars. */
function normalizePk(input: string): Hex {
  let pk = input.trim();
  if (pk.startsWith('0X')) pk = '0x' + pk.slice(2);
  if (!pk.startsWith('0x')) pk = '0x' + pk;
  pk = '0x' + pk.slice(2).toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(pk)) {
    throw new Error('Invalid private key — expected 64 hex characters.');
  }
  return pk as Hex;
}

export async function loadAccounts(): Promise<AccountRecord[]> {
  if (cache) return cache;
  const raw = await SecureStore.getItemAsync(LIST_KEY).catch(() => null);
  if (raw) {
    try { cache = JSON.parse(raw) as AccountRecord[]; return cache; }
    catch { /* corrupted — fall through to rebuild from legacy */ }
  }
  /** First run on the multi-account build — migrate the legacy single key. */
  const list: AccountRecord[] = [];
  const legacy = await SecureStore.getItemAsync(LEGACY_PK_KEY).catch(() => null);
  if (legacy && /^0x[0-9a-fA-F]{64}$/.test(legacy)) {
    const acct = privateKeyToAccount(legacy as Hex);
    const id = acct.address.toLowerCase();
    await SecureStore.setItemAsync(PK_PREFIX + id, '0x' + legacy.slice(2).toLowerCase());
    list.push({
      id, address: acct.address, type: 'generated',
      dbDir: LEGACY_DB_DIR, registered: true, createdAt: Date.now(),
    });
    await SecureStore.setItemAsync(ACTIVE_KEY, id);
  }
  await persist(list);
  return list;
}

export async function getActiveAccountId(): Promise<string | null> {
  return SecureStore.getItemAsync(ACTIVE_KEY).catch(() => null);
}

export async function setActiveAccountId(id: string): Promise<void> {
  await SecureStore.setItemAsync(ACTIVE_KEY, id);
}

/** Active account, falling back to the first in the list when the pointer is
 *  stale/missing. Null only when the registry is empty. */
export async function getActiveAccount(): Promise<AccountRecord | null> {
  const list = await loadAccounts();
  if (!list.length) return null;
  const id = await getActiveAccountId();
  return list.find(a => a.id === id) ?? list[0];
}

export async function getPrivateKey(id: string): Promise<Hex | null> {
  const pk = await SecureStore.getItemAsync(PK_PREFIX + id).catch(() => null);
  return pk && /^0x[0-9a-f]{64}$/.test(pk) ? (pk as Hex) : null;
}

export async function getViemAccount(id: string): Promise<PrivateKeyAccount | null> {
  const pk = await getPrivateKey(id);
  return pk ? privateKeyToAccount(pk) : null;
}

export function canExportPrivateKey(rec: AccountRecord): boolean {
  return rec.type !== 'walletconnect';
}

async function addLocalAccount(pk: Hex, type: 'generated' | 'privateKey'): Promise<AccountRecord> {
  const acct = privateKeyToAccount(pk);
  const id = acct.address.toLowerCase();
  const list = await loadAccounts();
  const existing = list.find(a => a.id === id);
  if (existing) { await setActiveAccountId(id); return existing; }
  await SecureStore.setItemAsync(PK_PREFIX + id, pk);
  const rec: AccountRecord = {
    id, address: acct.address, type, dbDir: `xmtp-${id}`, registered: false, createdAt: Date.now(),
  };
  await persist([...list, rec]);
  await setActiveAccountId(id);
  return rec;
}

export async function addGeneratedAccount(): Promise<AccountRecord> {
  return addLocalAccount(generatePrivateKey(), 'generated');
}

export async function importPrivateKey(input: string): Promise<AccountRecord> {
  return addLocalAccount(normalizePk(input), 'privateKey');
}

/** WalletConnect account — no private key stored locally. The address is the
 *  one returned by the connected wallet session; signing is delegated to it. */
export async function addWalletConnectAccount(address: string): Promise<AccountRecord> {
  const id = address.toLowerCase();
  const list = await loadAccounts();
  const existing = list.find(a => a.id === id);
  if (existing) { await setActiveAccountId(id); return existing; }
  const rec: AccountRecord = {
    id, address, type: 'walletconnect', dbDir: `xmtp-${id}`, registered: false, createdAt: Date.now(),
  };
  await persist([...list, rec]);
  await setActiveAccountId(id);
  return rec;
}

export async function markRegistered(id: string): Promise<void> {
  const list = await loadAccounts();
  const rec = list.find(a => a.id === id);
  if (rec && !rec.registered) { rec.registered = true; await persist(list); }
}

export async function renameAccount(id: string, label: string): Promise<void> {
  const list = await loadAccounts();
  const rec = list.find(a => a.id === id);
  if (rec) { rec.label = label.trim() || undefined; await persist(list); }
}

/** Remove one account: drop its key + record, and re-point `active` if it was
 *  the one removed. Returns the new list. Caller deletes the on-disk db dir. */
export async function removeAccount(id: string): Promise<AccountRecord[]> {
  const list = await loadAccounts();
  const next = list.filter(a => a.id !== id);
  await SecureStore.deleteItemAsync(PK_PREFIX + id).catch(() => undefined);
  await persist(next);
  const active = await getActiveAccountId();
  if (active === id) {
    if (next.length) await setActiveAccountId(next[0].id);
    else await SecureStore.deleteItemAsync(ACTIVE_KEY).catch(() => undefined);
  }
  return next;
}

/** Wipe the whole registry — all keys, the list, the active pointer, and the
 *  legacy key. Returns the removed records so the caller can delete each db dir. */
export async function clearAllAccounts(): Promise<AccountRecord[]> {
  const list = await loadAccounts();
  for (const a of list) await SecureStore.deleteItemAsync(PK_PREFIX + a.id).catch(() => undefined);
  await SecureStore.deleteItemAsync(LIST_KEY).catch(() => undefined);
  await SecureStore.deleteItemAsync(ACTIVE_KEY).catch(() => undefined);
  await SecureStore.deleteItemAsync(LEGACY_PK_KEY).catch(() => undefined);
  cache = null;
  return list;
}

/** Drop the in-memory cache so the next read re-hydrates from SecureStore. */
export function invalidateAccountsCache(): void { cache = null; }
