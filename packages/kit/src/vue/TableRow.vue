<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{ header?: boolean; dark?: boolean }>(),
  { dark: false },
);

const style = computed<Record<string, string>>(() => ({
  display: 'flex',
  flexDirection: 'row',
  borderBottomWidth: '1px',
  borderBottomStyle: 'solid',
  borderBottomColor: props.dark ? '#282a2d' : '#e4e4e5',
  backgroundColor: props.header
    ? props.dark
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
