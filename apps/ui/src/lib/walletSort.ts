import type { AssetRow } from '@stage-labs/client/wallet/assets';

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
