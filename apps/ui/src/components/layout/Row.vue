<script setup lang="ts">
/** Row — Box with direction locked to 'row'. Same prop API minus `direction`. */
import { type BoxProps } from './boxStyle';
import Box from './Box.vue';

defineProps<Omit<BoxProps, 'direction'> & { as?: string; style?: Record<string, string> }>();
</script>

<template>
  <Box v-bind="$props" direction="row">
    <slot />
  </Box>
</template>
