<script setup lang="ts">
import Box from './Box.vue';
import type { BoxBaseProps } from '../layout';
import type { Surface } from './Box.vue';

defineProps<Omit<BoxBaseProps, 'direction'> & { surface?: Surface; tag?: string; positionStyle?: Record<string, string> }>();
</script>

<template>
  <Box direction="col" v-bind="$props">
    <slot />
  </Box>
</template>
