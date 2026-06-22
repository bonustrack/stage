<script setup lang="ts">
import { computed } from 'vue';
import {
  legacyVariantToColor,
  resolveColors,
  SIZES,
  type ButtonColor,
  type ButtonControlVariant,
  type ButtonSize,
  type ButtonVariant,
  type VariantColors,
} from '../button.styles';

export type {
  ButtonColor,
  ButtonControlVariant,
  ButtonSize,
  ButtonVariant,
} from '../button.styles';

const props = withDefaults(
  defineProps<{
    color?: ButtonColor;
    variant?: ButtonControlVariant | ButtonVariant;
    styleColor?: 'primary' | 'secondary';
    size?: ButtonSize;
    label?: string;
    disabled?: boolean;
    loading?: boolean;
    block?: boolean;
    fullWidth?: boolean;
    pill?: boolean;
    uniform?: boolean;
    dark?: boolean;
    tintBg?: string;
    tintFg?: string;
    radius?: number;
  }>(),
  { size: 'md', disabled: false, loading: false, dark: false },
);

const emit = defineEmits<{ click: [event: MouseEvent] }>();

const LEGACY_VARIANTS = new Set<ButtonVariant>(['primary', 'secondary', 'danger']);
const DEFAULT_RADIUS = 999;

function resolveModel(
  color: ButtonColor | undefined,
  variant: ButtonControlVariant | ButtonVariant | undefined,
  styleColor: 'primary' | 'secondary' | undefined,
): { color: ButtonColor; variant: ButtonControlVariant } {
  if (variant && LEGACY_VARIANTS.has(variant as ButtonVariant) && !color) {
    return legacyVariantToColor(variant as ButtonVariant);
  }
  const baseColor: ButtonColor = color ?? styleColor ?? 'primary';
  const treatment: ButtonControlVariant =
    variant && (['solid', 'soft', 'outline', 'ghost'] as string[]).includes(variant)
      ? (variant as ButtonControlVariant)
      : 'solid';
  return { color: baseColor, variant: treatment };
}

const colors = computed<VariantColors>(() => {
  const model = resolveModel(props.color, props.variant, props.styleColor);
  const base = resolveColors(model.color, model.variant, props.dark);
  return { ...base, bg: props.tintBg ?? base.bg, text: props.tintFg ?? base.text };
});

const stretch = computed(() => props.block || props.fullWidth);
const square = computed(() => props.pill || props.uniform);
const isDisabled = computed(() => props.disabled || props.loading);
const spec = computed(() => SIZES[props.size]);

const style = computed<Record<string, string>>(() => {
  const c = colors.value;
  const s = spec.value;
  const css: Record<string, string> = {
    height: `${s.height}px`,
    paddingLeft: square.value ? '0' : `${s.paddingHorizontal}px`,
    paddingRight: square.value ? '0' : `${s.paddingHorizontal}px`,
    borderRadius: `${props.radius ?? DEFAULT_RADIUS}px`,
    display: 'inline-flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: `${s.gap}px`,
    backgroundColor: c.bg,
    color: c.text,
    fontSize: `${s.fontSize}px`,
    fontFamily: 'Calibre-Semibold',
    fontWeight: '600',
    borderWidth: c.borderColor ? '1px' : '0',
    borderStyle: 'solid',
    borderColor: c.borderColor ?? 'transparent',
    cursor: isDisabled.value ? 'default' : 'pointer',
    opacity: isDisabled.value ? '0.4' : '1',
  };
  if (square.value) css.width = `${s.height}px`;
  else if (stretch.value) css.width = '100%';
  return css;
});

function onClick(event: MouseEvent): void {
  if (isDisabled.value) return;
  emit('click', event);
}
</script>

<template>
  <button type="button" :style="style" :disabled="isDisabled" @click="onClick">
    <slot name="iconStart" />
    <slot>{{ label }}</slot>
    <slot name="iconEnd" />
  </button>
</template>
