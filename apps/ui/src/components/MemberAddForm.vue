<script setup lang="ts">

import { computed, ref } from 'vue';
import ViewHost from '@stage-labs/kit/vue/view-host';
import { basicRoot, memberAddForm, MEMBER_ADD_CHANGE, MEMBER_ADD_SUBMIT } from '@stage-labs/views';

const props = defineProps<{ adding: boolean }>();
const emit = defineEmits<(e: 'add', address: string) => void>();

const draft = ref('');
const valid = computed(() => /^0x[0-9a-fA-F]{40}$/.test(draft.value.trim()));

function onAdd(): void {
  if (!valid.value || props.adding) return;
  emit('add', draft.value.trim());
  draft.value = '';
}

const node = computed(() =>
  basicRoot(memberAddForm({ draft: draft.value, adding: props.adding, valid: valid.value })));

const actions = {
  [MEMBER_ADD_CHANGE]: (payload: Record<string, unknown>): void => {
    const next = payload.draft;
    if (typeof next === 'string') draft.value = next;
  },
  [MEMBER_ADD_SUBMIT]: (): void => {
    onAdd();
  },
};
</script>

<template>
  <ViewHost :node="node" :actions="actions" />
</template>
