<script setup lang="ts">

import { computed } from 'vue';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/kit';
import { channelRow, channelTimestamp, unreadBadgeLabel, CHANNEL_PRESS } from '@stage-labs/views';
import { listRoot } from '@/lib/kitRow';
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

const unreadBadge = computed(() => unreadBadgeLabel(props.unreadCount, props.markedUnread));

const registry: WidgetActionRegistry = {
  [CHANNEL_PRESS]: () => {
    emit('open');
  },
};

const preview = computed(() => {
  if (props.lastPreview) return props.lastPreview;
  if (props.subtitle) return props.subtitle;
  return '(no messages yet)';
});

const node = computed(() =>
  listRoot(
    channelRow({
      convId: props.title,
      avatarUri: renderedAvatar.value,
      title: props.title,
      preview: preview.value,
      timestamp: channelTimestamp(props.lastTs),
      unreadBadge: unreadBadge.value,
    }),
  ),
);
</script>

<template>
  <Box
    class="hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark
      active:bg-metro-border-light dark:active:bg-metro-border-dark"
    @contextmenu.prevent="emit('menu', $event)"
  >
    <KitRenderer :node="node" :registry="registry" />
  </Box>
</template>
