<script setup lang="ts">
/** Top bar of the XMTP conversation view — back arrow, tap-to-open title
 *  (DM peer or group), connection-status dot. Extracted from
 *  XmtpConversation.vue to keep that file under the per-file LOC cap. */

import { shortAddress, stampBoxAvatarUrl } from '../lib/xmtp';
import type { XmtpFeedStatus } from '../lib/xmtpFeed';

const props = defineProps<{
  peerAddress: string | null;
  groupName: string;
  isGroup: boolean;
  status: XmtpFeedStatus;
}>();
const emit = defineEmits<{ (e: 'back'): void; (e: 'open'): void }>();
</script>

<template>
  <div class="h-12 flex items-center px-3 border-b border-metro-border-light dark:border-metro-border-dark
    bg-metro-bg-light dark:bg-metro-bg-dark shrink-0 relative">
    <button type="button" class="p-1.5 text-metro-fg-light dark:text-metro-fg-dark" @click="emit('back')">
      <HeroIcon name="arrowLeft" :size="22" />
    </button>
    <button
      type="button"
      class="flex-1 flex items-center justify-center gap-2 px-3 py-1 -mx-1
        text-sm text-metro-fg-light dark:text-metro-fg-dark
        hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark rounded-lg"
      @click="emit('open')"
    >
      <img v-if="props.peerAddress" :src="stampBoxAvatarUrl(props.peerAddress, 48)" alt=""
        class="w-6 h-6 rounded-full bg-metro-border-dark" />
      <HeroIcon v-else-if="props.isGroup" name="users" :size="16" />
      <span class="truncate max-w-[200px] font-head">
        {{ props.peerAddress ? shortAddress(props.peerAddress) : (props.groupName || 'Conversation') }}
      </span>
    </button>
    <div v-if="props.status !== 'open'"
      class="absolute top-1/2 right-3 -translate-y-1/2 flex items-center gap-1.5
        px-2.5 py-1 rounded-full bg-metro-hover-light dark:bg-metro-hover-dark">
      <span class="w-1.5 h-1.5 rounded-full"
        :class="props.status === 'loading' ? 'bg-metro-warn'
          : props.status === 'error' ? 'bg-metro-err' : 'bg-metro-sub-dark'" />
      <span class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark">
        {{ props.status === 'loading' ? '…' : props.status === 'error' ? '!' : '·' }}
      </span>
    </div>
  </div>
</template>
