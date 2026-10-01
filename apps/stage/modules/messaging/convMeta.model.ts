import type { ConvMeta } from './convMeta.fetch';

interface CachedRowLike {
  convId: string;
  peerAddress?: unknown;
  inboxToAddr?: unknown;
  groupName?: unknown;
  avatarUri?: unknown;
  selfInboxId?: unknown;
}

function stringRecord(value: unknown): Record<string, string> {
  if (value === null || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value).filter((e): e is [string, string] => typeof e[1] === 'string'));
}

function groupFromRow(row: CachedRowLike, inboxToAddr: Record<string, string>, empty: ConvMeta): ConvMeta {
  return {
    ...empty,
    isGroup: true,
    groupName: typeof row.groupName === 'string' ? row.groupName : null,
    groupImage: typeof row.avatarUri === 'string' ? row.avatarUri : '',
    memberAddrs: Object.entries(inboxToAddr).filter(([inboxId]) => inboxId !== row.selfInboxId).map(([, addr]) => addr),
    inboxToAddr,
  };
}

export function convMetaFromCachedRow(
  rows: readonly CachedRowLike[] | null, convId: string, empty: ConvMeta,
): ConvMeta | undefined {
  const row = rows?.find((r) => r.convId === convId);
  if (row === undefined) return undefined;
  const inboxToAddr = stringRecord(row.inboxToAddr);
  if (row.peerAddress === null) return groupFromRow(row, inboxToAddr, empty);
  if (typeof row.peerAddress !== 'string' || row.peerAddress === '') return undefined;
  return { ...empty, peerAddr: row.peerAddress, inboxToAddr };
}
