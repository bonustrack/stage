/**
 * @file Typed TanStack-Query key factory + hooks for the messaging data sources (convMeta and channels keys), giving the stream/cache bridges one place to look up the keys they invalidate or setQueryData against.
 */

import { useQuery } from '@tanstack/react-query';
import { getQueryClient } from '../../lib/queryClient';
import { fetchConvMeta, fetchGroupRoles, type ConvMeta, EMPTY_CONV_META } from './convMeta.fetch';

/** Key factory. Reference these instead of hand-writing array literals so a key rename is a single edit and TS catches arg mistakes at the call site. */
export const messagingKeys = {
  all: ['xmtp'] as const,
  convMeta: (convId: string | null | undefined) =>
    ['xmtp', 'convMeta', convId ?? ''] as const,
  channels: (account: string) => ['xmtp', 'channels', account] as const,
  /**
   * A conversation's message feed, scoped to the active account (epoch) + the
   *  conv line. The in-channel feed AND the channels-list last-message preview
   *  both read this ONE cache, so a streamed message that lands here surfaces in
   *  both atomically (the desync class #375 patched at open-time). The epoch is
   *  part of the key so an in-place account switch (which clears feedCache)
   *  cannot leak the previous inbox's slice into the new account's view.
   */
  messages: (account: number, line: string) =>
    ['xmtp', 'messages', account, line] as const,
} as const;

export type { ConvMeta };
export { EMPTY_CONV_META, fetchConvMeta, fetchGroupRoles };

/** Conversation metadata, deduped + cached by convId. Second open of a conv (or the group-info screen) hits cache instead of re-resolving from the SDK. */
export function useConvMeta(convId?: string | null): ConvMeta {
  const { data } = useQuery({
    queryKey: messagingKeys.convMeta(convId),
    queryFn: () => fetchConvMeta(convId ?? ''),
    enabled: !!convId,
    staleTime: 5 * 60_000,
  });
  return data ?? EMPTY_CONV_META;
}

/** Invalidate a conv's metadata so the next observer refetches (group rename / image / description change, or a streamed group-updated event). */
export function invalidateConvMeta(convId: string): void {
  void getQueryClient().invalidateQueries({ queryKey: messagingKeys.convMeta(convId) });
}
