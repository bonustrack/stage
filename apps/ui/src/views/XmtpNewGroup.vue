<script setup lang="ts">

import { useRouter } from 'vue-router';
import { useEffectiveScheme } from '@/lib/kitTheme';
import { createGroup } from '../lib/xmtpGroups';
import { uploadAvatar } from '../lib/profile';
import type { PickedMember } from '../lib/memberPicker';

const router = useRouter();
const scheme = useEffectiveScheme();

const name = ref('');
const members = ref<PickedMember[]>([]);
const imageFile = ref<File | null>(null);
const imagePreview = ref('');
const creating = ref(false);
const errorMsg = ref('');

function onPickImage(file: File): void {
  imageFile.value = file;
  imagePreview.value = URL.createObjectURL(file);
}

function addMember(m: PickedMember): void { members.value = [...members.value, m]; }

function removeMember(address: string): void {
  const lower = address.toLowerCase();
  members.value = members.value.filter(m => m.address.toLowerCase() !== lower);
}

async function onCreate(): Promise<void> {
  if (members.value.length === 0 || creating.value) return;
  creating.value = true;
  errorMsg.value = '';
  try {
    let imageUrl: string | undefined;
    if (imageFile.value) {
      try { imageUrl = await uploadAvatar(imageFile.value); }
      catch { errorMsg.value = "Couldn't upload the group image — creating without it."; }
    }
    const { id } = await createGroup(
      members.value.map(m => m.address), name.value, imageUrl,
    );
    await router.replace(`/xmtp/${id}`);
  } catch (e) {
    errorMsg.value = (e as Error).message;
    creating.value = false;
  }
}
</script>

<template>
  <Col class="min-h-screen bg-metro-bg-light dark:bg-metro-bg-dark pb-[88px]">
    <Row align="center" class="h-[56px] box-border shrink-0 px-2
      border-b border-metro-border-light dark:border-metro-border-dark">
      <Pressable tag="button" type="button" class="p-1.5" @click="router.back()">
        <Icon name="arrowLeft" :size="22" />
      </Pressable>
      <Col class="flex-1 font-head text-[17px] text-metro-head-light dark:text-metro-head-dark pl-1">
        New group
      </Col>
    </Row>

    <Col class="flex-1 overflow-y-auto no-scrollbar px-4 py-4" :gap="16">
      <GroupAvatarEditor
        :image-url="imagePreview"
        :uploading="false"
        @pick="onPickImage"
      />

      <Col :gap="6">
        <Label class="text-xs text-metro-sub-light dark:text-metro-sub-dark">Group name (optional)</Label>
        <Input
          v-model="name"
          inputType="text"
          placeholder="e.g. Metro builders"
          :dark="scheme === 'dark'"
          autocomplete="off"
          class="bg-metro-surface-light dark:bg-metro-surface-dark
            border border-metro-border-light dark:border-metro-border-dark
            rounded-lg px-3 py-2 text-sm text-metro-fg-light dark:text-metro-fg-dark outline-none font-sans"
        />
      </Col>

      <MemberPicker
        :members="members"
        @add="addMember"
        @remove="removeMember"
      />

      <Col v-if="errorMsg" class="text-xs text-metro-err">{{ errorMsg }}</Col>
    </Col>

    <Col class="fixed bottom-0 inset-x-0 px-4 py-3
      bg-metro-bg-light dark:bg-metro-bg-dark
      border-t border-metro-border-light dark:border-metro-border-dark">
      <Pressable
        tag="button"
        type="button"
        :disabled="members.length === 0 || creating"
        class="w-full py-3 rounded-full text-center font-head
          bg-metro-head-light dark:bg-metro-head-dark
          text-metro-bg-light dark:text-metro-bg-dark disabled:opacity-50"
        @click="onCreate"
      >
        {{ creating ? 'Creating…' : (members.length > 0 ? `Create group (${members.length})` : 'Create group') }}
      </Pressable>
    </Col>
  </Col>
</template>
