<script setup lang="ts">
import { computed } from 'vue';
import KitNode from './KitNode.vue';
import { hasPositioning, resolvePosition, type StackNode, type WidgetNode } from '../kit';

const props = defineProps<{ node: StackNode }>();

function dim(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
}

const ALIGN: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
};

const JUSTIFY: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
};

const containerStyle = computed<Record<string, string>>(() => {
  const css: Record<string, string> = { position: 'relative', display: 'flex' };
  const size = dim(props.node.size);
  const width = dim(props.node.width) ?? size;
  const height = dim(props.node.height) ?? size;
  if (width !== undefined) css.width = width;
  if (height !== undefined) css.height = height;
  if (props.node.align !== undefined) css.alignItems = ALIGN[props.node.align] ?? 'stretch';
  if (props.node.justify !== undefined) {
    css.justifyContent = JUSTIFY[props.node.justify] ?? 'flex-start';
  }
  return css;
});

function childStyle(child: WidgetNode): Record<string, string> {
  if (!hasPositioning(child)) return { position: 'relative' };
  const pos = resolvePosition(child);
  const css: Record<string, string> = { position: pos.position };
  const top = dim(pos.top);
  const right = dim(pos.right);
  const bottom = dim(pos.bottom);
  const left = dim(pos.left);
  if (top !== undefined) css.top = top;
  if (right !== undefined) css.right = right;
  if (bottom !== undefined) css.bottom = bottom;
  if (left !== undefined) css.left = left;
  if (pos.zIndex !== undefined) css.zIndex = String(pos.zIndex);
  return css;
}
</script>

<template>
  <div :style="containerStyle">
    <div v-for="(c, i) in node.children" :key="i" :style="childStyle(c)">
      <KitNode :node="c" />
    </div>
  </div>
</template>
