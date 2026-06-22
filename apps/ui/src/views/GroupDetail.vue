<script setup lang="ts">

import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useGroupDetail } from '../lib/useGroupDetail';
import { leaveGroup } from '../lib/xmtpGroups';

const {
  router, name, saving, members, memberNames, memberRoles, adding,
  selfAddress, removing, errorMsg, imageUrl, uploadingImage, description,
  savingDescription, selfIsAdmin, onSaveName, onSaveDescription,
  onAddMember, removeMember, openMember, onPickImage,
} = useGroupDetail();

const route = useRoute();
const convId = computed(() => String(route.params.convId ?? ''));

function goAddMembers(): void { void router.push(`/xmtp/${convId.value}/add-members`); }

const overflowOpen = ref(false);
const leaving = ref(false);
const leaveError = ref<string | null>(null);

async function onLeaveGroup(): Promise<void> {
  overflowOpen.value = false;
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
</script>

<template>
  <Col class="min-h-screen bg-metro-bg-light dark:bg-metro-bg-dark">
    <Row class="flex items-center px-3 py-3">
      <Pressable tag="button" type="button" class="p-1.5" @click="router.back()">
        <Icon name="arrowLeft" :size="22" />
      </Pressable>
      <Col class="flex-1" />
      <Pressable
        tag="button"
        type="button"
        class="p-1.5 rounded-full
          hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
        title="More"
        @click="overflowOpen = true"
      >
        <Icon name="dotsHorizontal" :size="22" />
      </Pressable>
    </Row>

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

    <Row align="center" class="px-4 pb-1.5">
      <Col class="flex-1 text-[11px] uppercase tracking-wide text-metro-sub-light dark:text-metro-sub-dark">
        Members ({{ members.length }})
      </Col>
      <Pressable
        v-if="selfIsAdmin"
        tag="button"
        type="button"
        class="flex items-center gap-1 text-xs font-head
          text-metro-head-light dark:text-metro-head-dark"
        @click="goAddMembers"
      >
        <Icon name="plus" :size="14" />
        Add members
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

    <!-- Group-detail header overflow menu — mirrors mobile OverflowModal
         (Leave group). -->
    <template v-if="overflowOpen">
      <Col class="fixed inset-0 z-40" @click="overflowOpen = false" />
      <Col
        class="fixed right-2 top-[52px] z-50 min-w-[200px] py-1 rounded-lg shadow-lg
          bg-metro-bg-light dark:bg-metro-surface-dark
          border border-metro-border-light dark:border-metro-border-dark"
      >
        <Pressable
          tag="button"
          type="button"
          :disabled="leaving"
          class="w-full flex items-center gap-3 text-left px-3 py-2.5 text-sm
            text-red-500 disabled:opacity-50
            hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
          @click="onLeaveGroup"
        >
          <Icon name="logout" :size="20" />
          {{ leaving ? 'Leaving…' : 'Leave group' }}
        </Pressable>
      </Col>
    </template>
  </Col>
</template>
