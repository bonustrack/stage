<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    padding?: number;
    gap?: number;
    horizontal?: boolean;
  }>(),
  { horizontal: false },
);

const style = computed<Record<string, string>>(() => {
  const css: Record<string, string> = {
    display: 'flex',
    flexDirection: props.horizontal ? 'row' : 'column',
    overflowX: props.horizontal ? 'auto' : 'hidden',
    overflowY: props.horizontal ? 'hidden' : 'auto',
  };
  if (props.padding !== undefined) css.padding = `${props.padding}px`;
  if (props.gap !== undefined) css.gap = `${props.gap}px`;
  return css;
});
</script>

<template>
  <div :style="style">
    <slot />
  </div>
</template>
