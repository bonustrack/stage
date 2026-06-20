/** @file Pure viem-only HD-derivation rules turning (single app mnemonic, index) deterministically into per-index owner EOAs that back ZeroDev Kernel accounts via path m/44'/60'/0'/0/<index>; mnemonic storage stays in the host. */

import { generateMnemonic, mnemonicToAccount, english, type HDAccount } from 'viem/accounts';

/** The standard Ethereum BIP-44 derivation path for a given account index. */
export function ownerDerivationPath(index: number): `m/44'/60'/0'/0/${string}` {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error('HD index must be a non-negative integer.');
  }
  return `m/44'/60'/0'/0/${index}`;
}

/** Generate a fresh 12-word BIP-39 mnemonic (128-bit entropy). Used once on first launch; the host persists it hardened. */
export function generateWalletMnemonic(): string {
  return generateMnemonic(english);
}

/** Lowercase, single-spaced — the canonical form we derive/validate on. */
export function normalizeMnemonic(phrase: string): string {
  return phrase.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** True iff the phrase is a valid BIP-39 mnemonic. viem's `mnemonicToAccount` runs the wordlist + checksum check and throws on a bad phrase; we reuse it so no extra bip39 dep is pulled in (matches accounts/keys.ts which derives via the same path). */
export function isValidMnemonic(phrase: string): boolean {
  const words = normalizeMnemonic(phrase).split(' ');
  if (![12, 15, 18, 21, 24].includes(words.length)) return false;
  try {
    mnemonicToAccount(normalizeMnemonic(phrase));
    return true;
  } catch {
    return false;
  }
}

/** Derive the owner HD account (a viem signer) for a smart-account index off the app mnemonic. Throws on an invalid phrase. The returned account both signs (ECDSA validator) and pins the deterministic Kernel address via its index. */
export function deriveOwner(mnemonic: string, index: number): HDAccount {
  const phrase = normalizeMnemonic(mnemonic);
  if (!isValidMnemonic(phrase)) {
    throw new Error('Invalid recovery phrase — failed BIP-39 check.');
  }
  /** Explicit path keeps derivation auditable and matches the spec verbatim (equivalent to { addressIndex: index }). */
  return mnemonicToAccount(phrase, { path: ownerDerivationPath(index) });
}

/** The owner address (lowercased) for an index — handy for record bookkeeping without holding the signer. */
export function ownerAddress(mnemonic: string, index: number): string {
  return deriveOwner(mnemonic, index).address.toLowerCase();
}
