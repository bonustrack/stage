<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    minSize?: number | string;
    flex?: number;
  }>(),
  { flex: 1 },
);

function toLength(v: number | string | undefined): string | undefined {
  if (v === undefined) return undefined;
  return typeof v === 'number' ? `${v}px` : v;
}

const style = computed<Record<string, string>>(() => {
  const css: Record<string, string> = { flex: String(props.flex) };
  const min = toLength(props.minSize);
  if (min !== undefined) {
    css.minWidth = min;
    css.minHeight = min;
  }
  return css;
});
</script>

<template>
  <div :style="style" />
</template>
