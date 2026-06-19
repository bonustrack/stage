/**
 * @file Composable for the Group Detail screen: group state plus name/description/avatar/member mutations.
 */
/** Group detail state + mutations (name/description/avatar/members). Extracted from `pages/GroupDetail.vue` so the SFC stays under the lint cap. */

import { ref, computed, watchEffect, type ComputedRef, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IdentifierKind } from '@xmtp/browser-sdk';
import {
  convOfLine, getCachedXmtpClient, getOrCreateXmtpClient, lineOfConv,
  memberInboxToAddressMap, shortAddress,
} from './xmtp';
import { readProfile, uploadAvatar, type SnapshotProfile } from './profile';

export interface GroupDetail {
  router: ReturnType<typeof useRouter>;
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
  selfIsAdmin: ComputedRef<boolean>;
  onSaveName: (next: string) => Promise<void>;
  onSaveDescription: (next: string) => Promise<void>;
  onAddMember: (addr: string) => Promise<void>;
  removeMember: (addr: string) => Promise<void>;
  openMember: (addr: string) => void;
  onPickImage: (file: File) => Promise<void>;
}

/** Hook providing group detail state and mutations (name, description, avatar, members). */
// eslint-disable-next-line max-lines-per-function -- TODO(chaitu): refactor to satisfy function-size limits
export function useGroupDetail(): GroupDetail {
  const route = useRoute();
  const router = useRouter();
  const convId = computed(() => (route.params.convId as string) ?? '');
  const line = computed(() => lineOfConv(convId.value));
  const name = ref<string | null>(null);
  const saving = ref(false);
  const members = ref<string[]>([]);
  const memberNames = ref<Record<string, string | null>>({});
  const memberRoles = ref<Record<string, 'owner' | 'admin' | 'member'>>({});
  const adding = ref(false);
  const selfAddress = ref('');
  const removing = ref<string | null>(null);
  const errorMsg = ref('');
  const imageUrl = ref<string>('');
  const uploadingImage = ref(false);
  const description = ref<string>('');
  const savingDescription = ref(false);

  /** Only group admins/owners can edit metadata + manage members (enforced by the group's admin-only policy); hide those affordances from plain members. */
  const selfIsAdmin = computed(() => {
    const self = selfAddress.value.toLowerCase();
    for (const [addr, role] of Object.entries(memberRoles.value)) {
      if (addr.toLowerCase() === self) return role === 'owner' || role === 'admin';
    }
    return false;
  });

  watchEffect(() => { void runGroupDetailEffect(); });

  /** Run Group Detail Effect. */
  // eslint-disable-next-line complexity -- TODO(chaitu): refactor to satisfy function-size limits
  async function runGroupDetailEffect(): Promise<void> {
    if (!convId.value) return;
    const c = getCachedXmtpClient();
    if (c) selfAddress.value = c.accountIdentifier?.identifier.toLowerCase() ?? '';
    else {
      const client = await getOrCreateXmtpClient('production').catch(() => null);
      if (client) selfAddress.value = client.accountIdentifier?.identifier.toLowerCase() ?? '';
    }
    const conv = await convOfLine(line.value);
    if (!conv) return;
    const group = conv as unknown as {
      name?: string;
      imageUrl?: string;
      description?: string;
      superAdmins?: string[];
      admins?: () => string[];
    };
    name.value = group.name ?? '';
    imageUrl.value = group.imageUrl ?? '';
    description.value = group.description ?? '';
    const addrMap = await memberInboxToAddressMap(conv);
    const addrs = Object.values(addrMap).sort((a, b) => a.localeCompare(b));
    members.value = addrs;
    /** Role per member: super-admin → Owner, admin → Admin, else Member. superAdmins/admins are inbox ids, matched against the inbox→address map. */
    try {
      const superSet = new Set((group.superAdmins ?? []).map(s => s.toLowerCase()));
      const adminSet = new Set((group.admins?.() ?? []).map(a => a.toLowerCase()));
      const roles: Record<string, 'owner' | 'admin' | 'member'> = {};
      for (const [inboxId, addr] of Object.entries(addrMap)) {
        const iid = inboxId.toLowerCase();
        roles[addr] = superSet.has(iid) ? 'owner' : adminSet.has(iid) ? 'admin' : 'member';
      }
      memberRoles.value = roles;
    } catch { /* roles are best-effort */ }
    /** Enrich with Snapshot profile names — pure best-effort, rows fall back to short addresses when the lookup misses. */
    const profiles = await Promise.all(
      addrs.map(a => readProfile(a).catch(() => null as SnapshotProfile | null)),
    );
    const next: Record<string, string | null> = {};
    for (let i = 0; i < addrs.length; i++) {
      const addr = addrs[i];
      if (addr === undefined) continue;
      const trimmed = profiles[i]?.name?.trim();
      next[addr] = trimmed !== undefined && trimmed !== '' ? trimmed : null;
    }
    memberNames.value = next;
  }

  /** Handle the Save Name. */
  async function onSaveName(next: string): Promise<void> {
    if (!next || saving.value) return;
    saving.value = true;
    errorMsg.value = '';
    try {
      const conv = await convOfLine(line.value);
      const group = conv as unknown as { updateName?: (n: string) => Promise<void> };
      if (!group.updateName) throw new Error('Not a group conversation');
      await group.updateName(next);
      name.value = next;
    } catch (e) {
      errorMsg.value = `Rename failed: ${(e as Error).message}`;
    } finally { saving.value = false; }
  }

  /** Handle the Save Description. */
  async function onSaveDescription(next: string): Promise<void> {
    if (savingDescription.value) return;
    savingDescription.value = true;
    errorMsg.value = '';
    try {
      const conv = await convOfLine(line.value);
      if (!conv) throw new Error('Conversation not found');
      const group = conv as unknown as { updateDescription?: (d: string) => Promise<void> };
      if (!group.updateDescription) throw new Error('Not a group conversation');
      await group.updateDescription(next);
      description.value = next;
    } catch (e) {
      errorMsg.value = `Description update failed: ${(e as Error).message}`;
    } finally { savingDescription.value = false; }
  }

  type MemberOp = 'addMembersByIdentifiers' | 'removeMembersByIdentifiers';
  /** Mutate Members. */
  async function mutateMembers(op: MemberOp, addr: string, errLabel: string): Promise<void> {
    errorMsg.value = '';
    try {
      const conv = await convOfLine(line.value);
      if (!conv) throw new Error('Conversation not found');
      const group = conv as unknown as Record<MemberOp, ((ids: { identifier: string; identifierKind: IdentifierKind }[]) => Promise<unknown>) | undefined>;
      const fn = group[op];
      if (!fn) throw new Error('Not a group conversation');
      await fn([{ identifier: addr.toLowerCase(), identifierKind: IdentifierKind.Ethereum }]);
      const fullMap = await memberInboxToAddressMap(conv);
      members.value = Object.values(fullMap).sort((a, b) => a.localeCompare(b));
    } catch (e) { errorMsg.value = `${errLabel}: ${(e as Error).message}`; }
  }

  /** Handle the Add Member. */
  async function onAddMember(addr: string): Promise<void> {
    if (adding.value) return;
    adding.value = true;
    try { await mutateMembers('addMembersByIdentifiers', addr, 'Add failed'); }
    finally { adding.value = false; }
  }

  /** Remove Member. */
  async function removeMember(addr: string): Promise<void> {
    if (!confirm(`Remove ${shortAddress(addr)} from this group?`)) return;
    removing.value = addr.toLowerCase();
    try { await mutateMembers('removeMembersByIdentifiers', addr, 'Remove failed'); }
    finally { removing.value = null; }
  }

  /** Open Member. */
  function openMember(addr: string): void { void router.push(`/user/${addr}`); }

  /** Handle the Pick Image. */
  async function onPickImage(file: File): Promise<void> {
    if (uploadingImage.value) return;
    uploadingImage.value = true;
    errorMsg.value = '';
    try {
      const url = await uploadAvatar(file);
      const conv = await convOfLine(line.value);
      if (!conv) throw new Error('Conversation not found');
      const group = conv as unknown as { updateImageUrl?: (u: string) => Promise<void> };
      if (!group.updateImageUrl) throw new Error('Not a group conversation');
      await group.updateImageUrl(url);
      imageUrl.value = url;
    } catch (e) {
      errorMsg.value = `Image upload failed: ${(e as Error).message}`;
    } finally { uploadingImage.value = false; }
  }

  return {
    router, name, saving, members, memberNames, memberRoles, adding,
    selfAddress, removing, errorMsg, imageUrl, uploadingImage, description,
    savingDescription, selfIsAdmin, onSaveName, onSaveDescription,
    onAddMember, removeMember, openMember, onPickImage,
  };
}
