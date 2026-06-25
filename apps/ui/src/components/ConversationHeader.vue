<script setup lang="ts">

import { computed } from 'vue';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/kit';
import type { AvatarStackNode } from '@stage-labs/kit/kit';
import { conversationHeader, CONVERSATION_PRESS } from '@stage-labs/views';
import { basicRoot } from '@/lib/kitRow';
import { metroFieldColors } from '@/lib/metroFieldColors';
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
const hasMembers = computed(() => props.memberAddresses.length > 0);
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

const avatarStackNode = computed(() => {
  const node: AvatarStackNode = {
    type: 'AvatarStack',
    items: props.memberAddresses.map(addr => ({ src: stampAvatarUrl(addr, 56) })),
    size: 32,
    max: 3,
    overlap: 8,
    ring: metroFieldColors.bg,
    fallbackBackground: metroFieldColors.border,
    moreBackground: metroFieldColors.surface,
    moreColor: metroFieldColors.link,
    moreFontSize: 11,
    moreFontFamily: 'Calibre-Medium',
  };
  return basicRoot(node);
});
</script>

<template>
  <Row align="stretch" class="h-[52px] box-border shrink-0
    bg-metro-bg-light dark:bg-metro-bg-dark
    border-b border-metro-border-light dark:border-metro-border-dark">
    <Pressable tag="button" type="button" class="h-full pl-3.5 pr-2 flex items-center text-metro-fg-light dark:text-metro-fg-dark" @click="emit('back')">
      <Icon name="arrowLeft" :size="22" />
    </Pressable>
    <Row v-if="!props.peerAddress && hasMembers" align="center" class="shrink-0 pl-2">
      <KitRenderer :node="avatarStackNode" />
    </Row>
    <Col class="flex-1 min-w-0 justify-center">
      <KitRenderer :node="node" :registry="registry" />
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
