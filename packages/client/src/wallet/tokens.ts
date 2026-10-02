import { ASSETS, NATIVE_TOKEN_SENTINEL, type Asset, type AssetRow } from './assets';

function assetFor(chainId: number, token: string | null | undefined): Asset | undefined {
  const isNative = !token || token.toLowerCase() === NATIVE_TOKEN_SENTINEL.toLowerCase();
  if (isNative) return ASSETS.find(a => a.chainId === chainId && a.address === null);
  const lc = token.toLowerCase();
  return ASSETS.find(a => a.chainId === chainId && a.address?.toLowerCase() === lc);
}

export interface TokenStampArgs {
  chainId: number;
  contract: string;
}

export function tokenStampArgs(chainId: number, token: string | null | undefined): TokenStampArgs {
  const isNative = !token || token.toLowerCase() === NATIVE_TOKEN_SENTINEL.toLowerCase();
  if (isNative) return { chainId, contract: NATIVE_TOKEN_SENTINEL };
  const hit = assetFor(chainId, token);
  if (hit) return { chainId: hit.chainId, contract: hit.logoAddress };
  return { chainId, contract: token };
}

export function priceIdFor(chainId: number, token: string | null | undefined): string | null {
  return assetFor(chainId, token)?.priceId ?? null;
}

export function tokenRowId(r: AssetRow): string {
  return `${r.chainId}:${r.symbol}`;
}
