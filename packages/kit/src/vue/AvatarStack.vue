<script setup lang="ts">
import { computed } from 'vue';
import { useKitScheme } from './theme-context';
import type { AvatarStackItem } from '../kit';

const props = withDefaults(
  defineProps<{
    items: AvatarStackItem[];
    size?: number;
    max?: number;
    overlap?: number;
    ring?: string;
    fallbackBackground?: string;
    moreBackground?: string;
    moreColor?: string;
    moreFontSize?: number;
    dark?: boolean;
  }>(),
  { size: 32, max: 4, overlap: 10 },
);

const scheme = useKitScheme();
const isDark = computed(() => props.dark ?? scheme === 'dark');

const shown = computed(() => props.items.slice(0, props.max));
const extra = computed(() => props.items.length - shown.value.length);
const ring = computed(() => props.ring ?? (isDark.value ? '#000000' : '#ffffff'));

function cellStyle(index: number): Record<string, string> {
  return {
    marginLeft: index === 0 ? '0' : `-${props.overlap}px`,
    width: `${props.size}px`,
    height: `${props.size}px`,
    borderRadius: '50%',
    border: `2px solid ${ring.value}`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: props.fallbackBackground ?? (isDark.value ? '#3a3c40' : '#d8d8da'),
    color: isDark.value ? '#ffffff' : '#000000',
    fontFamily: 'Calibre-Semibold',
    fontSize: `${props.size * 0.4}px`,
    boxSizing: 'border-box',
  };
}

const moreStyle = computed<Record<string, string>>(() => ({
  marginLeft: `-${props.overlap}px`,
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderRadius: '50%',
  border: `2px solid ${ring.value}`,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: props.moreBackground ?? (isDark.value ? '#1c1c1e' : '#f0f0f2'),
  color: props.moreColor ?? (isDark.value ? '#ffffff' : '#000000'),
  fontFamily: 'Calibre-Semibold',
  fontSize: `${props.moreFontSize ?? props.size * 0.34}px`,
  boxSizing: 'border-box',
}));
</script>

<template>
  <div :style="{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center' }">
    <span v-for="(item, index) in shown" :key="index" :style="cellStyle(index)">
      <img
        v-if="item.src"
        :src="item.src"
        alt=""
        :style="{ width: '100%', height: '100%', objectFit: 'cover' }"
      />
      <template v-else>{{ (item.fallback ?? '?').slice(0, 2) }}</template>
    </span>
    <span v-if="extra > 0" :style="moreStyle">+{{ extra }}</span>
  </div>
</template>
