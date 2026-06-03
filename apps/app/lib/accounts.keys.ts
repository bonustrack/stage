/** Private-key storage + signer resolution for the account registry
 *  (see accounts.ts). Split out to keep accounts.ts under the line cap.
 *
 *  Keys for the local account types live in expo-secure-store keyed by address
 *  (`wallet.pk.<id>`); a pre-multi-account build kept a single key under
 *  `wallet.privateKey`, which getPrivateKey self-heals into the per-account slot. */

import './cryptoShim';
import * as SecureStore from 'expo-secure-store';
import { mnemonicToAccount, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { bytesToHex, type Hex } from 'viem';
import type { AccountRecord } from './accounts.types';

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

/** Derive the raw private key from a BIP-39 mnemonic (default m/44'/60'/0'/0/0,
 *  the standard first Ethereum account). Throws if the phrase is not valid
 *  BIP-39. We extract the key so the account is stored + signed identically to
 *  a pasted private key (no special-case HD signer to maintain). */
export function privateKeyFromMnemonic(input: string): Hex {
  const phrase = input.trim().replace(/\s+/g, ' ').toLowerCase();
  const words = phrase.split(' ');
  if (![12, 15, 18, 21, 24].includes(words.length)) {
    throw new Error('Invalid recovery phrase — expected 12–24 words.');
  }
  let key: Uint8Array | null | undefined;
  try {
    key = mnemonicToAccount(phrase).getHdKey().privateKey;
  } catch {
    throw new Error('Invalid recovery phrase — failed BIP-39 check.');
  }
  if (!key) throw new Error('Could not derive a key from that phrase.');
  return bytesToHex(key);
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
