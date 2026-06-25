<script setup lang="ts">

import { computed } from 'vue';
import ChatKitRenderer from '@stage-labs/kit/vue/chatkit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/chatkit';
import { previewLinkCard, LINK_OPEN } from '@stage-labs/views';
import { listRoot } from '@/lib/chatkitRow';

const props = defineProps<{ videoId: string }>();
const watchUrl = computed(() => `https://www.youtube.com/watch?v=${props.videoId}`);
const thumbUrl = computed(() => `https://i.ytimg.com/vi/${props.videoId}/hqdefault.jpg`);

const node = computed(() =>
  listRoot(
    previewLinkCard({
      url: watchUrl.value,
      title: 'YouTube',
      subtitle: 'Tap to watch',
      imageUri: thumbUrl.value,
    }),
  ),
);

const registry: WidgetActionRegistry = {
  [LINK_OPEN]: () => {
    window.open(watchUrl.value, '_blank', 'noopener');
  },
};
</script>

<template>
  <!-- Static YouTube thumbnail + caption + tap-to-open, rendered from ChatKit
       JSON via previewLinkCard (static Image + Text + LINK_OPEN). The decorative
       centered ▶ play overlay is dropped (an absolute overlay is not expressible
       in ChatKit JSON); a live iframe player is intentionally not used. -->
  <ChatKitRenderer :node="node" :registry="registry" />
</template>
