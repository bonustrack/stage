<script setup lang="ts">

import { computed } from 'vue';
import ViewHost from '@stage-labs/kit/vue/view-host';
import { basicRoot, conversationHeader, CONVERSATION_PRESS } from '@stage-labs/views';
import { channelStampSeed } from '@stage-labs/kit/avatar';
import { shortAddress, stampAvatarUrl } from '../lib/xmtp';
import type { XmtpFeedStatus } from '../lib/xmtpFeed';
import { runningInIframe, postCloseToParent } from '../lib/embedBridge';


const props = defineProps<{
  conversationId: string;
  peerAddress: string | null;
  groupName: string;
  isGroup: boolean;
  memberAddresses: string[];
  status: XmtpFeedStatus;
}>();
const emit = defineEmits<{ back: []; open: [] }>();

const title = computed(() =>
  props.peerAddress ? shortAddress(props.peerAddress) : (props.groupName || 'Untitled group'),
);

const avatarUri = computed(() => {
  if (props.peerAddress) return stampAvatarUrl(props.peerAddress, 48);
  if (props.isGroup && props.conversationId) {
    return stampAvatarUrl(channelStampSeed(props.conversationId), 48);
  }
  return undefined;
});

const embedded = runningInIframe();

const node = computed(() =>
  basicRoot(
    conversationHeader({
      conversationId: props.conversationId,
      avatarUri: avatarUri.value,
      avatarSquare: props.isGroup,
      title: title.value,
    }),
  ),
);

const actions = {
  [CONVERSATION_PRESS]: (): void => {
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
    <Col class="flex-1 min-w-0 justify-center pr-3.5">
      <ViewHost :node="node" :actions="actions" />
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
