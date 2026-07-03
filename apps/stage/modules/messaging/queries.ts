
import { useQuery } from '@tanstack/react-query';
import { getQueryClient } from '../../lib/queryClient';
import { fetchConvMeta, fetchGroupRoles, type ConvMeta, EMPTY_CONV_META } from './convMeta.fetch';

export const messagingKeys = {
  all: ['xmtp'] as const,
  convMeta: (convId: string | null | undefined) =>
    ['xmtp', 'convMeta', convId ?? ''] as const,
  channels: (account: string) => ['xmtp', 'channels', account] as const,
  messages: (account: number, line: string) =>
    ['xmtp', 'messages', account, line] as const,
} as const;

export type { ConvMeta };
export { EMPTY_CONV_META, fetchConvMeta, fetchGroupRoles };

export function useConvMeta(convId?: string | null): ConvMeta {
  const { data } = useQuery({
    queryKey: messagingKeys.convMeta(convId),
    queryFn: () => fetchConvMeta(convId ?? ''),
    enabled: !!convId,
    staleTime: 5 * 60_000,
  });
  return data ?? EMPTY_CONV_META;
}

export function invalidateConvMeta(convId: string): void {
  void getQueryClient().invalidateQueries({ queryKey: messagingKeys.convMeta(convId) });
}
