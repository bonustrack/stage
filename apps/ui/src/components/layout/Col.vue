<script setup lang="ts">
import { type BoxProps } from './boxStyle';
import Box from './Box.vue';

defineProps<Omit<BoxProps, 'direction'> & { as?: string; style?: Record<string, string> }>();
</script>

<template>
  <Box v-bind="$props" direction="col">
    <slot />
  </Box>
</template>
