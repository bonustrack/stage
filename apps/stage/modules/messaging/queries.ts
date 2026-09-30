
import { useQueries, useQuery } from '@tanstack/react-query';
import { getQueryClient } from '../../lib/queryClient';
import { fetchConvMeta, fetchGroupRoles, type ConvMeta, EMPTY_CONV_META } from './convMeta.fetch';
import { convMetaFromCachedRow } from './convMeta.model';
import { getCachedRows } from './cache';

export const messagingKeys = {
  all: ['xmtp'] as const,
  convMeta: (convId: string | null | undefined) =>
    ['xmtp', 'convMeta', convId ?? ''] as const,
  groupEditRights: (convId: string | null | undefined) =>
    ['xmtp', 'convMeta', convId ?? '', 'editRights'] as const,
  groupRoles: (convId: string | null | undefined, inboxIds: readonly string[]) =>
    ['xmtp', 'convMeta', convId ?? '', 'roles', [...inboxIds].sort().join(',')] as const,
  messages: (account: number, line: string) =>
    ['xmtp', 'messages', account, line] as const,
} as const;

export { fetchGroupRoles };

function convMetaOptions(convId?: string | null) {
  return {
    queryKey: messagingKeys.convMeta(convId),
    queryFn: () => fetchConvMeta(convId ?? ''),
    placeholderData: () => convMetaFromCachedRow(getCachedRows(), convId ?? '', EMPTY_CONV_META),
    enabled: !!convId,
    staleTime: 5 * 60_000,
  };
}

export function useConvMeta(convId?: string | null): ConvMeta {
  const { data } = useQuery(convMetaOptions(convId));
  return data ?? EMPTY_CONV_META;
}

export function useConvMetas(convIds: readonly string[]): ConvMeta[] {
  return useQueries({ queries: convIds.map(convMetaOptions) }).map(result => result.data ?? EMPTY_CONV_META);
}

export function invalidateConvMeta(convId: string): void {
  void getQueryClient().invalidateQueries({ queryKey: messagingKeys.convMeta(convId) });
}
