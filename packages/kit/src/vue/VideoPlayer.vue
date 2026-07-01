<script setup lang="ts">
withDefaults(
  defineProps<{
    src: string;
    poster?: string;
    controls?: boolean;
  }>(),
  { controls: true },
);
</script>

<template>
  <video
    :src="src"
    :poster="poster"
    :controls="controls"
    preload="metadata"
    :style="{
      width: '100%',
      aspectRatio: '16 / 9',
      borderRadius: '12px',
      backgroundColor: '#000000',
      display: 'block',
    }"
  />
</template>
