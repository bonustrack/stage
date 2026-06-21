<script setup lang="ts">
import { computed } from 'vue';
import { heroIconPaths, HERO_ICON_DEFAULTS, type HeroIconName } from '../icons';

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

const stroke = computed(() =>
  props.color ?? (props.dark === undefined ? 'currentColor' : props.dark ? '#ffffff' : '#000000'),
);

const strokeWidth = computed(() =>
  props.focused ? 2.4 : HERO_ICON_DEFAULTS.strokeWidth,
);

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
