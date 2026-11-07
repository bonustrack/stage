import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { sdk } from '../xmtp.sdk';
import { convOfLine } from '../xmtp.find';
import { groupRoleOf, superAdminInboxIds, type GroupRole } from '@stage-labs/client/xmtp/groups';
import { groupAssignedOf } from '@stage-labs/client/xmtp/channelMeta';
import { recover } from '../errorPolicy';
import { NO_DETAILS, type ConvDetails } from './convRow.model';

export async function fetchConvDetails(convId: string): Promise<ConvDetails> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv || !sdk.isGroup(conv)) return NO_DETAILS;
  const [info, assigned] = await Promise.all([
    sdk.groupInfo(conv),
    groupAssignedOf(sdk.appDataGroup(conv)).catch(recover<string[] | null>('xmtp.groupAssigned', null)),
  ]);
  return { description: info.description, assigned: assigned ?? [], assignedReady: assigned !== null };
}

export async function fetchGroupRoles(convId: string, inboxToAddr: Record<string, string>): Promise<Record<string, GroupRole>> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return {};
  const staff = await sdk.groupAdmins(conv);
  return Object.fromEntries(Object.entries(inboxToAddr).map(([inboxId, addr]) => [addr, groupRoleOf(inboxId, staff)]));
}

export async function fetchSuperAdmins(convId: string, inboxToAddr: Record<string, string>): Promise<ReadonlySet<string>> {
  return superAdminInboxIds(inboxToAddr, await fetchGroupRoles(convId, inboxToAddr));
}
