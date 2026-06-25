<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  controlBoxStyle,
  controlColors,
  controlTextStyle,
} from '../control.styles';
import { BLOCK_RADIUS_DEFAULT } from '../tokens';
import { useKitScheme } from './theme-context';

const props = withDefaults(
  defineProps<{
    name?: string;
    value: string;
    placeholder?: string;
    multiline?: boolean;
    autoFocus?: boolean;
    autoGrow?: boolean;
    disabled?: boolean;
    selection?: { start: number; end: number };
    dark?: boolean;
  }>(),
  {},
);

const emit = defineEmits<{
  'update:value': [value: string];
  selectionChange: [range: { start: number; end: number }];
}>();

const scheme = useKitScheme();
const isDark = computed(() => props.dark ?? scheme === 'dark');
const focused = ref(false);

const colors = computed(() => controlColors('outline', isDark.value));

function toCss(entries: Record<string, string | number>): Record<string, string> {
  const css: Record<string, string> = {};
  for (const [k, v] of Object.entries(entries)) {
    css[k] = typeof v === 'number' ? `${v}px` : v;
  }
  return css;
}

const style = computed<Record<string, string>>(() => {
  const box = controlBoxStyle('md', 'outline', colors.value, BLOCK_RADIUS_DEFAULT, focused.value);
  const text = controlTextStyle('md', colors.value);
  const css = {
    ...toCss(box as Record<string, string | number>),
    ...toCss(text as Record<string, string | number>),
  };
  css.borderStyle = 'solid';
  css.outline = 'none';
  css.width = '100%';
  css.fontFamily = 'Calibre-Medium';
  css.boxSizing = 'border-box';
  if (props.multiline) css.minHeight = props.autoGrow ? '44px' : '88px';
  if (props.disabled) css.opacity = '0.5';
  return css;
});

function onInput(event: Event): void {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement;
  emit('update:value', target.value);
  emitSelection(target);
}

function emitSelection(target: HTMLInputElement | HTMLTextAreaElement): void {
  const start = target.selectionStart;
  const end = target.selectionEnd;
  if (start === null || end === null) return;
  emit('selectionChange', { start, end });
}

function onSelect(event: Event): void {
  emitSelection(event.target as HTMLInputElement | HTMLTextAreaElement);
}
</script>

<template>
  <textarea
    v-if="multiline"
    :name="name"
    :value="value"
    :placeholder="placeholder"
    :disabled="disabled"
    :autofocus="autoFocus"
    :style="style"
    @input="onInput"
    @select="onSelect"
    @keyup="onSelect"
    @click="onSelect"
    @focus="focused = true"
    @blur="focused = false"
  />
  <input
    v-else
    :name="name"
    :value="value"
    :placeholder="placeholder"
    :disabled="disabled"
    :autofocus="autoFocus"
    :style="style"
    @input="onInput"
    @select="onSelect"
    @keyup="onSelect"
    @click="onSelect"
    @focus="focused = true"
    @blur="focused = false"
  />
</template>
