<script setup lang="ts">
/** Single member row in the GroupDetail page — avatar + name + remove
 *  button. Extracted from GroupDetail.vue to keep that file under the
 *  per-file LOC cap. */

import { shortAddress, stampAvatarUrl } from '../lib/xmtp';
import { Row } from './layout';

const props = defineProps<{
  address: string;
  name: string | null;
  isSelf: boolean;
  removing: boolean;
  role?: 'owner' | 'admin' | 'member';
  /** Only show the remove button when the viewer is a group admin/owner. */
  canRemove?: boolean;
}>();
const emit = defineEmits<{ (e: 'open'): void; (e: 'remove'): void }>();
</script>

<template>
  <Row
    as="li"
    align="center"
    :gap="12"
    class="px-3.5 py-2.5
      bg-metro-surface-light dark:bg-metro-surface-dark
      border-b border-metro-border-light dark:border-metro-border-dark"
    :class="{ 'opacity-50': props.removing }"
  >
    <button type="button" class="flex items-center gap-3 flex-1 min-w-0 text-left" @click="emit('open')">
      <img :src="stampAvatarUrl(props.address, 64)" alt="" class="w-8 h-8 rounded-full bg-metro-border-dark" />
      <div class="flex-1 min-w-0">
        <div class="text-sm text-metro-head-light dark:text-metro-head-dark truncate font-head">
          {{ props.name || shortAddress(props.address) }}{{ props.isSelf ? ' (you)' : '' }}
        </div>
        <div v-if="props.name" class="text-xs text-metro-sub-light dark:text-metro-sub-dark truncate mt-0.5">
          {{ shortAddress(props.address) }}
        </div>
      </div>
    </button>
    <span
      v-if="props.role && props.role !== 'member'"
      class="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-sans"
      :class="props.role === 'owner'
        ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400'
        : 'bg-metro-border-light dark:bg-metro-border-dark text-metro-sub-light dark:text-metro-sub-dark'"
    >{{ props.role === 'owner' ? 'Owner' : 'Admin' }}</span>
    <button
      v-if="!props.isSelf && props.canRemove"
      type="button"
      :disabled="props.removing"
      class="p-1.5 rounded-full text-red-500 hover:bg-red-500/10 disabled:opacity-50"
      @click="emit('remove')"
    >
      <HeroIcon name="trash" :size="18" />
    </button>
  </Row>
</template>
