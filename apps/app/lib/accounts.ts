/** Multi-account registry for the mobile app. The app holds several wallets at
 *  once and switches without a logout. Every account is a mnemonic-derived
 *  ZeroDev Kernel `smart` account — the ONLY account model the app creates.
 *
 *  Each account gets its own XMTP sqlite store (`xmtp-<id>`) so inboxes stay
 *  isolated and switching is just a client rebuild. A new account is the next HD
 *  index off the single app mnemonic (createSmartAccount). Legacy on-device
 *  records (a pre-smart-account 'generated'/'privateKey'/'walletconnect' row, or
 *  the pre-multi-account single key under `wallet.privateKey`) are still read +
 *  signed for backward compatibility, but no new such records are ever created. */

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
 *  module only owns the non-secret registry rows (list + active pointer). The
 *  keyring still owns the legacy-key migration + per-account key deletion. */
import { adoptLegacyKey, deleteKey, clearLegacyKey } from './zerodev/keyring';
import { LEGACY_DB_DIR } from '@stage-labs/client/accounts/keys';
import { resolveActiveAccount } from '@stage-labs/client/accounts/registry';

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

/** The ACTIVE account as a viem signer, or null when it has no stored in-app key
 *  — i.e. a `smart` account (signs via the Kernel) or a legacy `walletconnect`
 *  record. Callers route smart accounts through the Kernel client. Resolves
 *  through getViemAccount, which self-heals a legacy `wallet.privateKey` into the
 *  per-account slot for the backward-compat local-EOA records. */
export async function getActiveViemAccount(): Promise<PrivateKeyAccount | null> {
  const rec = await getActiveAccount();
  if (!rec || rec.type === 'smart' || rec.type === 'walletconnect') return null;
  return getViemAccount(rec.id);
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
  id: string, patch: Partial<Pick<AccountRecord, 'deployed' | 'scwXmtp' | 'passkeyCredId' | 'passkey' | 'passkeySudo' | 'label' | 'guardians' | 'guardianThreshold' | 'guardianDelay'>>,
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
