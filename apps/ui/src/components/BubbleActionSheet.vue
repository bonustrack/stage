<script setup lang="ts">

import type { HistoryEntry } from '../lib/types';

const ACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '🔥', '🎉'];

const props = defineProps<{ target: HistoryEntry | null }>();
const emit = defineEmits<{
  (e: 'close' | 'reply' | 'copy' | 'copy-link'): void;
  (e: 'react', emoji: string): void;
}>();
void props;
</script>

<template>
  <div v-if="props.target"
    class="fixed inset-0 z-30 bg-black/45 flex items-end"
    @click.self="emit('close')"
  >
    <div class="w-full rounded-t-2xl p-4 pb-6 bg-metro-surface-light dark:bg-metro-surface-dark">
      <div class="flex justify-around pb-2">
        <button v-for="e in ACTION_EMOJIS" :key="e" type="button" class="text-3xl"
          @click="emit('react', e)">{{ e }}</button>
      </div>
      <button type="button"
        class="w-full flex items-center gap-3 py-3 text-metro-fg-light dark:text-metro-fg-dark"
        @click="emit('reply')">
        <HeroIcon name="reply" :size="20" />
        <span class="text-base">Reply</span>
      </button>
      <button v-if="props.target.text" type="button"
        class="w-full flex items-center gap-3 py-3 text-metro-fg-light dark:text-metro-fg-dark"
        @click="emit('copy')">
        <HeroIcon name="copy" :size="20" />
        <span class="text-base">Copy text</span>
      </button>
      <button type="button"
        class="w-full flex items-center gap-3 py-3 text-metro-fg-light dark:text-metro-fg-dark"
        @click="emit('copy-link')">
        <HeroIcon name="send" :size="20" />
        <span class="text-base">Copy link</span>
      </button>
      <button type="button"
        class="w-full py-2.5 text-center text-sm text-metro-sub-light dark:text-metro-sub-dark"
        @click="emit('close')">Cancel</button>
    </div>
  </div>
</template>
