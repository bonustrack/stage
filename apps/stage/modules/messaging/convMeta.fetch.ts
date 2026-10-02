
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { convOfLine, sdk } from '../../lib/xmtp.sdk';
import {
  peerEthAddressOfDm, groupMemberEthAddresses, memberInboxToAddressMap,
} from '../../lib/xmtp.identity';
import { groupRoleOf, superAdminInboxIds, type GroupRole } from '@stage-labs/client/xmtp/groups';
import { groupAssignedOf } from '@stage-labs/client/xmtp/labels';
import { recover } from '../../lib/errorPolicy';

export interface ConvMeta {
  peerAddr: string | null;
  isGroup: boolean;
  groupName: string | null;
  groupImage: string;
  groupDescription: string;
  memberAddrs: string[];
  assigned: string[];
  assignedReady: boolean;
  inboxToAddr: Record<string, string>;
}

export const EMPTY_CONV_META: ConvMeta = {
  peerAddr: null, isGroup: false, groupName: null, groupImage: '',
  groupDescription: '', memberAddrs: [], assigned: [], assignedReady: false, inboxToAddr: {},
};

async function fetchGroupConvMeta(
  conv: Parameters<typeof groupMemberEthAddresses>[0],
  inboxToAddr: Record<string, string>,
): Promise<ConvMeta> {
  const [members, meta, assigned] = await Promise.all([
    groupMemberEthAddresses(conv),
    sdk.groupInfo(conv),
    groupAssignedOf(conv).catch(recover<string[] | null>('xmtp.groupAssigned', null)),
  ]);
  return {
    peerAddr: null, isGroup: true, groupName: meta.name, groupImage: meta.imageUrl,
    groupDescription: meta.description, memberAddrs: members, assigned: assigned ?? [], assignedReady: assigned !== null, inboxToAddr,
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
): Promise<Record<string, GroupRole>> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return {};
  const staff = await sdk.groupAdmins(conv);
  const roles: Record<string, GroupRole> = {};
  for (const [inboxId, addr] of Object.entries(inboxToAddr)) roles[addr] = groupRoleOf(inboxId, staff);
  return roles;
}

export async function fetchSuperAdmins(convId: string, inboxToAddr: Record<string, string>): Promise<ReadonlySet<string>> {
  return superAdminInboxIds(inboxToAddr, await fetchGroupRoles(convId, inboxToAddr));
}
