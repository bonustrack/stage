import { zeroAddress } from 'viem';
import { ASSETS, NATIVE_TOKEN_SENTINEL, type Asset, type AssetRow } from './assets';

export function isNativeToken(token: string | null | undefined): boolean {
  if (!token) return true;
  const t = token.toLowerCase();
  return t === NATIVE_TOKEN_SENTINEL || t === zeroAddress;
}

function isSentinelOrEmpty(token: string | null | undefined): token is null | undefined | '' {
  return !token || token.toLowerCase() === NATIVE_TOKEN_SENTINEL;
}

function assetFor(chainId: number, token: string | null | undefined): Asset | undefined {
  if (isSentinelOrEmpty(token)) return ASSETS.find((a) => a.chainId === chainId && a.address === null);
  const lc = token.toLowerCase();
  return ASSETS.find((a) => a.chainId === chainId && a.address?.toLowerCase() === lc);
}

export interface TokenStampArgs {
  chainId: number;
  contract: string;
}

export function tokenStampArgs(chainId: number, token: string | null | undefined): TokenStampArgs {
  if (isSentinelOrEmpty(token)) return { chainId, contract: NATIVE_TOKEN_SENTINEL };
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
