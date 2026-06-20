
import { mnemonicToAccount, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { bytesToHex, type Hex } from 'viem';
import type { AccountRecord } from './types';

export const PK_PREFIX = 'wallet.pk.';
export const LEGACY_PK_KEY = 'wallet.privateKey';
export const LEGACY_DB_DIR = 'xmtp';

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

export function viemAccountFromPk(pk: Hex): PrivateKeyAccount {
  return privateKeyToAccount(pk);
}

export function accountIdFromPk(pk: Hex): string {
  return privateKeyToAccount(pk).address.toLowerCase();
}

export function canExportPrivateKey(rec: AccountRecord): boolean {
  return rec.type === 'generated' || rec.type === 'privateKey';
}
