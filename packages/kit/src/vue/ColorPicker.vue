<script setup lang="ts">
import { computed } from 'vue';
import Icon from './Icon.vue';
import { useKitScheme } from './theme-context';

const DEFAULT_SWATCHES = [
  '#000000',
  '#ffffff',
  '#eb4c5b',
  '#e07a0c',
  '#e0a106',
  '#1f9d57',
  '#2f6df6',
  '#8b5cf6',
];

const props = withDefaults(
  defineProps<{
    value: string;
    swatches?: string[];
    dark?: boolean;
  }>(),
  {},
);

const emit = defineEmits<{ 'update:value': [value: string] }>();

const scheme = useKitScheme();
const isDark = computed(() => props.dark ?? scheme === 'dark');
const list = computed(() => props.swatches ?? DEFAULT_SWATCHES);
const border = computed(() => (isDark.value ? '#3a3c40' : '#d8d8da'));

function readable(hex: string): string {
  const group = /^#?([0-9a-f]{6})$/i.exec(hex.trim())?.[1];
  if (group === undefined) return '#ffffff';
  const n = Number.parseInt(group, 16);
  const lum =
    (0.299 * ((n >> 16) & 0xff) + 0.587 * ((n >> 8) & 0xff) + 0.114 * (n & 0xff)) / 255;
  return lum > 0.6 ? '#000000' : '#ffffff';
}

function swatchStyle(hex: string): Record<string, string> {
  return {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    backgroundColor: hex,
    border: `1px solid ${border.value}`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0',
    cursor: 'pointer',
  };
}
</script>

<template>
  <div :style="{ display: 'flex', flexWrap: 'wrap', gap: '10px' }">
    <button
      v-for="hex in list"
      :key="hex"
      type="button"
      :aria-pressed="hex.toLowerCase() === value.toLowerCase()"
      :style="swatchStyle(hex)"
      @click="emit('update:value', hex)"
    >
      <Icon
        v-if="hex.toLowerCase() === value.toLowerCase()"
        name="check"
        :size="18"
        :color="readable(hex)"
      />
    </button>
  </div>
</template>
