
import { generateMnemonic, mnemonicToAccount, english, type HDAccount } from 'viem/accounts';

export function ownerDerivationPath(index: number): `m/44'/60'/0'/0/${string}` {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error('HD index must be a non-negative integer.');
  }
  return `m/44'/60'/0'/0/${index}`;
}

export function generateWalletMnemonic(): string {
  return generateMnemonic(english);
}

export function normalizeMnemonic(phrase: string): string {
  return phrase.trim().replace(/\s+/g, ' ').toLowerCase();
}

const WORD_COUNTS: readonly number[] = [12, 15, 18, 21, 24];

export function isValidMnemonic(phrase: string): boolean {
  const norm = normalizeMnemonic(phrase);
  return WORD_COUNTS.includes(norm.split(' ').length) && WORD_COUNTS.includes(norm.normalize('NFKD').split(' ').length);
}

export function deriveOwner(mnemonic: string, index: number): HDAccount {
  const phrase = normalizeMnemonic(mnemonic);
  if (!isValidMnemonic(phrase)) {
    throw new Error('Invalid recovery phrase: failed BIP-39 check.');
  }
  return mnemonicToAccount(phrase, { path: ownerDerivationPath(index) });
}
