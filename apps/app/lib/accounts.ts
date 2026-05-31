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
import { setActiveAccountForCache } from './channelsCache';

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
  const id = await SecureStore.getItemAsync(ACTIVE_KEY).catch(() => null);
  /** Boot init: point the channels cache at the active account's store so the
   *  Channels screen reads the right per-account rows on cold start (idempotent —
   *  no-ops when the pointer is already set; the switch path sets it directly). */
  if (id) setActiveAccountForCache(id);
  return id;
}

export async function setActiveAccountId(id: string): Promise<void> {
  await SecureStore.setItemAsync(ACTIVE_KEY, id);
  /** Point the channels cache at THIS account's store. We no longer wipe — each
   *  account keeps its own cached rows, so switching swaps to the target
   *  account's data instantly (instant 2nd open) and the stream revalidates in
   *  the background. */
  setActiveAccountForCache(id);
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
  if (pk && /^0x[0-9a-f]{64}$/.test(pk)) return pk as Hex;
  /** Self-heal: a key from the pre-multi-account build (or an early multi-account
   *  build that recorded the account but never copied the key) may still live only
   *  under the legacy `wallet.privateKey`. Accept it iff it derives to THIS id, and
   *  re-write it under the per-account key so future reads are direct. WC accounts
   *  have no key anywhere → still null → WC signing path stays intact. */
  const legacy = await SecureStore.getItemAsync(LEGACY_PK_KEY).catch(() => null);
  if (legacy && /^0x[0-9a-fA-F]{64}$/.test(legacy)) {
    const norm = ('0x' + legacy.slice(2).toLowerCase()) as Hex;
    try {
      if (privateKeyToAccount(norm).address.toLowerCase() === id.toLowerCase()) {
        await SecureStore.setItemAsync(PK_PREFIX + id, norm).catch(() => undefined);
        return norm;
      }
    } catch { /* malformed legacy key — fall through to null */ }
  }
  return null;
}

export async function getViemAccount(id: string): Promise<PrivateKeyAccount | null> {
  const pk = await getPrivateKey(id);
  return pk ? privateKeyToAccount(pk) : null;
}

/** The ACTIVE account as a viem signer, or null when it can't sign in-app
 *  (WalletConnect account, or no stored key) — callers then fall back to the
 *  remote/wagmi signing path. Resolves through getPrivateKey, which self-heals
 *  a legacy `wallet.privateKey` into the per-account slot. */
export async function getActiveViemAccount(): Promise<PrivateKeyAccount | null> {
  const rec = await getActiveAccount();
  if (!rec || rec.type === 'walletconnect') return null;
  return getViemAccount(rec.id);
}

export function canExportPrivateKey(rec: AccountRecord): boolean {
  return rec.type !== 'walletconnect';
}

async function addLocalAccount(pk: Hex, type: 'generated' | 'privateKey'): Promise<AccountRecord> {
  const acct = privateKeyToAccount(pk);
  const id = acct.address.toLowerCase();
  const list = await loadAccounts();
  const existing = list.find(a => a.id === id);
  if (existing) {
    /** Importing a key for an address we already had as a WalletConnect account
     *  must UPGRADE it to a local signer: store the key and flip the type, so
     *  getActiveViemAccount resolves it (in-app signing) instead of bouncing to WC. */
    await SecureStore.setItemAsync(PK_PREFIX + id, pk);
    if (existing.type === 'walletconnect') {
      const upgraded: AccountRecord = { ...existing, type };
      await persist(list.map(a => (a.id === id ? upgraded : a)));
      await setActiveAccountId(id);
      return upgraded;
    }
    await setActiveAccountId(id);
    return existing;
  }
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
