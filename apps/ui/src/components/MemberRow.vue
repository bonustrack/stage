<script setup lang="ts">
/** Single member row in the GroupDetail page — avatar + name + remove
 *  button. Extracted from GroupDetail.vue to keep that file under the
 *  per-file LOC cap. */

import { shortAddress, stampBoxAvatarUrl } from '../lib/xmtp';

const props = defineProps<{
  address: string;
  name: string | null;
  isSelf: boolean;
  removing: boolean;
}>();
const emit = defineEmits<{ (e: 'open'): void; (e: 'remove'): void }>();
</script>

<template>
  <li
    class="flex items-center gap-3 px-3.5 py-2.5
      bg-metro-surface-light dark:bg-metro-surface-dark
      border-b border-metro-border-light dark:border-metro-border-dark"
    :class="{ 'opacity-50': props.removing }"
  >
    <button type="button" class="flex items-center gap-3 flex-1 min-w-0 text-left" @click="emit('open')">
      <img :src="stampBoxAvatarUrl(props.address, 64)" alt="" class="w-8 h-8 rounded-full bg-metro-border-dark" />
      <div class="flex-1 min-w-0">
        <div class="text-sm text-metro-head-light dark:text-metro-head-dark truncate font-head">
          {{ props.name || shortAddress(props.address) }}{{ props.isSelf ? ' (you)' : '' }}
        </div>
        <div v-if="props.name" class="text-xs text-metro-sub-light dark:text-metro-sub-dark truncate mt-0.5">
          {{ shortAddress(props.address) }}
        </div>
      </div>
    </button>
    <button
      v-if="!props.isSelf"
      type="button"
      :disabled="props.removing"
      class="p-1.5 rounded-full text-red-500 hover:bg-red-500/10 disabled:opacity-50"
      @click="emit('remove')"
    >
      <HeroIcon name="trash" :size="18" />
    </button>
  </li>
</template>
