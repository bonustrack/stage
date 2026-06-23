<script setup lang="ts">
import { computed } from 'vue';
import { useKitScheme } from './theme-context';

const props = withDefaults(
  defineProps<{ dark?: boolean }>(),
  {},
);

const scheme = useKitScheme();
const isDark = computed(() => props.dark ?? scheme === 'dark');

const style = computed<Record<string, string>>(() => ({
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: isDark.value ? '#282a2d' : '#e4e4e5',
  borderRadius: '8px',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}));
</script>

<template>
  <div :style="style">
    <slot />
  </div>
</template>
