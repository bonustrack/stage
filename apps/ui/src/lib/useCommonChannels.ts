
import { computed, type ComputedRef, type Ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import {
  resolveCommonChannels, createMemberSetCache,
  type CommonChannel, type CommonChannelRow,
} from '@stage-labs/client/xmtp/commonChannels';
import { convOfLine, lineOfConv, groupMemberEthAddresses } from './xmtp';
import { cachedRows, hydrateCachedRows } from './channelsCache';
import { loadArchivedIds } from './archived';
import { accountEpoch } from './accounts';

const memberSetCache = createMemberSetCache();

async function fetchMembers(convId: string): Promise<string[]> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return [];
  return groupMemberEthAddresses(conv);
}

async function resolve(peerAddress: string, epoch: number): Promise<CommonChannel[]> {
  hydrateCachedRows();
  const rows = (cachedRows.value ?? []) as CommonChannelRow[];
  const archived = loadArchivedIds();
  const memberSetOf = memberSetCache.resolver(epoch, fetchMembers);
  return resolveCommonChannels(peerAddress, rows, memberSetOf, archived);
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
