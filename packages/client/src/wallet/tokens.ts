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
  return `${r.chainId}:${r.symbol}`;
}

export function isNativeTokenRow(r: { chainId: number; symbol: string }): boolean {
  return ASSETS.some(a => a.address === null && a.chainId === r.chainId && a.symbol === r.symbol);
}

export function nativeTokenChainIds(): number[] {
  return [...new Set(ASSETS.filter(a => a.address === null).map(a => a.chainId))];
}

export function isListedTokenRow(
  r: { chainId: number; symbol: string; balance: string },
  nativeChainIds: readonly number[] = [],
): boolean {
  if (Number(r.balance) > 0) return true;
  return nativeChainIds.includes(r.chainId) && isNativeTokenRow(r);
}

export function buildSortedTokenRows(
  rows: AssetRow[],
  nativeChainIds: readonly number[] = [],
): { r: AssetRow; id: string }[] {
  return [...rows]
    .filter(r => isListedTokenRow(r, nativeChainIds))
    .map(r => ({ r, usdValue: (r.priceUsd ?? 0) * Number(r.balance) }))
    .sort((a, b) => b.usdValue - a.usdValue)
    .map(({ r }) => ({ r, id: tokenRowId(r) }));
}
