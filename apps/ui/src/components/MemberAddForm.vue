<script setup lang="ts">

import { useEffectiveScheme } from '@/lib/kitTheme';

const scheme = useEffectiveScheme();

const props = defineProps<{ adding: boolean }>();
const emit = defineEmits<(e: 'add', address: string) => void>();

const draft = ref('');
const valid = computed(() => /^0x[0-9a-fA-F]{40}$/.test(draft.value.trim()));

function onAdd(): void {
  if (!valid.value || props.adding) return;
  emit('add', draft.value.trim());
  draft.value = '';
}
</script>

<template>
  <Row :gap="8" class="px-4 pb-3">
    <Input
      v-model="draft"
      inputType="text"
      placeholder="0x… Ethereum address"
      :dark="scheme === 'dark'"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      class="flex-1 bg-metro-surface-light dark:bg-metro-surface-dark
        border border-metro-border-light dark:border-metro-border-dark
        rounded-lg px-3 py-2 text-sm text-metro-fg-light dark:text-metro-fg-dark outline-none font-sans"
      @keydown.enter.exact.prevent="onAdd"
    />
    <Pressable
      tag="button"
      type="button"
      :disabled="props.adding || !valid"
      class="px-3.5 py-2 rounded-full bg-metro-head-light dark:bg-metro-head-dark
        text-metro-bg-light dark:text-metro-bg-dark text-sm font-head disabled:opacity-50"
      @click="onAdd"
    >
      {{ props.adding ? 'Adding…' : 'Add' }}
    </Pressable>
  </Row>
</template>
