<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  borderStyleEntries,
  type ResolvedBoxBorder,
} from '../layout';
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
    padding?: Record<string, string | number>;
    border?: ResolvedBoxBorder;
    pressedBackground?: string;
    pressedBorderColor?: string;
    showDivider?: boolean;
  }>(),
  { gap: 12, align: 'center', showDivider: false },
);

const emit = defineEmits<{ press: [] }>();

const pressed = ref(false);
const scheme = useKitScheme();
const isDark = computed(() => props.dark ?? scheme === 'dark');
const c = computed(() => schemePalette(isDark.value));

function px(value: string | number): string {
  return typeof value === 'number' ? `${value}px` : value;
}

const paddingStyle = computed<Record<string, string>>(() => {
  const p = props.padding ?? {
    paddingTop: 16,
    paddingRight: ROW_INSET,
    paddingBottom: 16,
    paddingLeft: ROW_INSET,
  };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) out[k] = px(v);
  return out;
});

const borderStyle = computed<Record<string, string>>(() => {
  if (props.border === undefined) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(borderStyleEntries(props.border))) {
    out[k] = px(v);
  }
  return out;
});

const pressedStyle = computed<Record<string, string>>(() => {
  const out: Record<string, string> = {};
  if (!props.pressable || !pressed.value) return out;
  if (props.pressedBorderColor !== undefined) {
    out.borderColor = props.pressedBorderColor;
    return out;
  }
  out.backgroundColor = props.pressedBackground ?? c.value.pressed;
  return out;
});

const style = computed<Record<string, string>>(() => ({
  display: 'flex',
  flexDirection: 'row',
  alignItems: ALIGN[props.align],
  gap: `${props.gap}px`,
  ...(props.showDivider ? { position: 'relative' } : {}),
  cursor: props.pressable ? 'pointer' : 'default',
  ...paddingStyle.value,
  ...borderStyle.value,
  ...pressedStyle.value,
}));

const dividerStyle = computed<Record<string, string>>(() => ({
  position: 'absolute',
  left: `${ROW_INSET}px`,
  right: `${ROW_INSET}px`,
  bottom: '0',
  height: '1px',
  backgroundColor: c.value.border,
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
    <div v-if="showDivider" :style="dividerStyle" />
  </component>
</template>
