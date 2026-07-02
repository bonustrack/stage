<script setup lang="ts">

import { computed } from 'vue';
import ViewHost from '@stage-labs/kit/vue/view-host';
import { listRoot, openUrlAction, previewLinkCard } from '@stage-labs/views';
import { capabilities } from '@/lib/capabilities';

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

const actions = {
  ...openUrlAction(capabilities),
};
</script>

<template>
  <!-- Static YouTube thumbnail + caption + tap-to-open, rendered from Kit
       JSON via previewLinkCard (static Image + Text + LINK_OPEN). The decorative
       centered ▶ play overlay is dropped (an absolute overlay is not expressible
       in Kit JSON); a live iframe player is intentionally not used. -->
  <ViewHost :node="node" :actions="actions" />
</template>
