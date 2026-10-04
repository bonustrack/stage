
import { isErc6492Signature, isHex, parseErc6492Signature, type Hex } from 'viem';
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
    throw new Error('Invalid private key: expected 64 hex characters.');
  }
  return pk as Hex;
}

export function canExportPrivateKey(rec: AccountRecord): boolean {
  return rec.type === 'generated' || rec.type === 'privateKey';
}

export async function stableOwnerSignature(message: string, signOwnerMessage: (message: string) => Promise<Hex>): Promise<Hex> {
  const [first, second] = await Promise.all([signOwnerMessage(message), signOwnerMessage(message)]);
  if (!isHex(first) || first.toLowerCase() !== second.toLowerCase()) {
    throw new Error('This signer does not give the same signature twice, so it cannot derive a stable key.');
  }
  return isErc6492Signature(first) ? parseErc6492Signature(first).signature : first;
}
