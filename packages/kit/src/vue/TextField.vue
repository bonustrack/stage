<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { controlColors, textFieldSpec } from '../control.styles';
import { BLOCK_RADIUS_DEFAULT } from '../tokens';
import { useKitScheme } from './theme-context';

const props = withDefaults(
  defineProps<{
    name?: string;
    value: string;
    placeholder?: string;
    multiline?: boolean;
    rows?: number;
    autoFocus?: boolean;
    autoGrow?: boolean;
    disabled?: boolean;
    selection?: { start: number; end: number };
    focusNonce?: number;
    blurNonce?: number;
    variant?: 'outline' | 'plain';
    background?: string;
    borderColor?: string;
    radius?: number | string;
    paddingX?: number | string;
    paddingY?: number | string;
    paddingTop?: number | string;
    paddingBottom?: number | string;
    lineHeight?: number;
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    placeholderColor?: string;
    noFocusBorder?: boolean;
    maxLength?: number;
    maxHeight?: number | string;
    minHeight?: number | string;
    enterKeyHint?: 'done' | 'go' | 'next' | 'search' | 'send';
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    autoCorrect?: boolean;
    inputMode?: 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url' | 'none';
    dark?: boolean;
  }>(),
  {},
);

const emit = defineEmits<{
  'update:value': [value: string];
  selectionChange: [range: { start: number; end: number }];
  submit: [];
}>();

const scheme = useKitScheme();
const isDark = computed(() => props.dark ?? scheme === 'dark');
const focused = ref(false);
const inputEl = ref<HTMLInputElement | HTMLTextAreaElement | null>(null);

watch(
  () => props.focusNonce,
  (next, prev) => {
    if (next === undefined || next === prev) return;
    inputEl.value?.focus();
  },
);

watch(
  () => props.blurNonce,
  (next, prev) => {
    if (next === undefined || next === prev) return;
    inputEl.value?.blur();
  },
);

function autoGrowEl(): void {
  const el = inputEl.value;
  if (!el || !props.multiline || !props.autoGrow) return;
  el.style.height = 'auto';
  const max = typeof props.maxHeight === 'number' ? props.maxHeight : Infinity;
  el.style.height = `${Math.min(el.scrollHeight, max)}px`;
}

onMounted(() => {
  void nextTick(autoGrowEl);
});

watch(
  () => props.value,
  () => {
    void nextTick(autoGrowEl);
  },
);

function px(v: number | string | undefined): string | undefined {
  if (v === undefined) return undefined;
  return typeof v === 'number' ? `${v}px` : v;
}

function multilineMinHeight(): string {
  if (!props.multiline) return `${spec.value.minHeight}px`;
  return props.autoGrow ? '44px' : '88px';
}

const spec = computed(() => {
  const baseColors = controlColors(
    props.variant === 'plain' ? 'soft' : 'outline',
    isDark.value,
  );
  return textFieldSpec({
    variant: props.variant,
    focused: focused.value,
    defaultRadius: BLOCK_RADIUS_DEFAULT,
    baseColors,
    background: props.background,
    borderColor: props.borderColor,
    radius: props.radius,
    paddingX: props.paddingX,
    paddingY: props.paddingY,
    fontSize: props.fontSize,
    fontFamily: props.fontFamily,
    color: props.color,
    noFocusBorder: props.noFocusBorder,
  });
});

const style = computed<Record<string, string>>(() => {
  const s = spec.value;
  const padX = px(s.paddingX) ?? '0';
  const padY = px(s.paddingY) ?? '0';
  const css: Record<string, string> = {
    minHeight: px(props.minHeight) ?? multilineMinHeight(),
    paddingLeft: padX,
    paddingRight: padX,
    paddingTop: padY,
    paddingBottom: padY,
    backgroundColor: s.background,
    borderRadius: px(s.radius) ?? '0',
    borderWidth: `${s.borderWidth}px`,
    borderColor: s.borderColor,
    color: s.color,
    fontSize: `${s.fontSize}px`,
    fontFamily: s.fontFamily,
    borderStyle: 'solid',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };
  if (props.multiline) {
    css.textAlign = 'left';
    css.resize = 'none';
  }
  applyOverrides(css);
  return css;
});

function applyOverrides(css: Record<string, string>): void {
  const padTop = px(props.paddingTop);
  if (padTop !== undefined) css.paddingTop = padTop;
  const padBottom = px(props.paddingBottom);
  if (padBottom !== undefined) css.paddingBottom = padBottom;
  if (props.lineHeight !== undefined) css.lineHeight = `${props.lineHeight}px`;
  const maxH = px(props.maxHeight);
  if (maxH !== undefined) css.maxHeight = maxH;
  if (props.disabled) css.opacity = '0.5';
}

const placeholderColor = computed(() => {
  if (props.placeholderColor !== undefined) return props.placeholderColor;
  return controlColors('outline', isDark.value).placeholder;
});

const autocorrectAttr = computed<'on' | 'off' | undefined>(() => {
  if (props.autoCorrect === undefined) return undefined;
  return props.autoCorrect ? 'on' : 'off';
});

const spellcheckAttr = computed<boolean | undefined>(() => {
  if (props.autoCorrect === undefined) return undefined;
  return props.autoCorrect;
});

function onInput(event: Event): void {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement;
  emit('update:value', target.value);
  emitSelection(target);
  autoGrowEl();
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

function onKeyup(event: KeyboardEvent): void {
  onSelect(event);
  if (!props.multiline && event.key === 'Enter') emit('submit');
}
</script>

<template>
  <textarea
    v-if="multiline"
    ref="inputEl"
    :name="name"
    :rows="rows"
    :value="value"
    :placeholder="placeholder"
    :disabled="disabled"
    :autofocus="autoFocus"
    :maxlength="maxLength"
    :enterkeyhint="enterKeyHint"
    :autocapitalize="autoCapitalize"
    :autocorrect="autocorrectAttr"
    :spellcheck="spellcheckAttr"
    :inputmode="inputMode"
    :style="{ ...style, '--kit-placeholder': placeholderColor }"
    @input="onInput"
    @select="onSelect"
    @keyup="onKeyup"
    @click="onSelect"
    @focus="focused = true"
    @blur="focused = false"
  />
  <input
    v-else
    ref="inputEl"
    :name="name"
    :value="value"
    :placeholder="placeholder"
    :disabled="disabled"
    :autofocus="autoFocus"
    :maxlength="maxLength"
    :enterkeyhint="enterKeyHint"
    :autocapitalize="autoCapitalize"
    :autocorrect="autocorrectAttr"
    :spellcheck="spellcheckAttr"
    :inputmode="inputMode"
    :style="{ ...style, '--kit-placeholder': placeholderColor }"
    @input="onInput"
    @select="onSelect"
    @keyup="onKeyup"
    @click="onSelect"
    @focus="focused = true"
    @blur="focused = false"
  />
</template>

<style scoped>
input::placeholder,
textarea::placeholder {
  color: var(--kit-placeholder);
}
</style>
