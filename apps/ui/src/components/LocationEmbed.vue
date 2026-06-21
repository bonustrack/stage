<script setup lang="ts">

import { osmTileUrl } from '../lib/embedDetect';

const props = defineProps<{ lat: number; lng: number; sourceUrl: string }>();

const tileUrl = computed(() => osmTileUrl(props.lat, props.lng, 14));
const label = computed(() => `${props.lat.toFixed(4)}, ${props.lng.toFixed(4)}`);

function open(): void { window.open(props.sourceUrl, '_blank', 'noopener'); }
</script>

<template>
  <MediaCard :on-press="open">
    <Col class="relative aspect-square bg-metro-bg-dark">
      <img :src="tileUrl" :alt="`Map at ${label}`" class="w-full h-full object-cover" />
      <Row class="absolute inset-0 flex items-center justify-center text-3xl">📍</Row>
    </Col>
    <Col class="px-2.5 py-1.5">
      <Col class="text-xs text-metro-head-light dark:text-metro-head-dark font-head">Location</Col>
      <Col class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark">{{ label }} · tap to open</Col>
    </Col>
  </MediaCard>
</template>
