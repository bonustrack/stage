import {
  createGroupWith, addGroupMembersWith, requireValidMembers, type CreateGroupResult,
} from '@stage-labs/client/xmtp/groups';
import { convOfLine, sdk } from './xmtp.sdk';
import { notAGroup, type GroupAdmins, type GroupInfo, type GroupMeta } from './xmtp.sdk.core';
import { lineOfConv } from './xmtp.types';

type GroupConv = NonNullable<Awaited<ReturnType<typeof convOfLine>>>;

function groupMeta(name?: string, imageUrl?: string): GroupMeta {
  const meta: GroupMeta = {};
  const trimmedName = name?.trim();
  if (trimmedName) meta.name = trimmedName;
  const trimmedImage = imageUrl?.trim();
  if (trimmedImage) meta.imageUrl = trimmedImage;
  return meta;
}

function requireConv<T>(conv: T | null): T {
  if (!conv) throw new Error('Conversation not found');
  return conv;
}

async function requireGroup(line: string): Promise<GroupConv> {
  const conv = requireConv(await convOfLine(line));
  return sdk.isGroup(conv) ? conv : notAGroup();
}

export async function createGroup(addresses: string[], name?: string, imageUrl?: string): Promise<CreateGroupResult> {
  const client = await sdk.client();
  const meta = groupMeta(name, imageUrl);
  return createGroupWith(addresses, lineOfConv, (members) => sdk.newGroup(client, members, meta));
}

export async function addGroupMembers(convId: string, addresses: string[]): Promise<void> {
  requireValidMembers(addresses);
  const group = await requireGroup(lineOfConv(convId));
  await addGroupMembersWith(addresses, (members) => sdk.addMembers(group, members));
}

export async function removeGroupMembers(convId: string, addresses: string[]): Promise<void> {
  const group = await requireGroup(lineOfConv(convId));
  await sdk.removeMembers(group, addresses);
}

export async function updateGroupMeta(convId: string, patch: GroupMeta & { description?: string }): Promise<void> {
  const ops = sdk.groupOps(requireConv(await convOfLine(lineOfConv(convId)))) ?? notAGroup();
  if (patch.name !== undefined) await ops.updateName(patch.name);
  if (patch.imageUrl !== undefined) await ops.updateImageUrl(patch.imageUrl);
  if (patch.description !== undefined) await ops.updateDescription(patch.description);
}

export function groupAdminInboxIds(conv: GroupConv): Promise<GroupAdmins> {
  return sdk.groupAdmins(conv);
}

export function groupNameImage(conv: GroupConv): Promise<GroupInfo> {
  return sdk.groupInfo(conv);
}

export async function leaveGroupConv(line: string): Promise<'left' | 'hidden'> {
  const conv = requireConv(await convOfLine(line));
  const leave = sdk.leaveOp(conv);
  if (leave) {
    try {
      await leave();
      await sdk.setConsent(conv, 'denied').catch(() => undefined);
      return 'left';
    } catch { }
  }
  await sdk.setConsent(conv, 'denied');
  return 'hidden';
}
