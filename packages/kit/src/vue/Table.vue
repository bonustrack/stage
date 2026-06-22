<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{ dark?: boolean }>(),
  { dark: false },
);

const style = computed<Record<string, string>>(() => ({
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: props.dark ? '#282a2d' : '#e4e4e5',
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
