import { useCallback } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import type { GroupEditRights, GroupRole } from '@stage-labs/client/xmtp/groups';
import { getAccountEpoch } from '../accountEpoch';
import { accountQueryKeyAt, getQueryClient, useAccountGeneration } from '../queryClient';
import { getCachedRows, subscribeCachedRows } from '../channelsCache';
import { groupEditRights, refreshGroupRow } from '../xmtp.groups';
import { useStoreValue } from '../storeCore';
import { fetchConvRow } from './conversation';
import { fetchConvDetails, fetchGroupRoles } from './groupDetails';
import { NO_DETAILS, isGroupRow, listedConvRow, sameConvRow, type ConvDetails, type ConvRow } from './convRow.model';

function convKey<const K extends readonly unknown[]>(account: number, convId: string | null | undefined, ...rest: K) {
  return accountQueryKeyAt('client', account, 'xmtp', 'conv', convId ?? '', ...rest);
}

const messagingKeys = {
  conv: (account: number, convId: string | null | undefined) => convKey(account, convId),
  convRow: (account: number, convId: string | null | undefined) => convKey(account, convId, 'row'),
  convDetails: (account: number, convId: string | null | undefined) => convKey(account, convId, 'details'),
  groupEditRights: (account: number, convId: string | null | undefined) => convKey(account, convId, 'editRights'),
  groupRoles: (account: number, convId: string | null | undefined, inboxIds: readonly string[]) =>
    convKey(account, convId, 'roles', [...inboxIds].sort().join(',')),
} as const;

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

function convRowOptions(account: number, convId: string, listed: boolean) {
  return {
    queryKey: messagingKeys.convRow(account, convId),
    queryFn: () => fetchConvRow(convId),
    enabled: !!convId && !listed,
    staleTime: STALE_MS,
  };
}

export function useConvRow(convId?: string | null): ConvRow | null {
  const id = convId ?? '';
  const account = useAccountGeneration('client');
  const listed = useListedRow(id);
  const { data } = useQuery(convRowOptions(account, id, listed !== undefined));
  return listed ?? data ?? null;
}

export function useConvRows(convIds: readonly string[]): (ConvRow | null)[] {
  const account = useAccountGeneration('client');
  const rows = useStoreValue(subscribeCachedRows, getCachedRows);
  const listed = convIds.map((id) => listedConvRow(rows, id));
  const fetched = useQueries({ queries: convIds.map((id, i) => convRowOptions(account, id, listed[i] !== undefined)) });
  return convIds.map((_, i) => listed[i] ?? fetched[i]?.data ?? null);
}

export function useConvDetails(convId: string | null | undefined, row: ConvRow | null): ConvDetails {
  const account = useAccountGeneration('client');
  const { data } = useQuery({
    queryKey: messagingKeys.convDetails(account, convId),
    queryFn: () => fetchConvDetails(convId ?? ''),
    enabled: !!convId && isGroupRow(row),
    staleTime: STALE_MS,
  });
  return data ?? NO_DETAILS;
}

const NO_ROLES: Record<string, GroupRole> = {};

export function useChannelRoles(convId: string | undefined, inboxToAddr: Record<string, string>): Record<string, GroupRole> {
  const account = useAccountGeneration('client');
  const inboxIds = Object.keys(inboxToAddr);
  const { data = NO_ROLES } = useQuery({
    queryKey: messagingKeys.groupRoles(account, convId, inboxIds),
    queryFn: () => fetchGroupRoles(convId ?? '', inboxToAddr),
    enabled: !!convId && inboxIds.length > 0,
  });
  return data;
}

const NO_EDIT_RIGHTS: GroupEditRights = {
  name: false,
  description: false,
  image: false,
  appData: false,
  addMembers: false,
  removeMembers: false,
};

export function useChannelEditRights(convId: string | undefined, enabled = true): GroupEditRights {
  const account = useAccountGeneration('client');
  const { data = NO_EDIT_RIGHTS } = useQuery({
    queryKey: messagingKeys.groupEditRights(account, convId),
    queryFn: () => groupEditRights(convId ?? ''),
    enabled: enabled && !!convId,
  });
  return data;
}

export function patchConvDetails(convId: string, patch: Partial<ConvDetails>): void {
  const queryClient = getQueryClient();
  const account = getAccountEpoch();
  queryClient.setQueryData<ConvDetails>(messagingKeys.convDetails(account, convId), (d) => (d ? { ...d, ...patch } : d));
  void queryClient.invalidateQueries({ queryKey: messagingKeys.conv(account, convId) });
}

export function refreshConv(convId: string): void {
  void getQueryClient().invalidateQueries({ queryKey: messagingKeys.conv(getAccountEpoch(), convId) });
  refreshGroupRow(convId);
}
