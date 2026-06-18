/** Group-detail SDK action helpers - pure async fns operating on an XMTP line.
 *  Extracted from group/[convId] for lint line-budget. Behaviour identical. */

import { convOfLine, memberInboxToAddressMap } from '../../modules/messaging';
import { PublicIdentity } from '@xmtp/react-native-sdk';

/** Re-fetch the member list (sorted addresses) for a conversation. */
async function sortedMembers(conv: unknown): Promise<string[]> {
  const map = await memberInboxToAddressMap(conv as never);
  return Object.values(map).sort((a, b) => a.localeCompare(b));
}

/** Add an Ethereum address to the group; returns the refreshed sorted member list. */
export async function addGroupMember(line: string, addr: string): Promise<string[]> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error('Conversation not found');
  const group = conv as unknown as { addMembersByIdentity?: (ids: PublicIdentity[]) => Promise<unknown> };
  if (!group.addMembersByIdentity) throw new Error('Not a group conversation');
  await group.addMembersByIdentity([new PublicIdentity(addr, 'ETHEREUM')]);
  return sortedMembers(conv);
}

/** Remove an address from the group (admin-only); returns the refreshed member list. */
export async function removeGroupMember(line: string, addr: string): Promise<string[]> {
  const conv = await convOfLine(line);
  /** XMTP V3 groups expose `removeMembersByIdentity` - callable only by group
   *  admins/super-admins. Surface the raw error (often "not authorised") so the
   *  user can act on it. */
  const group = conv as unknown as {
    removeMembersByIdentity?: (ids: PublicIdentity[]) => Promise<unknown>;
  };
  if (!group.removeMembersByIdentity) throw new Error('Not a group conversation');
  await group.removeMembersByIdentity([new PublicIdentity(addr, 'ETHEREUM')]);
  return sortedMembers(conv!);
}

/** Update the group's image URL via the XMTP group metadata. */
export async function updateGroupImage(line: string, url: string): Promise<void> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error('Conversation not found');
  const group = conv as unknown as { updateImageUrl?: (u: string) => Promise<void> };
  if (!group.updateImageUrl) throw new Error('Not a group conversation');
  await group.updateImageUrl(url);
}

/** Update the group's description via the XMTP group metadata. */
export async function updateGroupDescription(line: string, next: string): Promise<void> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error('Conversation not found');
  const group = conv as unknown as { updateDescription?: (d: string) => Promise<void> };
  if (!group.updateDescription) throw new Error('Not a group conversation');
  await group.updateDescription(next);
}

/** Update the group's display name via the XMTP group metadata. */
export async function updateGroupName(line: string, next: string): Promise<void> {
  const conv = await convOfLine(line);
  const group = conv as unknown as { updateName?: (n: string) => Promise<void> };
  await group.updateName?.(next);
}
