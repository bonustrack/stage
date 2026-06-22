
import { computed, type ComputedRef, type Ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import {
  resolveCommonChannels, type CommonChannel, type CommonChannelRow,
} from '@stage-labs/client/xmtp/commonChannels';
import { convOfLine, lineOfConv, groupMemberEthAddresses } from './xmtp';
import { cachedRows, hydrateCachedRows } from './channelsCache';
import { loadArchivedIds } from './archived';
import { accountEpoch } from './accounts';

const memberSetByConvAndEpoch = new Map<string, string[]>();

function memberSetOf(epoch: number): (convId: string) => Promise<string[]> {
  return async (convId: string): Promise<string[]> => {
    const key = `${convId}:${epoch}`;
    const cached = memberSetByConvAndEpoch.get(key);
    if (cached) return cached;
    const conv = await convOfLine(lineOfConv(convId));
    if (!conv) return [];
    const members = await groupMemberEthAddresses(conv);
    memberSetByConvAndEpoch.set(key, members);
    return members;
  };
}

async function resolve(peerAddress: string, epoch: number): Promise<CommonChannel[]> {
  hydrateCachedRows();
  const rows = (cachedRows.value ?? []) as CommonChannelRow[];
  const archived = loadArchivedIds();
  return resolveCommonChannels(peerAddress, rows, memberSetOf(epoch), archived);
}

export function useCommonChannels(
  peerAddress: Ref<string | null>,
  enabled: Ref<boolean>,
): { channels: ComputedRef<CommonChannel[]>; loading: ComputedRef<boolean> } {
  const peer = computed(() => peerAddress.value?.toLowerCase() ?? '');
  const isEnabled = computed(() => enabled.value && !!peer.value);
  const { data, isLoading } = useQuery({
    queryKey: ['commonChannels', computed(() => accountEpoch.value), peer],
    queryFn: () => resolve(peer.value, accountEpoch.value),
    enabled: isEnabled,
    staleTime: 5 * 60_000,
  });
  return {
    channels: computed(() => data.value ?? []),
    loading: computed(() => (isEnabled.value ? isLoading.value : false)),
  };
}
