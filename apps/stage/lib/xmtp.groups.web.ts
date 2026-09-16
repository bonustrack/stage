import { ConsentState, Group, IdentifierKind, type Conversation, type Identifier } from '@xmtp/browser-sdk';
import {
  createGroupWith, addGroupMembersWith, requireValidMembers, type CreateGroupResult,
} from '@stage-labs/client/xmtp/groups';
import { convOfLine, xmtpClient } from './xmtp.client.web';
import { lineOfConv } from './xmtp.types';
import { groupMeta, notAGroup, requireConv, NO_GROUP_ADMINS, type GroupAdmins, type GroupInfo, type GroupMeta } from './xmtp.groups.core';

function identifiersOf(addresses: string[]): Identifier[] {
  return addresses.map(a => ({ identifier: a.toLowerCase(), identifierKind: IdentifierKind.Ethereum }));
}

function asGroup(conv: Conversation): Group {
  return conv instanceof Group ? conv : notAGroup();
}

export async function createGroup(addresses: string[], name?: string, imageUrl?: string): Promise<CreateGroupResult> {
  const client = await xmtpClient();
  const meta = groupMeta(name, imageUrl);
  const opts = { groupName: meta.name, groupImageUrlSquare: meta.imageUrl };
  return createGroupWith(addresses, lineOfConv, (members) =>
    client.conversations.createGroupWithIdentifiers(identifiersOf(members), opts));
}

export async function addGroupMembers(convId: string, addresses: string[]): Promise<void> {
  requireValidMembers(addresses);
  const group = asGroup(requireConv(await convOfLine(lineOfConv(convId))));
  await addGroupMembersWith(addresses, (members) => group.addMembersByIdentifiers(identifiersOf(members)));
}

export async function removeGroupMembers(convId: string, addresses: string[]): Promise<void> {
  const group = asGroup(requireConv(await convOfLine(lineOfConv(convId))));
  await group.removeMembersByIdentifiers(identifiersOf(addresses));
}

export async function updateGroupMeta(convId: string, patch: GroupMeta & { description?: string }): Promise<void> {
  const group = asGroup(requireConv(await convOfLine(lineOfConv(convId))));
  if (patch.name !== undefined) await group.updateName(patch.name);
  if (patch.imageUrl !== undefined) await group.updateImageUrl(patch.imageUrl);
  if (patch.description !== undefined) await group.updateDescription(patch.description);
}

export function groupAdminInboxIds(conv: unknown): Promise<GroupAdmins> {
  if (!(conv instanceof Group)) return Promise.resolve(NO_GROUP_ADMINS);
  return Promise.resolve({ admins: conv.admins, superAdmins: conv.superAdmins });
}

export function groupNameImage(conv: unknown): Promise<GroupInfo> {
  if (!(conv instanceof Group)) return Promise.resolve({ name: '', imageUrl: '', description: '' });
  return Promise.resolve({ name: conv.name ?? '', imageUrl: conv.imageUrl ?? '', description: conv.description ?? '' });
}

export async function leaveGroupConv(line: string): Promise<'left' | 'hidden'> {
  const conv = requireConv(await convOfLine(line));
  const selfInboxId = (await xmtpClient()).inboxId;
  if (conv instanceof Group && selfInboxId) {
    try {
      await conv.removeMembers([selfInboxId]);
      await conv.updateConsentState(ConsentState.Denied).catch(() => undefined);
      return 'left';
    } catch { }
  }
  await conv.updateConsentState(ConsentState.Denied);
  return 'hidden';
}
