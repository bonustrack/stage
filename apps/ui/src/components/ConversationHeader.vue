<script setup lang="ts">

import { computed } from 'vue';
import ChatKitRenderer from '@stage-labs/kit/vue/chatkit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/chatkit';
import { conversationHeader, CONVERSATION_PRESS } from '@stage-labs/views';
import { basicRoot } from '@/lib/chatkitRow';
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

const statusLabel = computed(() => {
  if (props.status === 'open') return undefined;
  if (props.status === 'loading') return 'Connecting…';
  if (props.status === 'error') return 'Connection error';
  return 'Idle';
});

const node = computed(() =>
  basicRoot(
    conversationHeader({
      avatarUri: props.peerAddress ? stampAvatarUrl(props.peerAddress, 56) : undefined,
      title: title.value,
      subtitle: statusLabel.value,
      pressable: true,
    }),
  ),
);

const registry: WidgetActionRegistry = {
  [CONVERSATION_PRESS]: () => {
    emit('open');
  },
};
</script>

<template>
  <Row align="stretch" class="h-[52px] box-border shrink-0
    bg-metro-bg-light dark:bg-metro-bg-dark
    border-b border-metro-border-light dark:border-metro-border-dark">
    <Pressable tag="button" type="button" class="h-full pl-3.5 pr-2 flex items-center text-metro-fg-light dark:text-metro-fg-dark" @click="emit('back')">
      <Icon name="arrowLeft" :size="22" />
    </Pressable>
    <!-- kit-exception: overlapping avatar stack is absolute-positioned, not expressible in ChatKit JSON -->
    <Row v-if="!props.peerAddress && visibleMembers.length" align="center" class="shrink-0 pl-2">
      <img
        v-for="(addr, i) in visibleMembers"
        :key="addr.toLowerCase()"
        :src="stampAvatarUrl(addr, 56)"
        alt=""
        class="w-8 h-8 rounded-full bg-metro-border-light dark:bg-metro-border-dark border-2
          border-metro-bg-light dark:border-metro-bg-dark"
        :class="i === 0 ? '' : '-ml-2'"
      />
      <Row v-if="overflow"
        align="center" justify="center"
        class="w-8 h-8 -ml-2 rounded-full bg-metro-surface-light dark:bg-metro-surface-dark
          border-2 border-metro-bg-light dark:border-metro-bg-dark">
        <Text size="3xs" color="link">+{{ overflow }}</Text>
      </Row>
    </Row>
    <Col class="flex-1 min-w-0 justify-center">
      <ChatKitRenderer :node="node" :registry="registry" />
    </Col>
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
