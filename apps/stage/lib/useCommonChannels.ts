import { useQuery } from '@tanstack/react-query';
import { getCachedRows, hydrateCachedRows } from './channelsCache';
import { convOfLine } from './xmtp.find';
import { convMembers } from './xmtp.identity';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { channelAvatar } from './convIdentity';
import { getAccountEpoch } from './accountEpoch';
import {
  resolveCommonChannels,
  createMemberSetCache,
  type CommonChannel,
  type CommonChannelRow,
} from '@stage-labs/client/xmtp/commonChannels';
import { reported } from './errorPolicy';
import { useKnownActiveAccountId } from './accountSelection';
import { accountQueryKeyAt, useAccountGeneration } from './queryClient';

const memberSetCache = createMemberSetCache();

async function fetchMembers(convId: string): Promise<string[]> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return [];
  return (await convMembers(conv)).otherAddresses;
}

async function resolveChannels(peerAddress: string): Promise<CommonChannel[]> {
  await hydrateCachedRows().catch(reported('commonChannels.hydrate'));
  const rows: CommonChannelRow[] = getCachedRows() ?? [];
  const memberSetOf = memberSetCache.resolver(getAccountEpoch(), fetchMembers);
  return resolveCommonChannels(peerAddress, rows, memberSetOf, (row) => channelAvatar(row.convId, row.avatarUri).avatarAddress);
}

export function useCommonChannels(peerAddress: string | null): { channels: CommonChannel[]; loading: boolean } {
  const active = !!peerAddress;
  const selection = useAccountGeneration('selection');
  const accountId = useKnownActiveAccountId();
  const { data, isLoading } = useQuery({
    queryKey: accountQueryKeyAt('selection', selection, 'commonChannels', accountId, peerAddress?.toLowerCase() ?? ''),
    queryFn: () => resolveChannels(peerAddress ?? ''),
    enabled: active,
    staleTime: 5 * 60_000,
  });
  return { channels: data ?? [], loading: active && isLoading };
}
