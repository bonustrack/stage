<script setup lang="ts">
import { computed } from 'vue';
import { heroIconPaths, iconStroke, iconStrokeWidth, HERO_ICON_DEFAULTS, type HeroIconName } from '../icons';

export type { HeroIconName };

const props = withDefaults(
  defineProps<{
    name: HeroIconName;
    size?: number;
    color?: string;
    dark?: boolean;
    focused?: boolean;
  }>(),
  { size: 22 },
);

const stroke = computed(() => iconStroke(props.color, props.dark));

const strokeWidth = computed(() => iconStrokeWidth(props.focused));

const paths = computed(() => heroIconPaths(props.name));
</script>

<template>
  <svg :width="size" :height="size" :viewBox="HERO_ICON_DEFAULTS.viewBox">
    <path
      v-for="(d, i) in paths"
      :key="i"
      :d="d"
      fill="none"
      :stroke="stroke"
      :stroke-width="strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
