<script setup lang="ts">

import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import ViewHost from '@stage-labs/kit/vue/view-host';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import type { BasicNode } from '@stage-labs/kit/kit';
import { basicRoot, overflowMenu, screenHeader, OVERFLOW_MENU_PRESS, SCREEN_BACK } from '@stage-labs/views';
import { useGroupDetail } from '../lib/useGroupDetail';
import { leaveGroup } from '../lib/xmtpGroups';

const {
  router, name, saving, members, memberNames, memberRoles, adding,
  selfAddress, removing, errorMsg, imageUrl, uploadingImage, description,
  savingDescription, selfIsAdmin, onSaveName, onSaveDescription,
  onAddMember, removeMember, openMember, onPickImage,
} = useGroupDetail();

const route = useRoute();
const palette = useKitPalette();
const convId = computed(() => String(route.params.convId ?? ''));

function goAddMembers(): void { void router.push(`/xmtp/${convId.value}/add-members`); }

const leaving = ref(false);
const leaveError = ref<string | null>(null);

async function onLeaveGroup(): Promise<void> {
  if (!window.confirm('Leave group? You’ll stop receiving messages from this group. '
    + 'You can be re-added by a member later.')) return;
  leaving.value = true;
  leaveError.value = null;
  try {
    await leaveGroup(convId.value);
    await router.push('/channels');
  } catch (e) {
    leaveError.value = (e as Error).message ?? 'Could not leave group';
  } finally {
    leaving.value = false;
  }
}

const headerNode = computed<BasicNode>(() =>
  basicRoot(
    screenHeader({
      backColor: palette.text,
      trailing: [
        overflowMenu({
          items: [
            {
              id: 'leave',
              label: leaving.value ? 'Leaving…' : 'Leave group',
              icon: 'logout',
              danger: true,
              disabled: leaving.value,
            },
          ],
        }),
      ],
    }),
  ),
);

const menuActions = {
  [SCREEN_BACK]: (): void => { router.back(); },
  [OVERFLOW_MENU_PRESS]: (payload: Record<string, unknown>): void => {
    if (payload.id === 'leave') void onLeaveGroup();
  },
};
</script>

<template>
  <Col class="min-h-screen bg-metro-bg-light dark:bg-metro-bg-dark">
    <ViewHost :node="headerNode" :actions="menuActions" />

    <Col v-if="leaveError" class="px-4 pb-2 text-xs text-red-500">{{ leaveError }}</Col>

    <!-- Group hero avatar is a square with a soft radius (~11px, 12% of 88),
         mirroring mobile group detail (not a circle). -->
    <GroupAvatarEditor
      :image-url="imageUrl"
      :uploading="uploadingImage"
      :readonly="!selfIsAdmin"
      square
      @pick="onPickImage"
    />

    <Col class="px-4 pt-1 pb-4">
      <InlineEditableText
        label="Group name"
        :value="name ?? ''"
        placeholder="Group name"
        empty-label="Untitled group"
        :saving="saving"
        :readonly="!selfIsAdmin"
        @save="onSaveName"
      />
    </Col>
    <Col class="px-4 pb-4">
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
    </Col>

    <Row align="center" justify="between" class="px-4 pb-2">
      <Text size="xs" role="secondary">MEMBERS ({{ members.length }})</Text>
      <Pressable
        v-if="selfIsAdmin"
        tag="button"
        type="button"
        class="flex items-center gap-[5px] px-2.5 py-1.5 rounded-full border"
        :style="{ borderColor: palette.border }"
        @click="goAddMembers"
      >
        <Icon name="users" :size="16" />
        <Icon name="plus" :size="14" />
      </Pressable>
    </Row>
    <MemberAddForm v-if="selfIsAdmin" :adding="adding" @add="onAddMember" />
    <Col v-if="errorMsg" class="px-4 pb-2 text-xs text-red-500">{{ errorMsg }}</Col>

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
  </Col>
</template>
