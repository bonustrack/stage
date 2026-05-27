<script setup lang="ts">
/** Group detail view — avatar/name/description editing, member list +
 *  add/remove. Web counterpart to apps/app/app/group/[convId].tsx. */

import { IdentifierKind } from '@xmtp/browser-sdk';
import {
  convOfLine, getCachedXmtpClient, getOrCreateXmtpClient, lineOfConv,
  memberInboxToAddressMap, shortAddress,
} from '../lib/xmtp';
import { readProfile, uploadAvatar } from '../lib/profile';
import type { SnapshotProfile } from '@shared/profile/snapshot';

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

/** Only group admins/owners can edit metadata + manage members (enforced by the
 *  group's admin-only policy); hide those affordances from plain members. */
const selfIsAdmin = computed(() => {
  const self = selfAddress.value.toLowerCase();
  for (const [addr, role] of Object.entries(memberRoles.value)) {
    if (addr.toLowerCase() === self) return role === 'owner' || role === 'admin';
  }
  return false;
});

watchEffect(async () => {
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
  /** Role per member: super-admin → Owner, admin → Admin, else Member.
   *  superAdmins/admins are inbox ids, matched against the inbox→address map. */
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
  /** Enrich with Snapshot profile names — pure best-effort, rows fall back
   *  to short addresses when the lookup misses. */
  const profiles = await Promise.all(
    addrs.map(a => readProfile(a).catch(() => null as SnapshotProfile | null)),
  );
  const next: Record<string, string | null> = {};
  for (let i = 0; i < addrs.length; i++) next[addrs[i]!] = profiles[i]?.name?.trim() || null;
  memberNames.value = next;
});

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

async function onAddMember(addr: string): Promise<void> {
  if (adding.value) return;
  adding.value = true;
  try { await mutateMembers('addMembersByIdentifiers', addr, 'Add failed'); }
  finally { adding.value = false; }
}

async function removeMember(addr: string): Promise<void> {
  if (!confirm(`Remove ${shortAddress(addr)} from this group?`)) return;
  removing.value = addr.toLowerCase();
  try { await mutateMembers('removeMembersByIdentifiers', addr, 'Remove failed'); }
  finally { removing.value = null; }
}

function openMember(addr: string): void { void router.push(`/user/${addr}`); }

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

</script>

<template>
  <div class="min-h-screen bg-metro-bg-light dark:bg-metro-bg-dark">
    <div class="flex items-center px-3 py-3">
      <button type="button" class="p-1.5" @click="router.back()">
        <HeroIcon name="arrowLeft" :size="22" />
      </button>
    </div>

    <GroupAvatarEditor
      :image-url="imageUrl"
      :uploading="uploadingImage"
      :readonly="!selfIsAdmin"
      @pick="onPickImage"
    />

    <div class="px-4 pt-1 pb-4">
      <InlineEditableText
        label="Group name"
        :value="name ?? ''"
        placeholder="Group name"
        empty-label="Untitled group"
        :saving="saving"
        :readonly="!selfIsAdmin"
        @save="onSaveName"
      />
    </div>
    <div class="px-4 pb-4">
      <InlineEditableText
        label="Description"
        :value="description"
        placeholder="What is this group about?"
        empty-label="Tap to add a description"
        multiline
        value-class="text-sm text-metro-fg-light dark:text-metro-fg-dark font-sans"
        :saving="savingDescription"
        :readonly="!selfIsAdmin"
        @save="onSaveDescription"
      />
    </div>

    <div class="text-[11px] uppercase tracking-wide text-metro-sub-light dark:text-metro-sub-dark px-4 pb-1.5">
      Members ({{ members.length }})
    </div>
    <MemberAddForm v-if="selfIsAdmin" :adding="adding" @add="onAddMember" />
    <div v-if="errorMsg" class="px-4 pb-2 text-xs text-red-500">{{ errorMsg }}</div>

    <ul class="flex flex-col">
      <MemberRow
        v-for="addr in members"
        :key="addr.toLowerCase()"
        :address="addr"
        :name="memberNames[addr] ?? null"
        :role="memberRoles[addr] ?? 'member'"
        :is-self="addr.toLowerCase() === selfAddress"
        :can-remove="selfIsAdmin"
        :removing="removing === addr.toLowerCase()"
        @open="openMember(addr)"
        @remove="removeMember(addr)"
      />
    </ul>
  </div>
</template>
