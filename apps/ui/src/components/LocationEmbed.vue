<script setup lang="ts">
/** Location preview card — single OSM tile at z14 with a 📍 emoji overlay.
 *  Click → opens the original maps URL in a new tab. */

import { osmTileUrl } from '../lib/embedDetect';

const props = defineProps<{ lat: number; lng: number; sourceUrl: string }>();

const tileUrl = computed(() => osmTileUrl(props.lat, props.lng, 14));
const label = computed(() => `${props.lat.toFixed(4)}, ${props.lng.toFixed(4)}`);

function open(): void { window.open(props.sourceUrl, '_blank', 'noopener'); }
</script>

<template>
  <MediaCard :on-press="open">
    <div class="relative aspect-square bg-metro-bg-dark">
      <img :src="tileUrl" :alt="`Map at ${label}`" class="w-full h-full object-cover" />
      <div class="absolute inset-0 flex items-center justify-center text-3xl">📍</div>
    </div>
    <div class="px-2.5 py-1.5">
      <div class="text-xs text-metro-head-light dark:text-metro-head-dark font-head">Location</div>
      <div class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark">{{ label }} · tap to open</div>
    </div>
  </MediaCard>
</template>
