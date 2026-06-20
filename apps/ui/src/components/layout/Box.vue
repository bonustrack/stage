<script setup lang="ts">

import { computed } from 'vue';
import { boxInlineStyle, type BoxProps } from './boxStyle';

const props = defineProps<
  BoxProps & {
    as?: string;
    style?: Record<string, string>;
  }
>();

const computedStyle = computed(() => ({
  ...boxInlineStyle(props),
  ...(props.style ?? {}),
}));
</script>

<template>
  <component :is="as ?? 'div'" :style="computedStyle">
    <slot />
  </component>
</template>
