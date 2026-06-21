<script setup lang="ts" generic="T">
import { computed } from 'vue';
import { FONT_SIZE, schemePalette } from '../tokens';

const ROW_INSET = 16;

const props = withDefaults(
  defineProps<{
    items?: T[];
    limit?: number;
    status?: { text: string };
    dark: boolean;
    keyField?: keyof T;
  }>(),
  { items: () => [] },
);

const c = computed(() => {
  const p = schemePalette(props.dark);
  return { border: p.border, sub: p.sub };
});

const shown = computed(() =>
  props.limit !== undefined ? props.items.slice(0, props.limit) : props.items,
);

function itemKey(item: T, index: number): string | number {
  if (props.keyField) {
    const k: unknown = item[props.keyField];
    if (typeof k === 'string' || typeof k === 'number') return k;
  }
  return index;
}

const dividerStyle = computed<Record<string, string>>(() => ({
  height: '1px',
  backgroundColor: c.value.border,
  marginLeft: `${ROW_INSET}px`,
  marginRight: `${ROW_INSET}px`,
}));

const statusStyle = computed<Record<string, string>>(() => ({
  color: c.value.sub,
  fontSize: `${FONT_SIZE.xs}px`,
  fontFamily: 'Calibre-Medium',
  paddingTop: '10px',
  paddingBottom: '10px',
  paddingLeft: '16px',
  paddingRight: '16px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}));
</script>

<template>
  <div>
    <div v-for="(item, index) in shown" :key="itemKey(item, index)">
      <slot name="item" :item="item" :index="index" />
      <div v-if="index < shown.length - 1" :style="dividerStyle" />
    </div>
    <div v-if="status" :style="statusStyle">{{ status.text }}</div>
  </div>
</template>
