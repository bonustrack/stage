<script setup lang="ts">
import { computed, ref } from 'vue';
import { schemePalette } from '../tokens';
import { useKitScheme } from './theme-context';

export type ListItemAlign = 'start' | 'center' | 'end';

const ROW_INSET = 16;

const ALIGN: Record<ListItemAlign, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
};

const props = withDefaults(
  defineProps<{
    pressable?: boolean;
    gap?: number;
    align?: ListItemAlign;
    dark?: boolean;
  }>(),
  { gap: 12, align: 'center' },
);

const emit = defineEmits<{ press: [] }>();

const pressed = ref(false);
const scheme = useKitScheme();
const isDark = computed(() => props.dark ?? scheme === 'dark');
const c = computed(() => schemePalette(isDark.value));

const style = computed<Record<string, string>>(() => ({
  display: 'flex',
  flexDirection: 'row',
  alignItems: ALIGN[props.align],
  gap: `${props.gap}px`,
  paddingTop: '16px',
  paddingBottom: '16px',
  paddingLeft: `${ROW_INSET}px`,
  paddingRight: `${ROW_INSET}px`,
  backgroundColor: props.pressable && pressed.value ? c.value.pressed : 'transparent',
  cursor: props.pressable ? 'pointer' : 'default',
}));

function onClick(): void {
  if (props.pressable) emit('press');
}
</script>

<template>
  <component
    :is="pressable ? 'button' : 'div'"
    :style="style"
    @click="onClick"
    @pointerdown="pressed = true"
    @pointerup="pressed = false"
    @pointerleave="pressed = false"
  >
    <slot />
  </component>
</template>
