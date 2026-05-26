<script setup lang="ts">
/** Single row in the Channels list — avatar, title, last-message preview,
 *  unread badge. Extracted from Channels.vue to keep that file under the
 *  per-file LOC cap. */

import { stampBoxAvatarUrl } from '../lib/xmtp';
import { avatarRenderUrl } from '@shared/profile/snapshot';

const props = defineProps<{
  avatarAddress: string | null;
  avatarUri?: string | null;
  title: string;
  lastTs: number | null;
  lastPreview: string;
  unreadCount: number;
}>();
const emit = defineEmits<{ (e: 'open'): void }>();

const renderedAvatar = computed(() => {
  if (props.avatarUri) return avatarRenderUrl('', props.avatarUri, 64);
  if (props.avatarAddress) return stampBoxAvatarUrl(props.avatarAddress, 64);
  return null;
});

function fmtTs(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
</script>

<template>
  <button
    type="button"
    class="w-full text-left flex items-center gap-3 px-3.5 py-3"
    @click="emit('open')"
  >
    <img v-if="renderedAvatar"
      :src="renderedAvatar"
      alt=""
      class="w-9 h-9 rounded-full bg-metro-border-dark shrink-0 object-cover"
    />
    <div v-else class="w-9 h-9 rounded-full bg-metro-border-dark shrink-0" />
    <div class="flex-1 min-w-0">
      <div class="flex items-baseline gap-2">
        <div class="text-base text-metro-head-light dark:text-metro-head-dark truncate flex-1 font-head">
          {{ props.title }}
        </div>
        <div class="text-xs text-metro-sub-light dark:text-metro-sub-dark shrink-0">
          {{ fmtTs(props.lastTs) }}
        </div>
      </div>
      <div class="flex items-center gap-2 mt-1">
        <div class="text-sm text-metro-sub-light dark:text-metro-sub-dark truncate flex-1">
          {{ props.lastPreview || '(no messages yet)' }}
        </div>
        <div v-if="props.unreadCount > 0"
          class="min-w-[22px] h-5 rounded-full px-1.5
            bg-metro-head-light dark:bg-metro-head-dark
            text-metro-bg-light dark:text-metro-bg-dark
            text-[11px] font-head flex items-center justify-center shrink-0">
          {{ props.unreadCount > 99 ? '99+' : props.unreadCount }}
        </div>
      </div>
    </div>
  </button>
</template>
