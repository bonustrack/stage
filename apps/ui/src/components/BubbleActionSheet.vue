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
        <Pressable v-for="e in ACTION_EMOJIS" :key="e" tag="button" type="button" class="text-3xl"
          @click="emit('react', e)">{{ e }}</Pressable>
      </div>
      <Pressable tag="button" type="button"
        class="w-full flex items-center gap-3 py-3 text-metro-fg-light dark:text-metro-fg-dark"
        @click="emit('reply')">
        <Icon name="reply" :size="20" />
        <span class="text-base">Reply</span>
      </Pressable>
      <Pressable tag="button" v-if="props.target.text" type="button"
        class="w-full flex items-center gap-3 py-3 text-metro-fg-light dark:text-metro-fg-dark"
        @click="emit('copy')">
        <Icon name="copy" :size="20" />
        <span class="text-base">Copy text</span>
      </Pressable>
      <Pressable tag="button" type="button"
        class="w-full flex items-center gap-3 py-3 text-metro-fg-light dark:text-metro-fg-dark"
        @click="emit('copy-link')">
        <Icon name="send" :size="20" />
        <span class="text-base">Copy link</span>
      </Pressable>
      <Pressable tag="button" type="button"
        class="w-full py-2.5 text-center text-sm text-metro-sub-light dark:text-metro-sub-dark"
        @click="emit('close')">Cancel</Pressable>
    </div>
  </div>
</template>
