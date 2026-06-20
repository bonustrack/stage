/** @file Pure asset-resolution helpers mapping a `(chainId, token)` pair to its display logo URL and CoinGecko price key for the tx/sign cards + simulation, derived from the shared static registry (no React, network, or key material) so cards match the wallet token list. */

import { ASSETS, NATIVE_TOKEN_SENTINEL } from '@stage-labs/client/wallet/assets';
import { stampTokenUrl } from '@metro-labs/kit/avatar';

/** Find the registry row for `(chainId, token)`. `null`/native sentinel token => the chain's native (ETH) row. */
function assetFor(chainId: number, token: string | null | undefined) {
  const isNative = !token || token.toLowerCase() === NATIVE_TOKEN_SENTINEL.toLowerCase();
  if (isNative) return ASSETS.find(a => a.chainId === chainId && a.address === null);
  const lc = token.toLowerCase();
  return ASSETS.find(a => a.chainId === chainId && a.address?.toLowerCase() === lc);
}

/** The logo URL for `(chainId, token)`: native/null/sentinel -> ETH sentinel logo, known ERC-20 -> registry logoAddress, unknown -> a neutral coin glyph (never the ETH logo). */
export function tokenLogoUrl(
  chainId: number, token: string | null | undefined, displayPx: number,
): string {
  const isNative = !token || token.toLowerCase() === NATIVE_TOKEN_SENTINEL.toLowerCase();
  if (isNative) return stampTokenUrl(chainId, NATIVE_TOKEN_SENTINEL, displayPx);
  const hit = assetFor(chainId, token);
  if (hit) return stampTokenUrl(hit.chainId, hit.logoAddress, displayPx);
  /** Unknown token: stamp.fyi serves a per-contract identicon (falling back to the border circle on 404), never the ETH logo. */
  return stampTokenUrl(chainId, token, displayPx);
}

/** Whether the unknown-token logo should defer to a neutral in-app glyph rather than a stamp.fyi identicon (caller decides). True only for unknown ERC-20s. */
export function isUnknownToken(chainId: number, token: string | null | undefined): boolean {
  const isNative = !token || token.toLowerCase() === NATIVE_TOKEN_SENTINEL.toLowerCase();
  if (isNative) return false;
  return !assetFor(chainId, token);
}

/** How to price an asset via CoinGecko: either a native coin id (`simple/price`) or an ERC-20 contract on a platform (`token_price/<platform>`). `null` = no known price source (registry has no cgId/cgPlatform — show amount only). */
export type PriceKey =
  | { kind: 'native'; cgId: string }
  | { kind: 'erc20'; platform: string; contract: string }
  | null;

/** Resolves the CoinGecko price descriptor for `(chainId, token)` from the registry: native -> its cgId, known ERC-20 with cgPlatform -> its (priceAddress|address, platform), otherwise null so the card shows the amount with no $ (never a fake value). */
export function priceKeyFor(chainId: number, token: string | null | undefined): PriceKey {
  const a = assetFor(chainId, token);
  if (!a) return null;
  if (a.address === null) return a.cgId ? { kind: 'native', cgId: a.cgId } : null;
  if (a.cgPlatform) {
    return { kind: 'erc20', platform: a.cgPlatform, contract: (a.priceAddress ?? a.address).toLowerCase() };
  }
  return null;
}

/** A stable cache/map key for a PriceKey (used by the price layer). */
export function priceKeyId(k: PriceKey): string | null {
  if (!k) return null;
  return k.kind === 'native' ? `native:${k.cgId}` : `erc20:${k.platform}:${k.contract}`;
}
