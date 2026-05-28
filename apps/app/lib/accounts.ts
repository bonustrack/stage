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
import {
  generatePrivateKey, privateKeyToAccount, mnemonicToAccount,
  type PrivateKeyAccount,
} from 'viem/accounts';
import type { Hex } from 'viem';
import { clearCachedRows } from './channelsCache';

export type AccountType = 'generated' | 'privateKey' | 'walletconnect' | 'mnemonic';

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
  /** For 'mnemonic' accounts: BIP-44 address index this account was derived at
   *  (path m/44'/60'/0'/0/<index>). Lets the UI show "Account #i" and dedup the
   *  scan against accounts already imported from the same seed. */
  hdIndex?: number;
  createdAt: number;
}

const LIST_KEY = 'accounts.list';
const ACTIVE_KEY = 'accounts.active';
const PK_PREFIX = 'wallet.pk.';
/** The single imported BIP-39 seed phrase, stored once in SecureStore (secure
 *  enclave on iOS / keystore on Android). Never logged, never leaves the device.
 *  Derived accounts also stash their own derived private key under PK_PREFIX so
 *  signing goes through the same `getPrivateKey` path as every other local
 *  account — the mnemonic is kept only so the user can derive further accounts. */
const MNEMONIC_KEY = 'wallet.mnemonic';
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
  const prev = await SecureStore.getItemAsync(ACTIVE_KEY).catch(() => null);
  await SecureStore.setItemAsync(ACTIVE_KEY, id);
  /** Switching to a different account: wipe the global channels cache so the
   *  reload doesn't momentarily show the previous account's channels/avatars. */
  if (prev && prev !== id) clearCachedRows();
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

/** Normalize a pasted BIP-39 mnemonic: trim, collapse runs of whitespace, and
 *  lowercase (the wordlist is all-lowercase). Throws when it isn't a plausible
 *  12/15/18/21/24-word phrase. viem's `mnemonicToAccount` does the real
 *  checksum/word validation at derivation time. */
export function normalizeMnemonic(input: string): string {
  const phrase = input.trim().replace(/\s+/g, ' ').toLowerCase();
  const words = phrase ? phrase.split(' ') : [];
  if (![12, 15, 18, 21, 24].includes(words.length)) {
    throw new Error('Invalid seed phrase — expected 12, 15, 18, 21, or 24 words.');
  }
  return phrase;
}

/** Stash the imported seed phrase in SecureStore. Overwrites any previous one
 *  (the app holds a single seed). Validates the phrase by deriving index 0. */
export async function storeMnemonic(input: string): Promise<void> {
  const phrase = normalizeMnemonic(input);
  /** Throws on a bad checksum / unknown word before we persist anything. */
  mnemonicToAccount(phrase, { addressIndex: 0 });
  await SecureStore.setItemAsync(MNEMONIC_KEY, phrase);
}

/** The stored seed phrase, or null when none has been imported. Handle with
 *  care — never log or surface this. */
export async function getMnemonic(): Promise<string | null> {
  return SecureStore.getItemAsync(MNEMONIC_KEY).catch(() => null);
}

/** True once a seed phrase has been imported (used to gate "derive more"). */
export async function hasMnemonic(): Promise<boolean> {
  return !!(await getMnemonic());
}

/** Derive the EOA at BIP-44 path m/44'/60'/0'/0/<index> from a mnemonic, without
 *  persisting anything. Used by the scanner to probe addresses for activeness
 *  before the user commits to importing them. */
export function deriveAddressAtIndex(mnemonic: string, index: number): string {
  return mnemonicToAccount(mnemonic, { addressIndex: index }).address;
}

/** Import one account derived from a mnemonic at the given address index. Stores
 *  the derived private key under PK_PREFIX (so it signs like any other local
 *  account) and tags the record with its hdIndex. The mnemonic must already be
 *  stored via `storeMnemonic`. Does NOT change the active account — the caller
 *  decides which imported account to switch to. */
export async function importMnemonicAccount(index: number): Promise<AccountRecord> {
  const mnemonic = await getMnemonic();
  if (!mnemonic) throw new Error('No seed phrase stored — import one first.');
  const hd = mnemonicToAccount(mnemonic, { addressIndex: index });
  const pk = hd.getHdKey().privateKey;
  if (!pk) throw new Error('Could not derive the private key for this account.');
  const pkHex = ('0x' + Buffer.from(pk).toString('hex')) as Hex;
  const id = hd.address.toLowerCase();
  const list = await loadAccounts();
  const existing = list.find(a => a.id === id);
  if (existing) return existing;
  await SecureStore.setItemAsync(PK_PREFIX + id, pkHex);
  const rec: AccountRecord = {
    id, address: hd.address, type: 'mnemonic', dbDir: `xmtp-${id}`,
    registered: false, hdIndex: index, createdAt: Date.now(),
  };
  await persist([...list, rec]);
  return rec;
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
  await SecureStore.deleteItemAsync(MNEMONIC_KEY).catch(() => undefined);
  cache = null;
  return list;
}

/** Drop the in-memory cache so the next read re-hydrates from SecureStore. */
export function invalidateAccountsCache(): void { cache = null; }
