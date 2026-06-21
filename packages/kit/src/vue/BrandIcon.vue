<script setup lang="ts">
import { computed } from 'vue';
import { HERO_ICON_DEFAULTS } from '../icons';
import { brandIconPath, type BrandIconName } from '../brand-icons.data';

export type { BrandIconName };

const props = withDefaults(
  defineProps<{
    name: BrandIconName;
    size?: number;
    color?: string;
    dark?: boolean;
  }>(),
  { size: 22 },
);

const fill = computed(() =>
  props.color ?? (props.dark === undefined ? 'currentColor' : props.dark ? '#ffffff' : '#000000'),
);

const path = computed(() => brandIconPath(props.name));
</script>

<template>
  <svg :width="size" :height="size" :viewBox="HERO_ICON_DEFAULTS.viewBox">
    <path :d="path" :fill="fill" stroke="none" />
  </svg>
</template>
