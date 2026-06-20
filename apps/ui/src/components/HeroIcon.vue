<script setup lang="ts">

import { heroIconPaths, HERO_ICON_DEFAULTS, type HeroIconName } from '@stage-labs/kit/icons';

export type { HeroIconName };

const props = defineProps<{ name: HeroIconName; size?: number }>();
const px = computed(() => props.size ?? 20);
const paths = computed(() => heroIconPaths(props.name));
</script>

<template>
  <svg :width="px" :height="px" :viewBox="HERO_ICON_DEFAULTS.viewBox">
    <path
      v-for="(d, i) in paths"
      :key="i"
      :d="d"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
