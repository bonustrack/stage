<script setup lang="ts">

import { shortAddress, stampAvatarUrl } from '../lib/xmtp';
import type { XmtpFeedStatus } from '../lib/xmtpFeed';
import { runningInIframe, postCloseToParent } from '../lib/embedBridge';


const props = defineProps<{
  peerAddress: string | null;
  groupName: string;
  isGroup: boolean;
  memberAddresses: string[];
  status: XmtpFeedStatus;
}>();
const emit = defineEmits<{ back: []; open: [] }>();

const title = computed(() =>
  props.peerAddress ? shortAddress(props.peerAddress) : (props.groupName || 'Conversation'),
);
const visibleMembers = computed(() => props.memberAddresses.slice(0, 3));
const overflow = computed(() => Math.max(0, props.memberAddresses.length - 3));
const embedded = runningInIframe();
</script>

<template>
  <Row align="stretch" class="h-[52px] box-border shrink-0
    bg-metro-bg-light dark:bg-metro-bg-dark
    border-b border-metro-border-light dark:border-metro-border-dark">
    <Pressable tag="button" type="button" class="h-full pl-3.5 pr-2 flex items-center text-metro-fg-light dark:text-metro-fg-dark" @click="emit('back')">
      <Icon name="arrowLeft" :size="22" />
    </Pressable>
    <!-- Everything right of the back arrow opens the group/channel (or peer)
         profile — full height + edge-to-edge so the whole bar is clickable. -->
    <Pressable
      tag="button"
      type="button"
      class="flex-1 h-full flex items-center min-w-0 gap-2.5 pr-3.5"
      @click="emit('open')"
    >
      <AvatarView v-if="props.peerAddress" :src="stampAvatarUrl(props.peerAddress, 56)" :size="28" />
      <Row v-else-if="visibleMembers.length" align="center" class="shrink-0">
        <img
          v-for="(addr, i) in visibleMembers"
          :key="addr.toLowerCase()"
          :src="stampAvatarUrl(addr, 56)"
          alt=""
          class="w-7 h-7 rounded-full bg-metro-border-light dark:bg-metro-border-dark border-2
            border-metro-bg-light dark:border-metro-bg-dark"
          :class="i === 0 ? '' : '-ml-2'"
        />
        <Row v-if="overflow"
          align="center" justify="center"
          class="w-7 h-7 -ml-2 rounded-full bg-metro-surface-light dark:bg-metro-surface-dark
            border-2 border-metro-bg-light dark:border-metro-bg-dark">
          <Text size="3xs" color="link">+{{ overflow }}</Text>
        </Row>
      </Row>
      <Text size="4xl" weight="semibold" color="link" :truncate="true" class="flex-1 min-w-0 text-left">
        {{ title }}
      </Text>
      <Row v-if="props.status !== 'open'" align="center" :gap="6"
        class="px-2.5 py-1 rounded-full bg-metro-hover-light dark:bg-metro-hover-dark shrink-0">
        <Col class="w-1.5 h-1.5 rounded-full"
          :class="props.status === 'loading' ? 'bg-metro-warn'
            : props.status === 'error' ? 'bg-metro-err' : 'bg-metro-sub-dark'" />
        <Text size="3xs" color="secondary">
          {{ props.status === 'loading' ? '…' : props.status === 'error' ? '!' : '·' }}
        </Text>
      </Row>
    </Pressable>
    <!-- Widget only: close button at the very end of the (single) topnav. -->
    <Pressable
      v-if="embedded"
      tag="button"
      type="button"
      class="h-full pr-3.5 pl-1 flex items-center text-metro-fg-light dark:text-metro-fg-dark"
      title="Close"
      @click="postCloseToParent"
    >
      <Icon name="x" :size="20" />
    </Pressable>
  </Row>
</template>
