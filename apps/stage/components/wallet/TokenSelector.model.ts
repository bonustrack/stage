import { base } from 'viem/chains';

export function sendableOnAccount<T extends { chainId: number }>(rows: T[], smartAccount: boolean): T[] {
  return smartAccount ? rows.filter(r => r.chainId === base.id) : rows;
}
