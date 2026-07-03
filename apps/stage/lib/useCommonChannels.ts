
import { useQuery } from '@tanstack/react-query';
import { getCachedRows, hydrateCachedRows, getActiveAccountIdSync } from './channelsCache';
import { convOfLine, groupMemberEthAddresses, lineOfConv } from './xmtp';
import { channelStampSeed } from '@stage-labs/kit/avatar';
import { getAccountEpoch } from './accountEpoch';
import {
  resolveCommonChannels, createMemberSetCache,
  type CommonChannel, type CommonChannelRow,
} from '@stage-labs/client/xmtp/commonChannels';
import { loadArchivedIds } from './archived';

const memberSetCache = createMemberSetCache();

async function fetchMembers(convId: string): Promise<string[]> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return [];
  return groupMemberEthAddresses(conv);
}

function avatarSeedOf(row: CommonChannelRow): string {
  return channelStampSeed(row.convId);
}

async function resolveChannels(peerAddress: string): Promise<CommonChannel[]> {
  await hydrateCachedRows().catch(() => undefined);
  const archived = await loadArchivedIds().catch(() => new Set<string>());
  const rows = (getCachedRows() ?? []) as CommonChannelRow[];
  const memberSetOf = memberSetCache.resolver(getAccountEpoch(), fetchMembers);
  return resolveCommonChannels(peerAddress, rows, memberSetOf, archived, avatarSeedOf);
}

export function useCommonChannels(peerAddress: string | null, enabled: boolean): {
  channels: CommonChannel[];
  loading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: ['commonChannels', getActiveAccountIdSync(), peerAddress?.toLowerCase() ?? ''],
    queryFn: () => resolveChannels(peerAddress ?? ''),
    enabled: enabled && !!peerAddress,
    staleTime: 5 * 60_000,
  });
  return { channels: data ?? [], loading: (enabled && !!peerAddress) ? isLoading : false };
}
