
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { convOfLine, sdk } from '../../lib/xmtp.sdk';
import { convMembers, type ConvMembers } from '../../lib/xmtp.identity';
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
  conv: Parameters<typeof convMembers>[0],
  { otherAddresses, inboxToAddr }: ConvMembers,
): Promise<ConvMeta> {
  const [meta, assigned] = await Promise.all([
    sdk.groupInfo(conv),
    groupAssignedOf(conv).catch(recover<string[] | null>('xmtp.groupAssigned', null)),
  ]);
  return {
    peerAddr: null, isGroup: true, groupName: meta.name, groupImage: meta.imageUrl,
    groupDescription: meta.description, memberAddrs: otherAddresses, assigned: assigned ?? [], assignedReady: assigned !== null, inboxToAddr,
  };
}

export async function fetchConvMeta(convId: string): Promise<ConvMeta> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return EMPTY_CONV_META;
  const members = await convMembers(conv);
  if (members.peerAddress) return { ...EMPTY_CONV_META, peerAddr: members.peerAddress, inboxToAddr: members.inboxToAddr };
  return fetchGroupConvMeta(conv, members);
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
