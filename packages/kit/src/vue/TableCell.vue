<script setup lang="ts">
import { computed } from 'vue';

export type TableCellAlign = 'start' | 'center' | 'end';

const H_ALIGN: Record<TableCellAlign, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
};

const props = withDefaults(
  defineProps<{
    width?: number | string;
    padding?: number;
    colSpan?: number;
    rowSpan?: number;
    align?: TableCellAlign;
    vAlign?: TableCellAlign;
    colSize?: 'auto' | 'fit' | number;
  }>(),
  { padding: 8, colSpan: 1, align: 'start', vAlign: 'center' },
);

const style = computed<Record<string, string>>(() => {
  const css: Record<string, string> = {
    display: 'flex',
    flexDirection: 'column',
    padding: `${props.padding}px`,
    alignItems: H_ALIGN[props.align],
    justifyContent: H_ALIGN[props.vAlign],
  };
  if (props.width !== undefined) {
    css.width = typeof props.width === 'number' ? `${props.width}px` : props.width;
  } else {
    css.flex = String(props.colSpan);
  }
  return css;
});
</script>

<template>
  <div :style="style">
    <slot />
  </div>
</template>
