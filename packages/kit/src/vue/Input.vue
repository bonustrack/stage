<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  controlBoxStyle,
  controlColors,
  controlTextStyle,
  type ControlSize,
  type ControlVariant,
} from '../control.styles';
import { BLOCK_RADIUS_DEFAULT } from '../tokens';
import { useKitScheme } from './theme-context';

export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';

const props = withDefaults(
  defineProps<{
    name?: string;
    modelValue?: string;
    placeholder?: string;
    variant?: ControlVariant;
    size?: ControlSize;
    pill?: boolean;
    disabled?: boolean;
    inputType?: InputType;
    autoFocus?: boolean;
    radius?: number;
    dark?: boolean;
  }>(),
  { variant: 'soft', size: 'md', inputType: 'text' },
);

const scheme = useKitScheme();
const isDark = computed(() => props.dark ?? scheme === 'dark');

const emit = defineEmits<{
  'update:modelValue': [value: string];
  submit: [value: string];
}>();

const focused = ref(false);

const colors = computed(() => controlColors(props.variant, isDark.value));
const corner = computed(() => props.radius ?? (props.pill ? 999 : BLOCK_RADIUS_DEFAULT));

function toCss(entries: Record<string, string | number>): Record<string, string> {
  const css: Record<string, string> = {};
  for (const [k, v] of Object.entries(entries)) {
    css[k] = typeof v === 'number' ? `${v}px` : v;
  }
  return css;
}

const style = computed<Record<string, string>>(() => {
  const box = controlBoxStyle(props.size, props.variant, colors.value, corner.value, focused.value);
  const text = controlTextStyle(props.size, colors.value);
  const css = { ...toCss(box as Record<string, string | number>), ...toCss(text as Record<string, string | number>) };
  css.borderStyle = 'solid';
  css.outline = 'none';
  css.width = '100%';
  css.fontFamily = 'Calibre-Medium';
  if (props.disabled) css.opacity = '0.5';
  return css;
});

function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value);
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') emit('submit', (event.target as HTMLInputElement).value);
}

const nativeType = computed(() => (props.inputType === 'number' ? 'number' : props.inputType));
</script>

<template>
  <input
    :name="name"
    :type="nativeType"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :autofocus="autoFocus"
    :style="style"
    @input="onInput"
    @keydown="onKeydown"
    @focus="focused = true"
    @blur="focused = false"
  />
</template>
