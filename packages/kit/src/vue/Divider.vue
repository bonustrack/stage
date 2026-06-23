<script setup lang="ts">
import { computed } from 'vue';
import { useKitScheme } from './theme-context';

const props = withDefaults(
  defineProps<{
    spacing?: number;
    color?: string;
    size?: number;
    flush?: number | boolean;
    dark?: boolean;
  }>(),
  { spacing: 0, size: 1, flush: false },
);

const scheme = useKitScheme();
const isDark = computed(() => props.dark ?? scheme === 'dark');

function borderColor(dark: boolean): string {
  return dark ? '#282a2d' : '#e4e4e5';
}

const style = computed<Record<string, string>>(() => {
  const bleed = props.flush === true ? 16 : typeof props.flush === 'number' ? props.flush : 0;
  return {
    height: `${props.size}px`,
    backgroundColor: props.color ?? borderColor(isDark.value),
    marginTop: `${props.spacing}px`,
    marginBottom: `${props.spacing}px`,
    marginLeft: bleed ? `${-bleed}px` : '0',
    marginRight: bleed ? `${-bleed}px` : '0',
  };
});
</script>

<template>
  <div :style="style" />
</template>
