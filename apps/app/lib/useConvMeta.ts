/** TanStack Query for a conversation's metadata (DM peer / group name + image +
 *  members). Cached by convId so the topnav title + avatar appear instantly on
 *  the second open instead of resolving from scratch each time. */

import { useQuery } from '@tanstack/react-query';
import {
  lineOfConv, convOfLine, peerEthAddressOfDm,
  groupMemberEthAddresses, memberInboxToAddressMap,
} from './xmtp';

export interface ConvMeta {
  peerAddr: string | null;
  isGroup: boolean;
  /** null = not resolved yet, '' = group with no name, else the name. */
  groupName: string | null;
  groupImage: string;
  memberAddrs: string[];
  inboxToAddr: Record<string, string>;
}

const EMPTY: ConvMeta = {
  peerAddr: null, isGroup: false, groupName: null, groupImage: '', memberAddrs: [], inboxToAddr: {},
};

async function fetchConvMeta(convId: string): Promise<ConvMeta> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return EMPTY;
  const [peer, inboxToAddr] = await Promise.all([
    peerEthAddressOfDm(conv),
    memberInboxToAddressMap(conv),
  ]);
  if (peer) return { ...EMPTY, peerAddr: peer, inboxToAddr };
  const g = conv as unknown as { name?: () => Promise<string>; imageUrl?: () => Promise<string> };
  const [members, name, image] = await Promise.all([
    groupMemberEthAddresses(conv),
    g.name?.() ?? Promise.resolve(''),
    g.imageUrl?.().catch(() => '') ?? Promise.resolve(''),
  ]);
  return { peerAddr: null, isGroup: true, groupName: name ?? '', groupImage: image ?? '', memberAddrs: members, inboxToAddr };
}

export function useConvMeta(convId?: string | null): ConvMeta {
  const { data } = useQuery({
    queryKey: ['convMeta', convId ?? ''],
    queryFn: () => fetchConvMeta(convId as string),
    enabled: !!convId,
    staleTime: 5 * 60_000,
  });
  return data ?? EMPTY;
}
