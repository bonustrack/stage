<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(
  defineProps<{
    pressedOpacity?: number;
    disabled?: boolean;
    tag?: string;
  }>(),
  { tag: 'div' },
);

const emit = defineEmits<{ press: [event: MouseEvent] }>();

const pressed = ref(false);

function onClick(event: MouseEvent): void {
  if (props.disabled) return;
  emit('press', event);
}
</script>

<template>
  <component
    :is="tag"
    role="button"
    :style="{
      cursor: disabled ? 'default' : 'pointer',
      opacity: pressedOpacity !== undefined && pressed ? String(pressedOpacity) : '1',
    }"
    @click="onClick"
    @pointerdown="pressed = true"
    @pointerup="pressed = false"
    @pointerleave="pressed = false"
  >
    <slot :pressed="pressed" />
  </component>
</template>
