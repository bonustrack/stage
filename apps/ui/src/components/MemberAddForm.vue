<script setup lang="ts">

import { computed, ref } from 'vue';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/kit';
import { memberAddForm, MEMBER_ADD_CHANGE, MEMBER_ADD_SUBMIT } from '@stage-labs/views';
import { basicRoot } from '@/lib/kitRow';

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

const registry: WidgetActionRegistry = {
  [MEMBER_ADD_CHANGE]: (action) => {
    const next = action.payload.draft;
    if (typeof next === 'string') draft.value = next;
  },
  [MEMBER_ADD_SUBMIT]: () => {
    onAdd();
  },
};
</script>

<template>
  <KitRenderer :node="node" :registry="registry" />
</template>
