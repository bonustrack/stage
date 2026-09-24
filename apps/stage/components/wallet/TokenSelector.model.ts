import { base, mainnet } from 'viem/chains';
import { isListedTokenRow, nativeTokenChainIds } from '@stage-labs/client/wallet/tokens';

export function sendableOnAccount<T extends { chainId: number }>(rows: T[], smartAccount: boolean): T[] {
  return smartAccount ? rows.filter(r => r.chainId === base.id) : rows;
}

export function listedNativeChains(smartAccount: boolean): number[] {
  return smartAccount ? [base.id] : nativeTokenChainIds();
}

export function listedSendableRows<T extends { chainId: number; symbol: string; balance: string }>(
  rows: T[],
  smartAccount: boolean,
): T[] {
  const natives = listedNativeChains(smartAccount);
  return sendableOnAccount(rows.filter(r => isListedTokenRow(r, natives)), smartAccount);
}

export function fallbackSendToken(smartAccount: boolean): { symbol: string; chainId: number } {
  return { symbol: 'ETH', chainId: smartAccount ? base.id : mainnet.id };
}
