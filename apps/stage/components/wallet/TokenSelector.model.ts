import { base, mainnet } from 'viem/chains';

export function sendableOnAccount<T extends { chainId: number }>(rows: T[], smartAccount: boolean): T[] {
  return smartAccount ? rows.filter(r => r.chainId === base.id) : rows;
}

export function fallbackSendToken(smartAccount: boolean): { symbol: string; chainId: number } {
  return { symbol: 'ETH', chainId: smartAccount ? base.id : mainnet.id };
}
