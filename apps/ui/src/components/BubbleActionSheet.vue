<script setup lang="ts">

import { computed } from 'vue';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/kit';
import {
  menuSheet, type MenuSheetItem, MENU_ITEM_PRESS,
  emojiReactionRow, REACTION_EMOJI_PRESS,
} from '@stage-labs/views';
import { basicRoot } from '@/lib/kitRow';

import type { HistoryEntry } from '@stage-labs/client/types';

const ACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '🔥', '🎉'];

const props = defineProps<{ target: HistoryEntry | null }>();
const emit = defineEmits<{
  (e: 'close' | 'reply' | 'copy' | 'copy-link'): void;
  (e: 'react', emoji: string): void;
}>();

const items = computed<MenuSheetItem[]>(() => {
  const list: MenuSheetItem[] = [{ id: 'reply', label: 'Reply', icon: 'reply' }];
  if (props.target?.text) list.push({ id: 'copy', label: 'Copy text', icon: 'copy' });
  list.push({ id: 'copy-link', label: 'Copy link', icon: 'send' });
  return list;
});

const node = computed(() => menuSheet({ items: items.value }));
const emojiNode = computed(() => basicRoot(emojiReactionRow({ emojis: ACTION_EMOJIS })));

const registry: WidgetActionRegistry = {
  [MENU_ITEM_PRESS]: (action) => {
    const id = action.payload.id;
    if (id === 'reply') emit('reply');
    else if (id === 'copy') emit('copy');
    else if (id === 'copy-link') emit('copy-link');
  },
  [REACTION_EMOJI_PRESS]: (action) => {
    if (typeof action.payload.emoji === 'string') emit('react', action.payload.emoji);
  },
};
</script>

<template>
  <!-- Fixed bottom-sheet overlay + tap-to-dismiss gesture stay in template
       (no Kit overlay node). The emoji quick-reaction row and the actionable
       item list render from Kit JSON via emojiReactionRow + menuSheet. -->
  <Row v-if="props.target"
    class="fixed inset-0 z-30 bg-black/45 flex items-end"
    @click.self="emit('close')"
  >
    <Col class="w-full rounded-t-2xl p-4 pb-6 bg-metro-surface-light dark:bg-metro-surface-dark">
      <KitRenderer :node="emojiNode" :registry="registry" />
      <KitRenderer :node="node" :registry="registry" />
      <Pressable tag="button" type="button"
        class="w-full py-2.5 text-center text-sm text-metro-sub-light dark:text-metro-sub-dark"
        @click="emit('close')">Cancel</Pressable>
    </Col>
  </Row>
</template>
