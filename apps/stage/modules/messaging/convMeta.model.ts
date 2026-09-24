import type { ConvMeta } from './convMeta.fetch';

interface CachedRowLike {
  convId: string;
  peerAddress?: unknown;
  inboxToAddr?: unknown;
}

function stringRecord(value: unknown): Record<string, string> {
  if (value === null || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value).filter((e): e is [string, string] => typeof e[1] === 'string'));
}

export function convMetaFromCachedRow(
  rows: readonly CachedRowLike[] | null, convId: string, empty: ConvMeta,
): ConvMeta | undefined {
  const row = rows?.find((r) => r.convId === convId);
  if (row === undefined || typeof row.peerAddress !== 'string' || row.peerAddress === '') return undefined;
  return { ...empty, peerAddr: row.peerAddress, inboxToAddr: stringRecord(row.inboxToAddr) };
}
