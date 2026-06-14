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
import type { PrivateKeyAccount } from 'viem/accounts';
/** Deferred to break the accounts ↔ channelsCache module cycle; both call sites are async. */
const setActiveAccountForCache = async (id: string | null): Promise<void> => {
  const { setActiveAccountForCache: fn } = await import('./channelsCache');
  fn(id);
};
import { getViemAccount } from './accounts.keys';
/** ALL private-key storage goes through the keyring (the single chokepoint). This
 *  module only owns the non-secret registry rows (list + active pointer). */
import {
  createGeneratedKey, importKey, adoptLegacyKey, deleteKey, clearLegacyKey,
} from './zerodev/keyring';
import { LEGACY_DB_DIR } from '@stage-labs/client/accounts/keys';
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
  /** First run on the multi-account build — migrate the legacy single key (the
   *  keyring owns the key I/O; we only record the registry row). */
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

/** Record a freshly-provisioned local key (the keyring already stored it) into
 *  the registry. The list-mutation RULES (new / upgrade-WC / re-activate) live in
 *  the Stage SDK; we only persist when the list changed and set active. */
async function recordLocalAccount(
  id: string, address: string, type: 'generated' | 'privateKey',
): Promise<AccountRecord> {
  const list = await loadAccounts();
  const { list: next, record, upgraded } = addLocalAccountToList(list, id, address, type);
  if (next !== list || upgraded) await persist(next);
  await setActiveAccountId(id);
  return record;
}

export async function addGeneratedAccount(): Promise<AccountRecord> {
  const { id, address } = await createGeneratedKey();
  return recordLocalAccount(id, address, 'generated');
}

export async function importPrivateKey(input: string): Promise<AccountRecord> {
  const { id, address } = await importKey(input);
  return recordLocalAccount(id, address, 'privateKey');
}
/** Import an existing wallet from one pasted string — a 0x private key (64 hex)
 *  or a BIP-39 phrase (phrases have spaces, keys don't). The keyring reduces a
 *  phrase to its raw key and stores it exactly like a pasted key. */
export async function importWallet(input: string): Promise<AccountRecord> {
  const { id, address } = await importKey(input);
  return recordLocalAccount(id, address, 'privateKey');
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
  id: string, patch: Partial<Pick<AccountRecord, 'deployed' | 'scwXmtp' | 'passkeyCredId' | 'passkey' | 'label' | 'guardians' | 'guardianThreshold' | 'guardianDelay'>>,
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
  await deleteKey(id);
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
  for (const a of list) await deleteKey(a.id);
  await SecureStore.deleteItemAsync(LIST_KEY).catch(() => undefined);
  await SecureStore.deleteItemAsync(ACTIVE_KEY).catch(() => undefined);
  await clearLegacyKey();
  cache = null;
  return list;
}
