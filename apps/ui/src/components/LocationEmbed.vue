<script setup lang="ts">

import { computed } from 'vue';
import ViewHost from '@stage-labs/kit/vue/view-host';
import { listRoot, previewLinkCard, LINK_OPEN } from '@stage-labs/views';
import { osmTileUrl } from '@stage-labs/client/embed/detect';

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

const actions = {
  [LINK_OPEN]: (): void => {
    window.open(props.sourceUrl, '_blank', 'noopener');
  },
};
</script>

<template>
  <!-- Static OSM map tile thumbnail + caption + tap-to-open, rendered from
       Kit JSON via previewLinkCard (static Image + Text + LINK_OPEN). The
       decorative centered 📍 overlay is dropped (an absolute overlay is not
       expressible in Kit JSON). -->
  <ViewHost :node="node" :actions="actions" />
</template>
