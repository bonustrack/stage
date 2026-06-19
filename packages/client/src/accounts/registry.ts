/** Framework-agnostic registry RULES for the multi-account wallet. These are the
 *  pure decisions — how an AccountRecord is shaped, how the db dir is named, how
 *  a list mutates when adding / upgrading / removing an account, and which
 *  account is "active" given a possibly-stale pointer.
 *
 *  No storage, no platform deps. Key STORAGE + the SecureStore wiring stay in
 *  the host (apps/app's accounts.ts) which calls these rules and persists the
 *  results behind the injected SecureStorage interface. Logic lives here ONCE. */

import type { AccountRecord, AccountType } from './types';

/** Per-account XMTP sqlite dir name. Each account gets its own store so inboxes
 *  stay isolated and switching is just a client rebuild. */
export function dbDirFor(id: string): string {
  return `xmtp-${id}`;
}

/** Build a fresh local-account record (generated or imported key). */
export function buildLocalAccount(
  id: string,
  address: string,
  type: 'generated' | 'privateKey',
  now: number = Date.now(),
): AccountRecord {
  return { id, address, type, dbDir: dbDirFor(id), registered: false, createdAt: now };
}

/** Build a WalletConnect record — no key stored locally; signing is delegated. */
export function buildWalletConnectAccount(
  address: string,
  now: number = Date.now(),
): AccountRecord {
  const id = address.toLowerCase();
  return { id, address, type: 'walletconnect', dbDir: dbDirFor(id), registered: false, createdAt: now };
}

/** The outcome of adding a local key to a registry list — describes WHAT the
 *  host should persist, without doing any I/O itself. */
export interface AddLocalResult {
  /** The next account list to persist. */
  list: AccountRecord[];
  /** The record that is now active (newly added, existing, or upgraded). */
  record: AccountRecord;
  /** True when an existing WalletConnect account was upgraded to a local signer
   *  (the host should still write the key + flip the type). */
  upgraded: boolean;
}

/** Decide how the list changes when a local key for `id`/`address` is added.
 *
 *  - new id           → append a fresh local record
 *  - existing WC id   → UPGRADE to a local signer (flip type), keep other fields
 *  - existing local   → no list change, just re-activate
 *
 *  The host writes the key into SecureStorage in all branches and persists
 *  `list` when it differs. */
export function addLocalAccountToList(
  list: AccountRecord[],
  id: string,
  address: string,
  type: 'generated' | 'privateKey',
  now: number = Date.now(),
): AddLocalResult {
  const existing = list.find(a => a.id === id);
  if (existing) {
    if (existing.type === 'walletconnect') {
      const upgraded: AccountRecord = { ...existing, type };
      return { list: list.map(a => (a.id === id ? upgraded : a)), record: upgraded, upgraded: true };
    }
    return { list, record: existing, upgraded: false };
  }
  const rec = buildLocalAccount(id, address, type, now);
  return { list: [...list, rec], record: rec, upgraded: false };
}

/** The active record given the list + a (possibly stale/missing) active pointer.
 *  Falls back to the first account; null only when the registry is empty. */
export function resolveActiveAccount(
  list: AccountRecord[],
  activeId: string | null,
): AccountRecord | null {
  const first = list[0];
  if (first === undefined) return null;
  return list.find(a => a.id === activeId) ?? first;
}

/** Whether an account can sign in-app (has, or can have, a local key). A
 *  WalletConnect account signs remotely → false. */
export function canSignInApp(type: AccountType): boolean {
  return type !== 'walletconnect';
}
