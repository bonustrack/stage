import { useQuery } from '@tanstack/react-query';
import { getCachedRows, hydrateCachedRows, getActiveAccountIdSync } from './channelsCache';
import { convOfLine } from './xmtp.sdk';
import { convMembers } from './xmtp.identity';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { channelStampSeed } from '@stage-labs/kit/avatar';
import { getAccountEpoch } from './accountEpoch';
import {
  resolveCommonChannels, createMemberSetCache,
  type CommonChannel, type CommonChannelRow,
} from '@stage-labs/client/xmtp/commonChannels';
import { reported } from './errorPolicy';

const memberSetCache = createMemberSetCache();

async function fetchMembers(convId: string): Promise<string[]> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return [];
  return (await convMembers(conv)).otherAddresses;
}

async function resolveChannels(peerAddress: string): Promise<CommonChannel[]> {
  await hydrateCachedRows().catch(reported('commonChannels.hydrate'));
  const rows = (getCachedRows() ?? []) as CommonChannelRow[];
  const memberSetOf = memberSetCache.resolver(getAccountEpoch(), fetchMembers);
  return resolveCommonChannels(peerAddress, rows, memberSetOf, row => channelStampSeed(row.convId));
}

export function useCommonChannels(peerAddress: string | null): {
  channels: CommonChannel[];
  loading: boolean;
} {
  const active = !!peerAddress;
  const { data, isLoading } = useQuery({
    queryKey: ['commonChannels', getActiveAccountIdSync(), peerAddress?.toLowerCase() ?? ''],
    queryFn: () => resolveChannels(peerAddress ?? ''),
    enabled: active,
    staleTime: 5 * 60_000,
  });
  return { channels: data ?? [], loading: active && isLoading };
}
