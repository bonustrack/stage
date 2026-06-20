
import { type ComputedRef, type Ref } from 'vue';
import { useRouter } from 'vue-router';
import { IdentifierKind } from '@xmtp/browser-sdk';
import { convOfLine, memberInboxToAddressMap, shortAddress } from './xmtp';
import { uploadAvatar } from './profile';
import {
  resolveSelfAddress, computeMemberRoles, resolveMemberNames, type GroupShape,
} from './useGroupDetailHelpers';

export interface GroupDetailState {
  router: ReturnType<typeof useRouter>;
  line: ComputedRef<string>;
  convId: ComputedRef<string>;
  name: Ref<string | null>;
  saving: Ref<boolean>;
  members: Ref<string[]>;
  memberNames: Ref<Record<string, string | null>>;
  memberRoles: Ref<Record<string, 'owner' | 'admin' | 'member'>>;
  adding: Ref<boolean>;
  selfAddress: Ref<string>;
  removing: Ref<string | null>;
  errorMsg: Ref<string>;
  imageUrl: Ref<string>;
  uploadingImage: Ref<boolean>;
  description: Ref<string>;
  savingDescription: Ref<boolean>;
}

type MemberOp = 'addMembersByIdentifiers' | 'removeMembersByIdentifiers';

export async function runGroupDetailEffect(s: GroupDetailState): Promise<void> {
  if (!s.convId.value) return;
  s.selfAddress.value = await resolveSelfAddress();
  const conv = await convOfLine(s.line.value);
  if (!conv) return;
  const group = conv as unknown as GroupShape;
  s.name.value = group.name ?? '';
  s.imageUrl.value = group.imageUrl ?? '';
  s.description.value = group.description ?? '';
  const addrMap = await memberInboxToAddressMap(conv);
  const addrs = Object.values(addrMap).sort((a, b) => a.localeCompare(b));
  s.members.value = addrs;
  try { s.memberRoles.value = computeMemberRoles(group, addrMap); }
  catch { }
  s.memberNames.value = await resolveMemberNames(addrs);
}

export async function onSaveName(s: GroupDetailState, next: string): Promise<void> {
  if (!next || s.saving.value) return;
  s.saving.value = true;
  s.errorMsg.value = '';
  try {
    const conv = await convOfLine(s.line.value);
    const group = conv as unknown as { updateName?: (n: string) => Promise<void> };
    if (!group.updateName) throw new Error('Not a group conversation');
    await group.updateName(next);
    s.name.value = next;
  } catch (e) {
    s.errorMsg.value = `Rename failed: ${(e as Error).message}`;
  } finally { s.saving.value = false; }
}

export async function onSaveDescription(s: GroupDetailState, next: string): Promise<void> {
  if (s.savingDescription.value) return;
  s.savingDescription.value = true;
  s.errorMsg.value = '';
  try {
    const conv = await convOfLine(s.line.value);
    if (!conv) throw new Error('Conversation not found');
    const group = conv as unknown as { updateDescription?: (d: string) => Promise<void> };
    if (!group.updateDescription) throw new Error('Not a group conversation');
    await group.updateDescription(next);
    s.description.value = next;
  } catch (e) {
    s.errorMsg.value = `Description update failed: ${(e as Error).message}`;
  } finally { s.savingDescription.value = false; }
}

export async function mutateMembers(
  s: GroupDetailState, op: MemberOp, addr: string, errLabel: string,
): Promise<void> {
  s.errorMsg.value = '';
  try {
    const conv = await convOfLine(s.line.value);
    if (!conv) throw new Error('Conversation not found');
    const group = conv as unknown as Record<MemberOp, ((ids: { identifier: string; identifierKind: IdentifierKind }[]) => Promise<unknown>) | undefined>;
    const fn = group[op];
    if (!fn) throw new Error('Not a group conversation');
    await fn([{ identifier: addr.toLowerCase(), identifierKind: IdentifierKind.Ethereum }]);
    const fullMap = await memberInboxToAddressMap(conv);
    s.members.value = Object.values(fullMap).sort((a, b) => a.localeCompare(b));
  } catch (e) { s.errorMsg.value = `${errLabel}: ${(e as Error).message}`; }
}

export async function onAddMember(s: GroupDetailState, addr: string): Promise<void> {
  if (s.adding.value) return;
  s.adding.value = true;
  try { await mutateMembers(s, 'addMembersByIdentifiers', addr, 'Add failed'); }
  finally { s.adding.value = false; }
}

export async function removeMember(s: GroupDetailState, addr: string): Promise<void> {
  if (!confirm(`Remove ${shortAddress(addr)} from this group?`)) return;
  s.removing.value = addr.toLowerCase();
  try { await mutateMembers(s, 'removeMembersByIdentifiers', addr, 'Remove failed'); }
  finally { s.removing.value = null; }
}

export async function onPickImage(s: GroupDetailState, file: File): Promise<void> {
  if (s.uploadingImage.value) return;
  s.uploadingImage.value = true;
  s.errorMsg.value = '';
  try {
    const url = await uploadAvatar(file);
    const conv = await convOfLine(s.line.value);
    if (!conv) throw new Error('Conversation not found');
    const group = conv as unknown as { updateImageUrl?: (u: string) => Promise<void> };
    if (!group.updateImageUrl) throw new Error('Not a group conversation');
    await group.updateImageUrl(url);
    s.imageUrl.value = url;
  } catch (e) {
    s.errorMsg.value = `Image upload failed: ${(e as Error).message}`;
  } finally { s.uploadingImage.value = false; }
}
