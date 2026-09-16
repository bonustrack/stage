import { Group, PublicIdentity, type Conversation } from '@xmtp/react-native-sdk';
import {
  createGroupWith, addGroupMembersWith, requireValidMembers, type CreateGroupResult,
} from '@stage-labs/client/xmtp/groups';
import { convOfLine, xmtpClient } from './xmtp.client';
import { lineOfConv } from './xmtp.types';
import { groupMeta, notAGroup, requireConv, NO_GROUP_ADMINS, type GroupAdmins, type GroupInfo, type GroupMeta } from './xmtp.groups.core';

function identitiesOf(addresses: string[]): PublicIdentity[] {
  return addresses.map(a => new PublicIdentity(a, 'ETHEREUM'));
}

function asGroup(conv: Conversation): Group {
  return conv instanceof Group ? conv : notAGroup();
}

export async function createGroup(addresses: string[], name?: string, imageUrl?: string): Promise<CreateGroupResult> {
  const client = await xmtpClient();
  const opts = groupMeta(name, imageUrl);
  return createGroupWith(addresses, lineOfConv, (members) =>
    client.conversations.newGroupWithIdentities(identitiesOf(members), opts));
}

export async function addGroupMembers(convId: string, addresses: string[]): Promise<void> {
  requireValidMembers(addresses);
  const group = asGroup(requireConv(await convOfLine(lineOfConv(convId))));
  await addGroupMembersWith(addresses, (members) => group.addMembersByIdentity(identitiesOf(members)));
}

export async function removeGroupMembers(convId: string, addresses: string[]): Promise<void> {
  const group = asGroup(requireConv(await convOfLine(lineOfConv(convId))));
  await group.removeMembersByIdentity(identitiesOf(addresses));
}

export async function updateGroupMeta(convId: string, patch: GroupMeta & { description?: string }): Promise<void> {
  const group = asGroup(requireConv(await convOfLine(lineOfConv(convId))));
  if (patch.name !== undefined) await group.updateName(patch.name);
  if (patch.imageUrl !== undefined) await group.updateImageUrl(patch.imageUrl);
  if (patch.description !== undefined) await group.updateDescription(patch.description);
}

export async function groupAdminInboxIds(conv: unknown): Promise<GroupAdmins> {
  if (!(conv instanceof Group)) return NO_GROUP_ADMINS;
  const [admins, superAdmins] = await Promise.all([
    conv.listAdmins().catch(() => [] as string[]),
    conv.listSuperAdmins().catch(() => [] as string[]),
  ]);
  return { admins, superAdmins };
}

export async function groupNameImage(conv: unknown): Promise<GroupInfo> {
  if (!(conv instanceof Group)) return { name: '', imageUrl: '', description: '' };
  const [name, imageUrl, description] = await Promise.all([
    conv.name().catch(() => ''), conv.imageUrl().catch(() => ''), conv.description().catch(() => ''),
  ]);
  return { name, imageUrl, description };
}

export async function leaveGroupConv(line: string): Promise<'left' | 'hidden'> {
  const group = asGroup(requireConv(await convOfLine(line)));
  try {
    await group.leaveGroup();
    await group.updateConsent('denied').catch(() => undefined);
    return 'left';
  } catch { }
  await group.updateConsent('denied');
  return 'hidden';
}
