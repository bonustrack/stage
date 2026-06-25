<script setup lang="ts">
import { computed } from 'vue';
import Icon from './Icon.vue';
import { resolveIconName } from './kit-node-props';
import { useKitScheme } from './theme-context';
import type { TabsOption } from '../kit';

const props = withDefaults(
  defineProps<{
    value: string;
    options: TabsOption[];
    variant?: 'segmented' | 'underline';
    dark?: boolean;
  }>(),
  { variant: 'segmented' },
);

const emit = defineEmits<{ 'update:value': [value: string] }>();

const scheme = useKitScheme();
const isDark = computed(() => props.dark ?? scheme === 'dark');
const underline = computed(() => props.variant === 'underline');

const palette = computed(() => ({
  bg: isDark.value ? '#1c1c1e' : '#f0f0f2',
  active: isDark.value ? '#000000' : '#ffffff',
  text: isDark.value ? '#9a9ca0' : '#6b6d72',
  activeText: isDark.value ? '#ffffff' : '#000000',
}));

const containerStyle = computed<Record<string, string>>(() => ({
  display: 'inline-flex',
  flexDirection: 'row',
  gap: underline.value ? '16px' : '4px',
  padding: underline.value ? '0' : '3px',
  borderRadius: '11px',
  backgroundColor: underline.value ? 'transparent' : palette.value.bg,
}));

function tabStyle(selected: boolean): Record<string, string> {
  const p = palette.value;
  if (underline.value) {
    return {
      display: 'inline-flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 2px',
      border: '0',
      background: 'none',
      borderBottom: `2px solid ${selected ? p.activeText : 'transparent'}`,
      color: selected ? p.activeText : p.text,
      fontFamily: 'Calibre-Semibold',
      fontSize: '14px',
      cursor: 'pointer',
    };
  }
  return {
    flex: '1',
    display: 'inline-flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '7px 12px',
    borderRadius: '8px',
    border: '0',
    backgroundColor: selected ? p.active : 'transparent',
    color: selected ? p.activeText : p.text,
    fontFamily: 'Calibre-Semibold',
    fontSize: '14px',
    cursor: 'pointer',
  };
}
</script>

<template>
  <div role="tablist" :style="containerStyle">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      role="tab"
      :aria-selected="opt.value === value"
      :style="tabStyle(opt.value === value)"
      @click="emit('update:value', opt.value)"
    >
      <Icon
        v-if="opt.icon"
        :name="resolveIconName(opt.icon)"
        :size="16"
        :color="opt.value === value ? palette.activeText : palette.text"
      />
      {{ opt.label }}
    </button>
  </div>
</template>
