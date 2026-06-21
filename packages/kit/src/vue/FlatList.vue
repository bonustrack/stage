<script setup lang="ts" generic="T">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    data?: T[];
    horizontal?: boolean;
    gap?: number;
    padding?: number;
    keyField?: keyof T;
  }>(),
  { data: () => [], horizontal: false },
);

function itemKey(item: T, index: number): string | number {
  if (props.keyField) {
    const k: unknown = item[props.keyField];
    if (typeof k === 'string' || typeof k === 'number') return k;
  }
  return index;
}

const style = computed<Record<string, string>>(() => {
  const css: Record<string, string> = {
    display: 'flex',
    flexDirection: props.horizontal ? 'row' : 'column',
    overflowX: props.horizontal ? 'auto' : 'hidden',
    overflowY: props.horizontal ? 'hidden' : 'auto',
  };
  if (props.gap !== undefined) css.gap = `${props.gap}px`;
  if (props.padding !== undefined) css.padding = `${props.padding}px`;
  return css;
});
</script>

<template>
  <div :style="style">
    <div v-for="(item, index) in data" :key="itemKey(item, index)" :style="{ display: 'contents' }">
      <slot name="item" :item="item" :index="index" />
    </div>
    <slot v-if="data.length === 0" name="empty" />
  </div>
</template>
