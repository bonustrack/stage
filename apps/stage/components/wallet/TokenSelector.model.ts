import { WALLET_ASSETS, WALLET_CHAIN_ID } from '@stage-labs/client/wallet/assets';

export function sendTokenFor(symbol?: string, chainId?: string): { symbol: string; chainId: number } {
  const cid = chainId ? Number(chainId) : WALLET_CHAIN_ID;
  const hit = WALLET_ASSETS.find(a => a.symbol === symbol && a.chainId === cid);
  return { symbol: hit?.symbol ?? 'ETH', chainId: WALLET_CHAIN_ID };
}
