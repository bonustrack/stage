<script setup lang="ts">
import { computed } from 'vue';
import { useKitScheme } from './theme-context';

const props = withDefaults(
  defineProps<{ header?: boolean; dark?: boolean }>(),
  {},
);

const scheme = useKitScheme();
const isDark = computed(() => props.dark ?? scheme === 'dark');

const style = computed<Record<string, string>>(() => ({
  display: 'flex',
  flexDirection: 'row',
  borderBottomWidth: '1px',
  borderBottomStyle: 'solid',
  borderBottomColor: isDark.value ? '#282a2d' : '#e4e4e5',
  backgroundColor: props.header
    ? isDark.value
      ? 'rgba(255,255,255,0.04)'
      : 'rgba(0,0,0,0.03)'
    : 'transparent',
}));
</script>

<template>
  <div :style="style">
    <slot />
  </div>
</template>
