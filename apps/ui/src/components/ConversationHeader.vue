<script setup lang="ts">
/** Top bar of the XMTP conversation view — back arrow, tap-to-open title
 *  (DM peer or group, left-aligned), connection-status dot or member avatar
 *  stack on the right. Mirrors apps/app/app/xmtp/[convId].tsx. Extracted from
 *  XmtpConversation.vue to keep that file under the per-file LOC cap. */

import { shortAddress, stampBoxAvatarUrl } from '../lib/xmtp';
import type { XmtpFeedStatus } from '../lib/xmtpFeed';

const props = defineProps<{
  peerAddress: string | null;
  groupName: string;
  isGroup: boolean;
  memberAddresses: string[];
  status: XmtpFeedStatus;
}>();
const emit = defineEmits<{ (e: 'back'): void; (e: 'open'): void }>();

const visibleMembers = computed(() => props.memberAddresses.slice(0, 3));
const overflow = computed(() => Math.max(0, props.memberAddresses.length - 3));
</script>

<template>
  <div class="h-12 flex items-stretch
    bg-metro-bg-light dark:bg-metro-bg-dark shrink-0">
    <button type="button" class="h-full pl-3 pr-1 flex items-center text-metro-fg-light dark:text-metro-fg-dark" @click="emit('back')">
      <HeroIcon name="arrowLeft" :size="20" />
    </button>
    <!-- Everything right of the back arrow opens the group/channel (or peer)
         profile — full height + edge-to-edge so 100% of the bar is clickable. -->
    <button
      type="button"
      class="flex-1 h-full flex items-center justify-between min-w-0 gap-2 pr-3"
      @click="emit('open')"
    >
      <span class="truncate font-head text-base text-metro-head-light dark:text-metro-head-dark">
        {{ props.peerAddress ? shortAddress(props.peerAddress) : (props.groupName || 'Conversation') }}
      </span>
      <div v-if="props.status !== 'open'"
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-metro-hover-light dark:bg-metro-hover-dark shrink-0">
        <span class="w-1.5 h-1.5 rounded-full"
          :class="props.status === 'loading' ? 'bg-metro-warn'
            : props.status === 'error' ? 'bg-metro-err' : 'bg-metro-sub-dark'" />
        <span class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark">
          {{ props.status === 'loading' ? '…' : props.status === 'error' ? '!' : '·' }}
        </span>
      </div>
      <img v-else-if="props.peerAddress" :src="stampBoxAvatarUrl(props.peerAddress, 48)" alt=""
        class="w-6 h-6 rounded-full bg-metro-border-dark shrink-0" />
      <div v-else-if="visibleMembers.length" class="flex items-center shrink-0">
        <img
          v-for="(addr, i) in visibleMembers"
          :key="addr.toLowerCase()"
          :src="stampBoxAvatarUrl(addr, 48)"
          alt=""
          class="w-6 h-6 rounded-full bg-metro-border-dark border-2
            border-metro-bg-light dark:border-metro-bg-dark"
          :class="i === 0 ? '' : '-ml-2'"
        />
        <div v-if="overflow"
          class="w-6 h-6 -ml-2 rounded-full bg-metro-surface-light dark:bg-metro-surface-dark
            border-2 border-metro-bg-light dark:border-metro-bg-dark
            flex items-center justify-center text-[9px] text-metro-head-light dark:text-metro-head-dark">
          +{{ overflow }}
        </div>
      </div>
    </button>
  </div>
</template>
