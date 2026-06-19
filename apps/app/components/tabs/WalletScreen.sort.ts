/** Pure (JSX-free) row transform for the Wallet Tokens tab — extracted from
 *  WalletScreen.tokens so it's directly unit-testable under bun:test without
 *  pulling in the React/JSX runtime, and so the list component can memoize a
 *  referentially-stable result (the memoized TokenRow only skips work when this
 *  output is stable across renders). */

import type { AssetRow } from './WalletScreen.assets';

/** Stable, deterministic key for a row — `pub|priv:chainId:symbol`. Used as the
 *  React list key and the token-detail route id. */
export function tokenRowId(r: AssetRow): string {
  return `${r.isPrivate ? 'priv' : 'pub'}:${r.chainId}:${r.symbol}`;
}

/** Merge public + shielded → drop zero-balance → rank by USD value DESC,
 *  returning each surviving row paired with its stable id. `.sort` is stable
 *  (V8/Hermes) so equal-value rows keep their original public-then-private
 *  order. Inputs are not mutated. */
export function buildSortedTokenRows(
  rows: AssetRow[],
  privateRows: AssetRow[],
): { r: AssetRow; id: string }[] {
  return [...rows, ...privateRows]
    .filter(r => Number(r.balance) > 0)
    .map(r => ({ r, usdValue: (r.priceUsd ?? 0) * Number(r.balance) }))
    .sort((a, b) => b.usdValue - a.usdValue)
    .map(({ r }) => ({ r, id: tokenRowId(r) }));
}
