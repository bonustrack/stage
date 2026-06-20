
import { ASSETS, NATIVE_TOKEN_SENTINEL } from '@stage-labs/client/wallet/assets';
import { stampTokenUrl } from '@stage-labs/kit/avatar';

function assetFor(chainId: number, token: string | null | undefined) {
  const isNative = !token || token.toLowerCase() === NATIVE_TOKEN_SENTINEL.toLowerCase();
  if (isNative) return ASSETS.find(a => a.chainId === chainId && a.address === null);
  const lc = token.toLowerCase();
  return ASSETS.find(a => a.chainId === chainId && a.address?.toLowerCase() === lc);
}

export function tokenLogoUrl(
  chainId: number, token: string | null | undefined, displayPx: number,
): string {
  const isNative = !token || token.toLowerCase() === NATIVE_TOKEN_SENTINEL.toLowerCase();
  if (isNative) return stampTokenUrl(chainId, NATIVE_TOKEN_SENTINEL, displayPx);
  const hit = assetFor(chainId, token);
  if (hit) return stampTokenUrl(hit.chainId, hit.logoAddress, displayPx);
  return stampTokenUrl(chainId, token, displayPx);
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
