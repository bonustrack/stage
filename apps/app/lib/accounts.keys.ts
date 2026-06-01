/** Private-key storage + signer resolution for the account registry
 *  (see accounts.ts). Split out to keep accounts.ts under the line cap.
 *
 *  Keys for the local account types live in expo-secure-store keyed by address
 *  (`wallet.pk.<id>`); a pre-multi-account build kept a single key under
 *  `wallet.privateKey`, which getPrivateKey self-heals into the per-account slot. */

import './cryptoShim';
import * as SecureStore from 'expo-secure-store';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import type { Hex } from 'viem';
import type { AccountRecord } from './accounts';

export const PK_PREFIX = 'wallet.pk.';
/** Pre-multi-account single-key location + its XMTP db dir. */
export const LEGACY_PK_KEY = 'wallet.privateKey';
export const LEGACY_DB_DIR = 'xmtp';

/** Accept a private key with or without the `0x` prefix and any case; return a
 *  normalized lowercase `0x…` 32-byte hex, or throw if it isn't 64 hex chars. */
export function normalizePk(input: string): Hex {
  let pk = input.trim();
  if (pk.startsWith('0X')) pk = '0x' + pk.slice(2);
  if (!pk.startsWith('0x')) pk = '0x' + pk;
  pk = '0x' + pk.slice(2).toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(pk)) {
    throw new Error('Invalid private key — expected 64 hex characters.');
  }
  return pk as Hex;
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

export function canExportPrivateKey(rec: AccountRecord): boolean {
  return rec.type !== 'walletconnect';
}
