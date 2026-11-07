import { useQuery } from '@tanstack/react-query';
import { sdk } from './xmtp.sdk';
import { getCachedRows } from './channelsCache';
import { listedConvRow } from './messaging/convRow.model';
import { accountQueryKeyAt, useAccountGeneration } from './queryClient';
import { usePeerProfiles } from './peerProfiles';

const CHAT_STALE_MS = 5 * 60_000;

export interface StoredChat {
  peerAddress: string | null;
  groupName: string;
}

async function storedChatOf(convId: string): Promise<StoredChat | null> {
  const listed = listedConvRow(getCachedRows(), convId);
  if (listed !== undefined) return { peerAddress: listed.peerAddress, groupName: listed.groupName ?? '' };
  const client = await sdk.client();
  const conv = await sdk.findConv(client, convId);
  if (!conv) return null;
  const peer = sdk.dmPeerInboxId(conv);
  if (peer === null) return { peerAddress: null, groupName: (await sdk.groupInfo(conv)).name };
  const [address] = await sdk.ethAddressesOf(client, [await peer()]);
  return { peerAddress: address ?? null, groupName: '' };
}

export function useStoredChat(convId: string, recheckMs?: number): StoredChat | null {
  const epoch = useAccountGeneration('client');
  const { data } = useQuery({
    queryKey: accountQueryKeyAt('client', epoch, 'storageChat', convId),
    queryFn: () => storedChatOf(convId),
    staleTime: CHAT_STALE_MS,
    retry: false,
    refetchInterval: recheckMs === undefined ? undefined : (query) => (query.state.data ? false : recheckMs),
  });
  usePeerProfiles([data?.peerAddress ?? null]);
  return data ?? null;
}
