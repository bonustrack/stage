/** Typed TanStack-Query key factory + hooks for the messaging data sources
 *  (stage 1 of the cache unification). Aligns the key style with the existing
 *  profiles queries and gives the stream/cache bridges ONE place to look up the
 *  keys they invalidate / setQueryData against.
 *
 *  Stage 1 migrates the LOW-RISK sources only:
 *    - convMeta  (['xmtp','convMeta',convId]) - DM peer / group name+image+desc+
 *                members. Previously fetched TWICE (useConvMeta AND the group
 *                screen's loadGroupDetail); now both read this one query.
 *    - channels  (['xmtp','channels',account]) - the per-account channels list,
 *                backed by the existing channelsCache (kept ALIVE as the fetcher/
 *                source of truth) but exposed through Query so reads dedupe + get
 *                stale-while-revalidate.
 *
 *  The message FEED + store retirement are deferred to stage 2; railgun caches
 *  are out of scope (proposal #5). The old stores stay live alongside this. */

import { useQuery } from '@tanstack/react-query';
import { getQueryClient } from '../../lib/queryClient';
import { getActiveAccountIdSync } from '../../lib/channelsCache';
import { fetchConvMeta, fetchGroupRoles, type ConvMeta, EMPTY_CONV_META } from './convMeta.fetch';

/** Key factory. Reference these instead of hand-writing array literals so a key
 *  rename is a single edit and TS catches arg mistakes at the call site. */
export const messagingKeys = {
  all: ['xmtp'] as const,
  convMeta: (convId: string | null | undefined) =>
    ['xmtp', 'convMeta', convId ?? ''] as const,
  channels: (account: string) => ['xmtp', 'channels', account] as const,
} as const;

export type { ConvMeta };
export { EMPTY_CONV_META, fetchConvMeta, fetchGroupRoles };

/** Conversation metadata, deduped + cached by convId. Second open of a conv (or
 *  the group-info screen) hits cache instead of re-resolving from the SDK. */
export function useConvMeta(convId?: string | null): ConvMeta {
  const { data } = useQuery({
    queryKey: messagingKeys.convMeta(convId),
    queryFn: () => fetchConvMeta(convId as string),
    enabled: !!convId,
    staleTime: 5 * 60_000,
  });
  return data ?? EMPTY_CONV_META;
}

/** Imperative read of cached conv metadata (no subscription). Used by non-render
 *  call sites that want whatever Query already has without triggering a fetch. */
export function getCachedConvMeta(convId: string): ConvMeta | undefined {
  return getQueryClient().getQueryData<ConvMeta>(messagingKeys.convMeta(convId));
}

/** Invalidate a conv's metadata so the next observer refetches (group rename /
 *  image / description change, or a streamed group-updated event). */
export function invalidateConvMeta(convId: string): void {
  void getQueryClient().invalidateQueries({ queryKey: messagingKeys.convMeta(convId) });
}

/** The active account's channels-list key. Channels are scoped per account so
 *  switching back to an account hits its own Query cache entry. */
export function activeChannelsKey(): readonly [string, string, string] {
  return messagingKeys.channels(getActiveAccountIdSync());
}
