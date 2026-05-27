<script setup lang="ts">
/** Renders a Heroicons v1 outline glyph. Path data lives in
 *  @metro-labs/kit (shared with apps/app/components/HeroIcon.tsx) so the
 *  two clients keep one icon vocabulary. */

import { HERO_ICON_PATHS, HERO_ICON_DEFAULTS, type HeroIconName } from '@metro-labs/kit/icons';

export type { HeroIconName };

const props = defineProps<{ name: HeroIconName; size?: number }>();
const px = computed(() => props.size ?? 20);
</script>

<template>
  <svg :width="px" :height="px" :viewBox="HERO_ICON_DEFAULTS.viewBox">
    <path
      :d="HERO_ICON_PATHS[props.name]"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
