<script setup lang="ts">

import { computed } from 'vue';
import ViewHost from '@stage-labs/kit/vue/view-host';
import { channelRow, channelRowModel, listRoot, CHANNEL_PRESS } from '@stage-labs/views';
import { stampAvatarUrl } from '../lib/xmtp';
import { avatarRenderUrl } from '@stage-labs/client/profile/snapshot';


const props = defineProps<{
  avatarAddress: string | null;
  avatarUri?: string | null;
  title: string;
  lastTs: number | null;
  lastPreview: string;
  subtitle?: string | null;
  unreadCount: number;
  markedUnread?: boolean;
}>();
const emit = defineEmits<{ (e: 'open'): void; (e: 'menu', ev: MouseEvent): void }>();

const renderedAvatar = computed(() => {
  if (props.avatarUri) return avatarRenderUrl('', props.avatarUri, 88);
  if (props.avatarAddress) return stampAvatarUrl(props.avatarAddress, 88);
  return '';
});

const actions = {
  [CHANNEL_PRESS]: (): void => {
    emit('open');
  },
};

const node = computed(() =>
  listRoot(
    channelRow({ ...channelRowModel({
      convId: props.title,
      avatarUri: renderedAvatar.value,
      title: props.title,
      lastPreview: props.lastPreview,
      subtitle: props.subtitle,
      lastTs: props.lastTs,
      unreadCount: props.unreadCount,
      markedUnread: props.markedUnread,
      emptyPreview: '(no messages yet)',
    }), interactive: true }),
  ),
);
</script>

<template>
  <Box
    class="hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark
      active:bg-metro-border-light dark:active:bg-metro-border-dark"
    @contextmenu.prevent="emit('menu', $event)"
  >
    <ViewHost :node="node" :actions="actions" />
  </Box>
</template>
