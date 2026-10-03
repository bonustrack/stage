import { useCallback } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { getQueryClient } from '../../lib/queryClient';
import { getCachedRows, subscribeCachedRows } from '../../lib/channelsCache';
import { refreshGroupRow } from '../../lib/xmtp.groups';
import { useStoreValue } from '../../lib/storeCore';
import { fetchConvRow } from './conversation';
import { fetchConvDetails, fetchGroupRoles } from './groupDetails';
import { NO_DETAILS, isGroupRow, listedConvRow, sameConvRow, type ConvDetails, type ConvRow } from './convRow.model';

export const messagingKeys = {
  conv: (convId: string | null | undefined) =>
    ['xmtp', 'conv', convId ?? ''] as const,
  convRow: (convId: string | null | undefined) =>
    ['xmtp', 'conv', convId ?? '', 'row'] as const,
  convDetails: (convId: string | null | undefined) =>
    ['xmtp', 'conv', convId ?? '', 'details'] as const,
  groupEditRights: (convId: string | null | undefined) =>
    ['xmtp', 'conv', convId ?? '', 'editRights'] as const,
  groupRoles: (convId: string | null | undefined, inboxIds: readonly string[]) =>
    ['xmtp', 'conv', convId ?? '', 'roles', [...inboxIds].sort().join(',')] as const,
  messages: (account: number, line: string) =>
    ['xmtp', 'messages', account, line] as const,
} as const;

export { fetchGroupRoles };

const STALE_MS = 5 * 60_000;

const listedRows = new Map<string, ConvRow>();

function listedRowOf(convId: string): ConvRow | undefined {
  const next = listedConvRow(getCachedRows(), convId);
  const prev = listedRows.get(convId);
  if (next === undefined) {
    listedRows.delete(convId);
    return undefined;
  }
  if (prev !== undefined && sameConvRow(prev, next)) return prev;
  listedRows.set(convId, next);
  return next;
}

function useListedRow(convId: string): ConvRow | undefined {
  const get = useCallback(() => listedRowOf(convId), [convId]);
  return useStoreValue(subscribeCachedRows, get);
}

function convRowOptions(convId: string, listed: boolean) {
  return {
    queryKey: messagingKeys.convRow(convId),
    queryFn: () => fetchConvRow(convId),
    enabled: !!convId && !listed,
    staleTime: STALE_MS,
  };
}

export function useConvRow(convId?: string | null): ConvRow | null {
  const id = convId ?? '';
  const listed = useListedRow(id);
  const { data } = useQuery(convRowOptions(id, listed !== undefined));
  return listed ?? data ?? null;
}

export function useConvRows(convIds: readonly string[]): (ConvRow | null)[] {
  const rows = useStoreValue(subscribeCachedRows, getCachedRows);
  const listed = convIds.map(id => listedConvRow(rows, id));
  const fetched = useQueries({ queries: convIds.map((id, i) => convRowOptions(id, listed[i] !== undefined)) });
  return convIds.map((_, i) => listed[i] ?? fetched[i]?.data ?? null);
}

export function useConvDetails(convId: string | null | undefined, row: ConvRow | null): ConvDetails {
  const { data } = useQuery({
    queryKey: messagingKeys.convDetails(convId),
    queryFn: () => fetchConvDetails(convId ?? ''),
    enabled: !!convId && isGroupRow(row),
    staleTime: STALE_MS,
  });
  return data ?? NO_DETAILS;
}

export function patchConvDetails(convId: string, patch: Partial<ConvDetails>): void {
  const queryClient = getQueryClient();
  const key = messagingKeys.convDetails(convId);
  queryClient.setQueryData<ConvDetails>(key, d => (d ? { ...d, ...patch } : d));
  void queryClient.invalidateQueries({ queryKey: messagingKeys.conv(convId) });
}

export function refreshConv(convId: string): void {
  void getQueryClient().invalidateQueries({ queryKey: messagingKeys.conv(convId) });
  refreshGroupRow(convId);
}
