<script setup lang="ts">

import { computed } from 'vue';
import ChatKitRenderer from '@stage-labs/kit/vue/chatkit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/chatkit';
import { previewLinkCard, LINK_OPEN } from '@stage-labs/views';
import { listRoot } from '@/lib/chatkitRow';
import { osmTileUrl } from '../lib/embedDetect';

const props = defineProps<{ lat: number; lng: number; sourceUrl: string }>();

const tileUrl = computed(() => osmTileUrl(props.lat, props.lng, 14));
const label = computed(() => `${props.lat.toFixed(4)}, ${props.lng.toFixed(4)}`);

const node = computed(() =>
  listRoot(
    previewLinkCard({
      url: props.sourceUrl,
      title: 'Location',
      subtitle: `${label.value} · tap to open`,
      imageUri: tileUrl.value,
    }),
  ),
);

const registry: WidgetActionRegistry = {
  [LINK_OPEN]: () => {
    window.open(props.sourceUrl, '_blank', 'noopener');
  },
};
</script>

<template>
  <!-- Static OSM map tile thumbnail + caption + tap-to-open, rendered from
       ChatKit JSON via previewLinkCard (static Image + Text + LINK_OPEN). The
       decorative centered 📍 overlay is dropped (an absolute overlay is not
       expressible in ChatKit JSON). -->
  <ChatKitRenderer :node="node" :registry="registry" />
</template>
