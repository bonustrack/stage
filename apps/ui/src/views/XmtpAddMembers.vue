<script setup lang="ts">

import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import ViewHost from '@stage-labs/kit/vue/view-host';
import { basicRoot, screenHeader, SCREEN_BACK } from '@stage-labs/views';
import { useEffectiveScheme } from '@/lib/kitTheme';
import { addGroupMembers } from '../lib/xmtpGroups';
import { convOfLine, lineOfConv, groupMemberEthAddresses } from '../lib/xmtp';
import type { PickedMember } from '../lib/memberPicker';

const route = useRoute();
const router = useRouter();
const scheme = useEffectiveScheme();
const palette = useKitPalette();

const convId = String(route.params.convId ?? '');

const members = ref<PickedMember[]>([]);
const existing = ref<string[]>([]);
const submitting = ref(false);
const errorMsg = ref('');

onMounted(async () => {
  try {
    const conv = await convOfLine(lineOfConv(convId));
    if (conv) existing.value = await groupMemberEthAddresses(conv);
  } catch { existing.value = []; }
});

function addMember(m: PickedMember): void { members.value = [...members.value, m]; }

function removeMember(address: string): void {
  const lower = address.toLowerCase();
  members.value = members.value.filter(m => m.address.toLowerCase() !== lower);
}

const headerNode = computed(() =>
  basicRoot(screenHeader({
    title: 'Add members',
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

async function onSubmit(): Promise<void> {
  if (members.value.length === 0 || submitting.value || !convId) return;
  submitting.value = true;
  errorMsg.value = '';
  try {
    await addGroupMembers(convId, members.value.map(m => m.address));
    router.back();
  } catch (e) {
    errorMsg.value = (e as Error).message;
    submitting.value = false;
  }
}
</script>

<template>
  <Col surface="surface" class="min-h-screen pb-[88px]">
    <ViewHost :node="headerNode" :actions="headerActions" />

    <Col class="flex-1 overflow-y-auto no-scrollbar" :padding="16" :gap="16">
      <MemberPicker
        :members="members"
        :exclude="existing"
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
        :loading="submitting"
        :disabled="members.length === 0"
        :tint-bg="palette.primary"
        :tint-fg="palette.bg"
        :label="members.length > 0 ? `Add to group (${members.length})` : 'Add to group'"
        @click="onSubmit"
      />
    </Col>
  </Col>
</template>
