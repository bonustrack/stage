/** Pure private-key normalization + derivation rules for the account registry.
 *  No storage, no platform deps — viem only. Key STORAGE stays in the host
 *  behind the injected SecureStorage interface (see ./registry).
 *
 *  Moved out of apps/app's accounts.keys for the Stage SDK; the app re-exports
 *  these so call sites stay stable. */

import { mnemonicToAccount, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { bytesToHex, type Hex } from 'viem';
import type { AccountRecord } from './types';

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

/** A viem signer from a raw private key. */
export function viemAccountFromPk(pk: Hex): PrivateKeyAccount {
  return privateKeyToAccount(pk);
}

/** The lowercased account id (storage key + record id) for a private key. */
export function accountIdFromPk(pk: Hex): string {
  return privateKeyToAccount(pk).address.toLowerCase();
}

export function canExportPrivateKey(rec: AccountRecord): boolean {
  return rec.type !== 'walletconnect';
}
