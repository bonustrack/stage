<script setup lang="ts">
import { computed } from 'vue';
import KitNode from './KitNode.vue';
import type { ScrollRowNode } from '../kit';

const props = defineProps<{ node: ScrollRowNode }>();

function spacing(value: ScrollRowNode['padding']): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return `${value}px`;
  if (typeof value === 'string') return value;
  const y = value.y ?? value.top ?? 0;
  const x = value.x ?? value.left ?? 0;
  return `${typeof y === 'number' ? `${y}px` : y} ${typeof x === 'number' ? `${x}px` : x}`;
}

const style = computed<Record<string, string>>(() => {
  const css: Record<string, string> = {
    display: 'flex',
    flexDirection: 'row',
    overflowX: 'auto',
    overflowY: 'hidden',
  };
  if (props.node.gap !== undefined) {
    css.gap = typeof props.node.gap === 'number' ? `${props.node.gap}px` : props.node.gap;
  }
  const pad = spacing(props.node.padding);
  if (pad !== undefined) css.padding = pad;
  return css;
});
</script>

<template>
  <div :style="style">
    <KitNode v-for="(c, i) in node.children" :key="i" :node="c" />
  </div>
</template>
