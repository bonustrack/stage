/**
 * @file Composable for the Group Detail screen: group state plus name/description/avatar/member mutations.
 */
/** Group detail state + mutations (name/description/avatar/members). Extracted from `pages/GroupDetail.vue` so the SFC stays under the lint cap. */

import { ref, computed, watchEffect, type ComputedRef, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { lineOfConv } from './xmtp';
import {
  runGroupDetailEffect, onSaveName, onSaveDescription, onAddMember,
  removeMember, onPickImage, type GroupDetailState,
} from './useGroupDetail.mutations';

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

/** True when `self` is an owner/admin in the role map (case-insensitive address match). */
function isSelfAdmin(
  self: string, roles: Record<string, 'owner' | 'admin' | 'member'>,
): boolean {
  const lower = self.toLowerCase();
  for (const [addr, role] of Object.entries(roles)) {
    if (addr.toLowerCase() === lower) return role === 'owner' || role === 'admin';
  }
  return false;
}

/** Hook providing group detail state and mutations (name, description, avatar, members). */
export function useGroupDetail(): GroupDetail {
  const route = useRoute();
  const router = useRouter();
  const convId = computed(() => (route.params.convId as string) ?? '');
  const line = computed(() => lineOfConv(convId.value));
  const state: GroupDetailState = {
    router, line, convId,
    name: ref<string | null>(null),
    saving: ref(false),
    members: ref<string[]>([]),
    memberNames: ref<Record<string, string | null>>({}),
    memberRoles: ref<Record<string, 'owner' | 'admin' | 'member'>>({}),
    adding: ref(false),
    selfAddress: ref(''),
    removing: ref<string | null>(null),
    errorMsg: ref(''),
    imageUrl: ref<string>(''),
    uploadingImage: ref(false),
    description: ref<string>(''),
    savingDescription: ref(false),
  };

  /** Only group admins/owners can edit metadata + manage members (enforced by the group's admin-only policy); hide those affordances from plain members. */
  const selfIsAdmin = computed(() => isSelfAdmin(state.selfAddress.value, state.memberRoles.value));

  watchEffect(() => { void runGroupDetailEffect(state); });

  /** Open Member. */
  function openMember(addr: string): void { void router.push(`/user/${addr}`); }

  return {
    router,
    name: state.name,
    saving: state.saving,
    members: state.members,
    memberNames: state.memberNames,
    memberRoles: state.memberRoles,
    adding: state.adding,
    selfAddress: state.selfAddress,
    removing: state.removing,
    errorMsg: state.errorMsg,
    imageUrl: state.imageUrl,
    uploadingImage: state.uploadingImage,
    description: state.description,
    savingDescription: state.savingDescription,
    selfIsAdmin,
    onSaveName: next => onSaveName(state, next),
    onSaveDescription: next => onSaveDescription(state, next),
    onAddMember: addr => onAddMember(state, addr),
    removeMember: addr => removeMember(state, addr),
    openMember,
    onPickImage: file => onPickImage(state, file),
  };
}
