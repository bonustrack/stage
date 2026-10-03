export interface ConvRow {
  peerAddress: string | null;
  groupName?: string;
  avatarUri: string | null;
  inboxToAddr: Record<string, string>;
  selfInboxId: string;
}

export interface ConvDetails { description: string; assigned: string[]; assignedReady: boolean }

export const NO_DETAILS: ConvDetails = { description: '', assigned: [], assignedReady: false };

const NO_ADDRESSES: string[] = [];

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

export function listedConvRow(rows: readonly CachedRowLike[] | null, convId: string): ConvRow | undefined {
  const row = rows?.find((r) => r.convId === convId);
  if (row === undefined) return undefined;
  const peer = row.peerAddress;
  if (peer !== null && (typeof peer !== 'string' || peer === '')) return undefined;
  return {
    peerAddress: peer,
    groupName: typeof row.groupName === 'string' ? row.groupName : undefined,
    avatarUri: typeof row.avatarUri === 'string' ? row.avatarUri : null,
    inboxToAddr: stringRecord(row.inboxToAddr),
    selfInboxId: typeof row.selfInboxId === 'string' ? row.selfInboxId : '',
  };
}

function sameRecord(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(k => a[k] === b[k]);
}

export function sameConvRow(a: ConvRow, b: ConvRow): boolean {
  return a.peerAddress === b.peerAddress && a.groupName === b.groupName && a.avatarUri === b.avatarUri
    && a.selfInboxId === b.selfInboxId && sameRecord(a.inboxToAddr, b.inboxToAddr);
}

export function isGroupRow(row: ConvRow | null): boolean {
  return row !== null && row.peerAddress === null;
}

export function memberAddressesOf(row: ConvRow | null): string[] {
  if (row === null || row.peerAddress !== null) return NO_ADDRESSES;
  return Object.entries(row.inboxToAddr).filter(([inboxId]) => inboxId !== row.selfInboxId).map(([, addr]) => addr);
}
