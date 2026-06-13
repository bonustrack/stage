/** Multi-account registry for the mobile app. The app holds several wallets at
 *  once and switches without a logout. Each account is one of: 'generated' (a
 *  random EOA minted in-app), 'privateKey' (imported from a pasted key/phrase),
 *  or 'walletconnect' (remote — no key stored, signing delegated).
 *
 *  Keys for the two local types live in expo-secure-store keyed by address
 *  (`wallet.pk.<id>`); each account gets its own XMTP sqlite store (`xmtp-<id>`)
 *  so inboxes stay isolated and switching is just a client rebuild. Migration:
 *  a pre-multi-account single key under `wallet.privateKey` (db in `xmtp/`) is
 *  folded in as a 'generated' account on first load. */

import './cryptoShim';
import * as SecureStore from 'expo-secure-store';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import type { Hex } from 'viem';
/** Deferred to break the accounts ↔ channelsCache module cycle; both call sites are async. */
const setActiveAccountForCache = async (id: string | null): Promise<void> => {
  const { setActiveAccountForCache: fn } = await import('./channelsCache');
  fn(id);
};
import {
  LEGACY_DB_DIR, LEGACY_PK_KEY, PK_PREFIX,
  getViemAccount, normalizePk, privateKeyFromMnemonic,
} from './accounts.keys';
import {
  addLocalAccountToList, buildWalletConnectAccount, resolveActiveAccount,
} from '@stage-labs/client/accounts/registry';

export { canExportPrivateKey, getPrivateKey, getViemAccount } from './accounts.keys';

export type { AccountType, AccountRecord } from './accounts.types';
import type { AccountRecord } from './accounts.types';

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
  if (id) await setActiveAccountForCache(id);
  return id;
}

export async function setActiveAccountId(id: string): Promise<void> {
  await SecureStore.setItemAsync(ACTIVE_KEY, id);
  /** Point the channels cache at THIS account's store. We no longer wipe — each
   *  account keeps its own cached rows, so switching swaps to the target
   *  account's data instantly (instant 2nd open) and the stream revalidates in
   *  the background. */
  await setActiveAccountForCache(id);
}

/** Active account, falling back to the first in the list when the pointer is
 *  stale/missing. Null only when the registry is empty. */
export async function getActiveAccount(): Promise<AccountRecord | null> {
  const list = await loadAccounts();
  if (!list.length) return null;
  const id = await getActiveAccountId();
  return resolveActiveAccount(list, id);
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

async function addLocalAccount(pk: Hex, type: 'generated' | 'privateKey'): Promise<AccountRecord> {
  const acct = privateKeyToAccount(pk);
  const id = acct.address.toLowerCase();
  const list = await loadAccounts();
  /** The list-mutation RULES (new / upgrade-WC / re-activate-existing) live in
   *  the Stage SDK; this adapter handles the I/O: the key write is unconditional
   *  (also UPGRADES a prior WalletConnect address to an in-app signer), and we
   *  persist only when the list actually changed. */
  const { list: next, record, upgraded } = addLocalAccountToList(list, id, acct.address, type);
  await SecureStore.setItemAsync(PK_PREFIX + id, pk);
  if (next !== list || upgraded) await persist(next);
  await setActiveAccountId(id);
  return record;
}

export async function addGeneratedAccount(): Promise<AccountRecord> {
  return addLocalAccount(generatePrivateKey(), 'generated');
}

export async function importPrivateKey(input: string): Promise<AccountRecord> {
  return addLocalAccount(normalizePk(input), 'privateKey');
}
/** Import an existing wallet from one pasted string — a 0x private key (64 hex)
 *  or a BIP-39 phrase (phrases have spaces, keys don't). A phrase is reduced to
 *  its raw key and stored exactly like a pasted key. Throws on bad input. */
export async function importWallet(input: string): Promise<AccountRecord> {
  const pk = input.trim().includes(' ') ? privateKeyFromMnemonic(input) : normalizePk(input);
  return addLocalAccount(pk, 'privateKey');
}

/** WalletConnect account — no private key stored locally. The address is the
 *  one returned by the connected wallet session; signing is delegated to it. */
export async function addWalletConnectAccount(address: string): Promise<AccountRecord> {
  const id = address.toLowerCase();
  const list = await loadAccounts();
  const existing = list.find(a => a.id === id);
  if (existing) { await setActiveAccountId(id); return existing; }
  const rec = buildWalletConnectAccount(address);
  await persist([...list, rec]);
  await setActiveAccountId(id);
  return rec;
}

/** Persist a `smart` (ZeroDev Kernel) account record and make it active. The id
 *  is the counterfactual Kernel address; no private key is stored (the owner is
 *  re-derived from the single app mnemonic at `hdIndex`). Idempotent on the id —
 *  re-adding merges the latest fields onto the existing record. */
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
  const next = [...list, { ...rec, id }];
  await persist(next);
  await setActiveAccountId(id);
  return next[next.length - 1];
}

/** Update mutable bookkeeping fields on a smart account (deployed flag, the
 *  opt-in SCW XMTP cutover flag, cached passkey id, label). No-op for a missing id. */
export async function updateSmartAccount(
  id: string, patch: Partial<Pick<AccountRecord, 'deployed' | 'scwXmtp' | 'passkeyCredId' | 'label' | 'guardians' | 'guardianThreshold' | 'guardianDelay'>>,
): Promise<void> {
  const list = await loadAccounts();
  const rec = list.find(a => a.id === id.toLowerCase());
  if (!rec) return;
  Object.assign(rec, patch);
  await persist(list);
}

/** The next free HD index for a new smart account = count of existing smart
 *  accounts (indices are dense from 0; same mnemonic powers users AND agents). */
export async function nextSmartHdIndex(): Promise<number> {
  const list = await loadAccounts();
  return list.filter(a => a.type === 'smart').length;
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
