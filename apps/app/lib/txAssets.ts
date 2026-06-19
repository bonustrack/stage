/**
 * @file Pure asset-resolution helpers mapping a `(chainId, token)` pair to its display logo URL and CoinGecko price key for the tx/sign cards + simulation, derived from the shared static registry so cards match the wallet token list.
 *  No React, no network, no key material — bytes in, descriptors out (unit-testable without RN).
 */

import { ASSETS, NATIVE_TOKEN_SENTINEL } from '@stage-labs/client/wallet/assets';
import { stampTokenUrl } from '@metro-labs/kit/avatar';

/** Find the registry row for `(chainId, token)`. `null`/native sentinel token => the chain's native (ETH) row. */
function assetFor(chainId: number, token: string | null | undefined) {
  const isNative = !token || token.toLowerCase() === NATIVE_TOKEN_SENTINEL.toLowerCase();
  if (isNative) return ASSETS.find(a => a.chainId === chainId && a.address === null);
  const lc = token.toLowerCase();
  return ASSETS.find(a => a.chainId === chainId && a.address?.toLowerCase() === lc);
}

/**
 * The logo URL to show for `(chainId, token)`:
 *   - native ETH      -> the ETH sentinel logo,
 *   - a KNOWN ERC-20  -> the registry `logoAddress` (e.g. STAGE's own contract),
 *   - an UNKNOWN token -> a NEUTRAL generic coin glyph (never the ETH logo).
 *  `token` of null/undefined/native-sentinel is treated as native ETH.
 */
export function tokenLogoUrl(
  chainId: number, token: string | null | undefined, displayPx: number,
): string {
  const isNative = !token || token.toLowerCase() === NATIVE_TOKEN_SENTINEL.toLowerCase();
  if (isNative) return stampTokenUrl(chainId, NATIVE_TOKEN_SENTINEL, displayPx);
  const hit = assetFor(chainId, token);
  if (hit) return stampTokenUrl(hit.chainId, hit.logoAddress, displayPx);
  // Unknown token: stamp.fyi has a per-contract identicon; if it 404s the avatar
  // falls back to the border circle. Either way it is NOT the ETH logo.
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

/**
 * Resolve the CoinGecko price descriptor for `(chainId, token)` from the
 *  registry. Native => its cgId; a known ERC-20 with a cgPlatform => its
 *  (priceAddress|address, platform). Unknown token or a token with no price
 *  listing (e.g. STAGE) => null, so the card shows the amount with NO $ (never a
 *  fake or zero value).
 */
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
