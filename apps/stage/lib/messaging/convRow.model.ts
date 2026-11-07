import type { CachedRow } from '../cachedRows.model';

export interface ConvRow {
  peerAddress: string | null;
  groupName?: string;
  avatarUri: string | null;
  inboxToAddr: Record<string, string>;
  selfInboxId: string;
}

export interface ConvDetails {
  description: string;
  assigned: string[];
  assignedReady: boolean;
}

export const NO_DETAILS: ConvDetails = { description: '', assigned: [], assignedReady: false };

const NO_ADDRESSES: string[] = [];

export function listedConvRow(rows: readonly CachedRow[] | null, convId: string): ConvRow | undefined {
  const row = rows?.find((r) => r.convId === convId);
  if (row === undefined || row.peerAddress === '') return undefined;
  const { peerAddress, groupName, avatarUri, inboxToAddr, selfInboxId } = row;
  return { peerAddress, groupName, avatarUri, inboxToAddr, selfInboxId };
}

export async function rowCreatedTs<C extends { id: string }>(
  conv: C,
  rowId: string,
  cached: unknown,
  lookup: (id: string) => Promise<C | null>,
  createdAtNs: (conv: C) => number,
): Promise<number | null> {
  if (conv.id !== rowId && typeof cached === 'number' && Number.isFinite(cached) && cached > 0) return cached;
  const source = conv.id === rowId ? conv : await lookup(rowId);
  const ns = source === null ? 0 : createdAtNs(source);
  return Number.isFinite(ns) && ns >= 1_000_000 ? Math.floor(ns / 1_000_000) : null;
}

function sameRecord(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}

export function sameConvRow(a: ConvRow, b: ConvRow): boolean {
  return (
    a.peerAddress === b.peerAddress &&
    a.groupName === b.groupName &&
    a.avatarUri === b.avatarUri &&
    a.selfInboxId === b.selfInboxId &&
    sameRecord(a.inboxToAddr, b.inboxToAddr)
  );
}

export function isGroupRow(row: ConvRow | null): boolean {
  return row !== null && row.peerAddress === null;
}

export function memberAddressesOf(row: ConvRow | null): string[] {
  if (row === null || row.peerAddress !== null) return NO_ADDRESSES;
  return Object.entries(row.inboxToAddr)
    .filter(([inboxId]) => inboxId !== row.selfInboxId)
    .map(([, addr]) => addr);
}
