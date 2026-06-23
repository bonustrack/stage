
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

export function mnemonicWords(phrase: string): string[] {
  const normalized = normalizeMnemonic(phrase);
  return normalized ? normalized.split(' ') : [];
}

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

export function deriveOwner(mnemonic: string, index: number): HDAccount {
  const phrase = normalizeMnemonic(mnemonic);
  if (!isValidMnemonic(phrase)) {
    throw new Error('Invalid recovery phrase — failed BIP-39 check.');
  }
  return mnemonicToAccount(phrase, { path: ownerDerivationPath(index) });
}

export function ownerAddress(mnemonic: string, index: number): string {
  return deriveOwner(mnemonic, index).address.toLowerCase();
}
