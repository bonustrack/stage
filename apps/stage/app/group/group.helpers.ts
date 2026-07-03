
import { convOfLine, memberInboxToAddressMap } from '../../modules/messaging';
import { PublicIdentity } from '@xmtp/react-native-sdk';

async function sortedMembers(conv: unknown): Promise<string[]> {
  const map = await memberInboxToAddressMap(conv as never);
  return Object.values(map).sort((a, b) => a.localeCompare(b));
}

export async function addGroupMember(line: string, addr: string): Promise<string[]> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error('Conversation not found');
  const group = conv as unknown as { addMembersByIdentity?: (ids: PublicIdentity[]) => Promise<unknown> };
  if (!group.addMembersByIdentity) throw new Error('Not a group conversation');
  await group.addMembersByIdentity([new PublicIdentity(addr, 'ETHEREUM')]);
  return sortedMembers(conv);
}

export async function removeGroupMember(line: string, addr: string): Promise<string[]> {
  const conv = await convOfLine(line);
  const group = conv as unknown as {
    removeMembersByIdentity?: (ids: PublicIdentity[]) => Promise<unknown>;
  };
  if (!group.removeMembersByIdentity) throw new Error('Not a group conversation');
  await group.removeMembersByIdentity([new PublicIdentity(addr, 'ETHEREUM')]);
  return sortedMembers(conv);
}

export async function updateGroupImage(line: string, url: string): Promise<void> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error('Conversation not found');
  const group = conv as unknown as { updateImageUrl?: (u: string) => Promise<void> };
  if (!group.updateImageUrl) throw new Error('Not a group conversation');
  await group.updateImageUrl(url);
}

export async function updateGroupDescription(line: string, next: string): Promise<void> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error('Conversation not found');
  const group = conv as unknown as { updateDescription?: (d: string) => Promise<void> };
  if (!group.updateDescription) throw new Error('Not a group conversation');
  await group.updateDescription(next);
}

export async function updateGroupName(line: string, next: string): Promise<void> {
  const conv = await convOfLine(line);
  const group = conv as unknown as { updateName?: (n: string) => Promise<void> };
  await group.updateName?.(next);
}
