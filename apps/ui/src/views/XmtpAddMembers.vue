<script setup lang="ts">

import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { addGroupMembers } from '../lib/xmtpGroups';
import { convOfLine, lineOfConv, groupMemberEthAddresses } from '../lib/xmtp';
import type { PickedMember } from '../lib/memberPicker';

const route = useRoute();
const router = useRouter();

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
  <Col class="min-h-screen bg-metro-bg-light dark:bg-metro-bg-dark pb-[88px]">
    <Row align="center" class="h-[56px] box-border shrink-0 px-2
      border-b border-metro-border-light dark:border-metro-border-dark">
      <Pressable tag="button" type="button" class="p-1.5" @click="router.back()">
        <Icon name="arrowLeft" :size="22" />
      </Pressable>
      <Col class="flex-1 font-head text-[17px] text-metro-head-light dark:text-metro-head-dark pl-1">
        Add members
      </Col>
    </Row>

    <Col class="flex-1 overflow-y-auto no-scrollbar px-4 py-4" :gap="16">
      <MemberPicker
        :members="members"
        :exclude="existing"
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
        :disabled="members.length === 0 || submitting"
        class="w-full py-3 rounded-full text-center font-head
          bg-metro-head-light dark:bg-metro-head-dark
          text-metro-bg-light dark:text-metro-bg-dark disabled:opacity-50"
        @click="onSubmit"
      >
        {{ submitting ? 'Adding…' : (members.length > 0 ? `Add to group (${members.length})` : 'Add to group') }}
      </Pressable>
    </Col>
  </Col>
</template>
