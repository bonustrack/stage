import { useQuery } from '@tanstack/react-query';
import { sdk } from './xmtp.sdk';
import { getCachedRows } from './channelsCache';
import { listedConvRow } from './messaging/convRow.model';
import { useAccountEpoch } from './accountEpoch';
import { peerLabel, usePeerProfiles } from './peerProfiles';
import { chatLabelOf, type StoredChatRef } from './storedChat.model';

const CHAT_STALE_MS = 5 * 60_000;

interface StoredChat {
  peerAddress: string | null;
  label: string;
}

async function storedChatOf(convId: string): Promise<StoredChatRef | null> {
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
  const epoch = useAccountEpoch();
  const { data } = useQuery({
    queryKey: ['storageChat', epoch, convId],
    queryFn: () => storedChatOf(convId),
    staleTime: CHAT_STALE_MS,
    retry: false,
    refetchInterval: recheckMs === undefined ? undefined : (query) => (query.state.data ? false : recheckMs),
  });
  const peer = data?.peerAddress ?? null;
  usePeerProfiles([peer]);
  if (data === null || data === undefined) return null;
  return { peerAddress: peer, label: chatLabelOf(data, peerLabel) };
}
