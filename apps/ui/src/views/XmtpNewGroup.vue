<script setup lang="ts">

import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import ViewHost from '@stage-labs/kit/vue/view-host';
import { basicRoot, screenHeader, SCREEN_BACK } from '@stage-labs/views';
import { useEffectiveScheme } from '@/lib/kitTheme';
import { createGroup } from '../lib/xmtpGroups';
import { uploadAvatar } from '../lib/profile';
import type { PickedMember } from '../lib/memberPicker';

const router = useRouter();
const scheme = useEffectiveScheme();
const palette = useKitPalette();

const name = ref('');
const members = ref<PickedMember[]>([]);
const imageFile = ref<File | null>(null);
const imagePreview = ref('');
const creating = ref(false);
const errorMsg = ref('');

const headerNode = computed(() =>
  basicRoot(screenHeader({
    title: 'New group',
    titleStyle: { kind: 'title', size: 'sm', color: palette.link },
    backColor: palette.text,
    safeTop: 0,
    surface: palette.toolbarBg,
    borderColor: palette.border,
  })),
);
const headerActions = {
  [SCREEN_BACK]: (): void => { router.back(); },
};

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
  <Col surface="surface" class="min-h-screen pb-[88px]">
    <ViewHost :node="headerNode" :actions="headerActions" />

    <Col class="flex-1 overflow-y-auto no-scrollbar" :padding="16" :gap="16">
      <GroupAvatarEditor
        :image-url="imagePreview"
        :uploading="false"
        square
        @pick="onPickImage"
      />

      <Col :gap="6">
        <Text size="xs" role="secondary">Group name (optional)</Text>
        <Input
          v-model="name"
          inputType="text"
          placeholder="e.g. Metro builders"
          :dark="scheme === 'dark'"
          autocomplete="off"
        />
      </Col>

      <MemberPicker
        :members="members"
        @add="addMember"
        @remove="removeMember"
      />

      <Text v-if="errorMsg" size="xs" role="danger">{{ errorMsg }}</Text>
    </Col>

    <Col
      surface="surface"
      class="fixed bottom-0 inset-x-0"
      :padding="16"
      :style="{ borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: palette.border }"
    >
      <Button
        variant="primary"
        size="lg"
        full-width
        :dark="scheme === 'dark'"
        :loading="creating"
        :disabled="members.length === 0"
        :tint-bg="palette.primary"
        :tint-fg="palette.bg"
        :label="members.length > 0 ? `Create group (${members.length})` : 'Create group'"
        @click="onCreate"
      />
    </Col>
  </Col>
</template>
