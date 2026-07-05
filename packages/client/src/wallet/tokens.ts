import { ASSETS, NATIVE_TOKEN_SENTINEL, type Asset, type AssetRow } from './assets';

export function assetFor(chainId: number, token: string | null | undefined): Asset | undefined {
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

export function isUnknownToken(chainId: number, token: string | null | undefined): boolean {
  const isNative = !token || token.toLowerCase() === NATIVE_TOKEN_SENTINEL.toLowerCase();
  if (isNative) return false;
  return !assetFor(chainId, token);
}

export type PriceKey =
  | { kind: 'native'; cgId: string }
  | { kind: 'erc20'; platform: string; contract: string }
  | null;

export function priceKeyFor(chainId: number, token: string | null | undefined): PriceKey {
  const a = assetFor(chainId, token);
  if (!a) return null;
  if (a.address === null) return a.cgId ? { kind: 'native', cgId: a.cgId } : null;
  if (a.cgPlatform) {
    return { kind: 'erc20', platform: a.cgPlatform, contract: (a.priceAddress ?? a.address).toLowerCase() };
  }
  return null;
}

export function priceKeyId(k: PriceKey): string | null {
  if (!k) return null;
  return k.kind === 'native' ? `native:${k.cgId}` : `erc20:${k.platform}:${k.contract}`;
}

export function tokenRowId(r: AssetRow): string {
  return `${r.isPrivate ? 'priv' : 'pub'}:${r.chainId}:${r.symbol}`;
}

export function buildSortedTokenRows(rows: AssetRow[]): { r: AssetRow; id: string }[] {
  return [...rows]
    .filter(r => Number(r.balance) > 0)
    .map(r => ({ r, usdValue: (r.priceUsd ?? 0) * Number(r.balance) }))
    .sort((a, b) => b.usdValue - a.usdValue)
    .map(({ r }) => ({ r, id: tokenRowId(r) }));
}
