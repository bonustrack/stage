<script setup lang="ts">
/** Renders a Heroicons v1 outline glyph. Path data lives in
 *  @stage-labs/kit (shared with apps/app/components/HeroIcon.tsx) so the
 *  two clients keep one icon vocabulary. */

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
