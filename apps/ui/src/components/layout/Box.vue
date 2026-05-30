<script setup lang="ts">
/** Box — generic flex container layout primitive.
 *
 *  Shares its prop API (gap/padding/align/justify/...) with the React Native
 *  Box in apps/app so call-sites read the same across platforms. Numbers are
 *  px. The `class` passthrough keeps Tailwind utilities working (the app's
 *  existing convention) for color/responsive/etc; inline `:style` (computed
 *  from the props) wins where it sets a property, and the `style` prop
 *  passthrough wins last as an escape hatch. */

import { computed } from 'vue';
import { boxInlineStyle, type BoxProps } from './boxStyle';

const props = defineProps<
  BoxProps & {
    /** render element tag, default 'div' */
    as?: string;
    /** escape hatch — merged AFTER computed style, so overrides win */
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
