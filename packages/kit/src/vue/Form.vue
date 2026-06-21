<script setup lang="ts">
import Box from './Box.vue';
import type { BoxBaseProps } from '../layout';
import type { Surface } from './Box.vue';

withDefaults(
  defineProps<
    Omit<BoxBaseProps, 'direction'> & {
      direction?: 'row' | 'col';
      surface?: Surface;
    }
  >(),
  { direction: 'col', gap: 12 },
);

const emit = defineEmits<{ submit: [] }>();

function onSubmit(event: Event): void {
  event.preventDefault();
  emit('submit');
}
</script>

<template>
  <Box tag="form" :direction="direction" v-bind="$props" @submit="onSubmit">
    <slot />
  </Box>
</template>
