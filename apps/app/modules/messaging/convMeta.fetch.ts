
import { lineOfConv } from '../../lib/xmtp.types';
import { convOfLine } from '../../lib/xmtp.client';
import {
  peerEthAddressOfDm, groupMemberEthAddresses, memberInboxToAddressMap,
} from '../../lib/xmtp.identity';

export interface ConvMeta {
  peerAddr: string | null;
  isGroup: boolean;
  groupName: string | null;
  groupImage: string;
  groupDescription: string;
  memberAddrs: string[];
  inboxToAddr: Record<string, string>;
}

export const EMPTY_CONV_META: ConvMeta = {
  peerAddr: null, isGroup: false, groupName: null, groupImage: '',
  groupDescription: '', memberAddrs: [], inboxToAddr: {},
};

interface GroupMetaAccessor {
  name?: () => Promise<string>;
  imageUrl?: () => Promise<string>;
  description?: () => Promise<string>;
}

async function fetchGroupConvMeta(
  conv: Parameters<typeof groupMemberEthAddresses>[0],
  inboxToAddr: Record<string, string>,
): Promise<ConvMeta> {
  const g = conv as unknown as GroupMetaAccessor;
  const [members, name, image, description] = await Promise.all([
    groupMemberEthAddresses(conv),
    g.name?.() ?? Promise.resolve(''),
    g.imageUrl?.().catch(() => '') ?? Promise.resolve(''),
    g.description?.().catch(() => '') ?? Promise.resolve(''),
  ]);
  return {
    peerAddr: null, isGroup: true, groupName: name ?? '', groupImage: image ?? '',
    groupDescription: description ?? '', memberAddrs: members, inboxToAddr,
  };
}

export async function fetchConvMeta(convId: string): Promise<ConvMeta> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return EMPTY_CONV_META;
  const [peer, inboxToAddr] = await Promise.all([
    peerEthAddressOfDm(conv),
    memberInboxToAddressMap(conv),
  ]);
  if (peer) return { ...EMPTY_CONV_META, peerAddr: peer, inboxToAddr };
  return fetchGroupConvMeta(conv, inboxToAddr);
}

export async function fetchGroupRoles(
  convId: string,
  inboxToAddr: Record<string, string>,
): Promise<Record<string, 'owner' | 'admin' | 'member'>> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return {};
  const group = conv as unknown as {
    listSuperAdmins?: () => Promise<string[]>;
    listAdmins?: () => Promise<string[]>;
  };
  const [supers, admins] = await Promise.all([
    group.listSuperAdmins?.().catch(() => [] as string[]) ?? Promise.resolve([] as string[]),
    group.listAdmins?.().catch(() => [] as string[]) ?? Promise.resolve([] as string[]),
  ]);
  const superSet = new Set(supers.map(s => s.toLowerCase()));
  const adminSet = new Set(admins.map(a => a.toLowerCase()));
  const roles: Record<string, 'owner' | 'admin' | 'member'> = {};
  for (const [inboxId, addr] of Object.entries(inboxToAddr)) {
    const iid = inboxId.toLowerCase();
    roles[addr] = superSet.has(iid) ? 'owner' : adminSet.has(iid) ? 'admin' : 'member';
  }
  return roles;
}
