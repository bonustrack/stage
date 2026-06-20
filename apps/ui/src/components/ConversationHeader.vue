<script setup lang="ts">

import { shortAddress, stampAvatarUrl } from '../lib/xmtp';
import type { XmtpFeedStatus } from '../lib/xmtpFeed';
import { runningInIframe, postCloseToParent } from '../lib/embedBridge';
import { Row } from './layout';

const props = defineProps<{
  peerAddress: string | null;
  groupName: string;
  isGroup: boolean;
  memberAddresses: string[];
  status: XmtpFeedStatus;
}>();
const emit = defineEmits<{ back: []; open: [] }>();

const visibleMembers = computed(() => props.memberAddresses.slice(0, 3));
const overflow = computed(() => Math.max(0, props.memberAddresses.length - 3));
const embedded = runningInIframe();
</script>

<template>
  <Row align="stretch" class="h-[56px] box-border shrink-0
    bg-metro-bg-light dark:bg-metro-bg-dark
    border-b border-metro-border-light dark:border-metro-border-dark">
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
      <span class="truncate font-head text-[17px] text-metro-head-light dark:text-metro-head-dark">
        {{ props.peerAddress ? shortAddress(props.peerAddress) : (props.groupName || 'Conversation') }}
      </span>
      <Row v-if="props.status !== 'open'" align="center" :gap="6"
        class="px-2.5 py-1 rounded-full bg-metro-hover-light dark:bg-metro-hover-dark shrink-0">
        <span class="w-1.5 h-1.5 rounded-full"
          :class="props.status === 'loading' ? 'bg-metro-warn'
            : props.status === 'error' ? 'bg-metro-err' : 'bg-metro-sub-dark'" />
        <span class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark">
          {{ props.status === 'loading' ? '…' : props.status === 'error' ? '!' : '·' }}
        </span>
      </Row>
      <img v-else-if="props.peerAddress" :src="stampAvatarUrl(props.peerAddress, 48)" alt=""
        class="w-6 h-6 rounded-full bg-metro-border-dark shrink-0" />
      <Row v-else-if="visibleMembers.length" align="center" class="shrink-0">
        <img
          v-for="(addr, i) in visibleMembers"
          :key="addr.toLowerCase()"
          :src="stampAvatarUrl(addr, 48)"
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
      </Row>
    </button>
    <!-- Widget only: close button at the very end of the (single) topnav. -->
    <button
      v-if="embedded"
      type="button"
      class="h-full pr-3 pl-1 flex items-center text-metro-fg-light dark:text-metro-fg-dark"
      title="Close"
      @click="postCloseToParent"
    >
      <HeroIcon name="x" :size="20" />
    </button>
  </Row>
</template>
