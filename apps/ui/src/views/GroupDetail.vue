<script setup lang="ts">

import { useGroupDetail } from '../lib/useGroupDetail';

const {
  router, name, saving, members, memberNames, memberRoles, adding,
  selfAddress, removing, errorMsg, imageUrl, uploadingImage, description,
  savingDescription, selfIsAdmin, onSaveName, onSaveDescription,
  onAddMember, removeMember, openMember, onPickImage,
} = useGroupDetail();
</script>

<template>
  <Col class="min-h-screen bg-metro-bg-light dark:bg-metro-bg-dark">
    <Row class="flex items-center px-3 py-3">
      <Pressable tag="button" type="button" class="p-1.5" @click="router.back()">
        <Icon name="arrowLeft" :size="22" />
      </Pressable>
    </Row>

    <GroupAvatarEditor
      :image-url="imageUrl"
      :uploading="uploadingImage"
      :readonly="!selfIsAdmin"
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

    <Col class="text-[11px] uppercase tracking-wide text-metro-sub-light dark:text-metro-sub-dark px-4 pb-1.5">
      Members ({{ members.length }})
    </Col>
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
