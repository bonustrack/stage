<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  CONTROL_SIZES,
  controlBoxStyle,
  controlColors,
  controlTextStyle,
  type ControlSize,
  type ControlVariant,
} from '../control.styles';
import { BLOCK_RADIUS_DEFAULT } from '../tokens';
import { useKitScheme } from './theme-context';

function lineHeight(size: ControlSize): number {
  return Math.round(CONTROL_SIZES[size].fontSize * 1.4);
}

const props = withDefaults(
  defineProps<{
    name?: string;
    modelValue?: string;
    placeholder?: string;
    variant?: ControlVariant;
    size?: ControlSize;
    disabled?: boolean;
    rows?: number;
    maxRows?: number;
    autoResize?: boolean;
    autoFocus?: boolean;
    required?: boolean;
    radius?: number;
    dark?: boolean;
  }>(),
  { variant: 'soft', size: 'md', rows: 3, autoResize: true },
);

const scheme = useKitScheme();
const isDark = computed(() => props.dark ?? scheme === 'dark');

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const focused = ref(false);
const fieldId = computed(() => (props.name ? `input-${props.name}` : undefined));

const colors = computed(() => controlColors(props.variant, isDark.value));
const corner = computed(() => props.radius ?? BLOCK_RADIUS_DEFAULT);

function toCss(entries: Record<string, string | number>): Record<string, string> {
  const css: Record<string, string> = {};
  for (const [k, v] of Object.entries(entries)) {
    css[k] = typeof v === 'number' ? `${v}px` : v;
  }
  return css;
}

function resolveHeight(): number {
  const lh = lineHeight(props.size);
  const minH = props.rows * lh;
  if (!props.autoResize) return minH;
  const maxH = props.maxRows ? props.maxRows * lh : Number.MAX_SAFE_INTEGER;
  return Math.min(Math.max(minH, minH), maxH);
}

const style = computed<Record<string, string>>(() => {
  const box = controlBoxStyle(props.size, props.variant, colors.value, corner.value, focused.value);
  const text = controlTextStyle(props.size, colors.value);
  const css = {
    ...toCss(box as Record<string, string | number>),
    ...toCss(text as Record<string, string | number>),
  };
  css.borderStyle = 'solid';
  css.outline = 'none';
  css.width = '100%';
  css.resize = props.autoResize ? 'vertical' : 'none';
  css.fontFamily = 'Calibre-Medium';
  if (props.autoResize) {
    css.minHeight = `${resolveHeight()}px`;
    if (props.maxRows) css.maxHeight = `${props.maxRows * lineHeight(props.size)}px`;
  } else {
    css.height = `${resolveHeight()}px`;
  }
  if (props.disabled) css.opacity = '0.5';
  return css;
});

function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value);
}
</script>

<template>
  <textarea
    :id="fieldId"
    :name="name"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :required="required"
    :autofocus="autoFocus"
    :rows="rows"
    :style="style"
    @input="onInput"
    @focus="focused = true"
    @blur="focused = false"
  />
</template>
