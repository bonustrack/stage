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
import { useKitScheme } from './theme-context';

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
    tintPressedBg?: string;
    radius?: number;
    paddingX?: number | string;
    paddingY?: number | string;
    fontFamily?: string;
    fontSize?: number;
  }>(),
  { size: 'md', disabled: false, loading: false },
);

const scheme = useKitScheme();
const isDark = computed(() => props.dark ?? scheme === 'dark');

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
  const base = resolveColors(model.color, model.variant, isDark.value);
  return { ...base, bg: props.tintBg ?? base.bg, text: props.tintFg ?? base.text };
});

const stretch = computed(() => props.block || props.fullWidth);
const square = computed(() => props.pill || props.uniform);
const isDisabled = computed(() => props.disabled || props.loading);
const spec = computed(() => SIZES[props.size]);

function dim(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
}

function buttonTypography(
  s: (typeof SIZES)[ButtonSize],
): { borderRadius: string; fontSize: string; fontFamily: string } {
  return {
    borderRadius: `${props.radius ?? DEFAULT_RADIUS}px`,
    fontSize: `${props.fontSize ?? s.fontSize}px`,
    fontFamily: props.fontFamily ?? 'Calibre-Semibold',
  };
}

function buildButtonCss(
  c: VariantColors,
  s: (typeof SIZES)[ButtonSize],
  disabled: boolean,
): Record<string, string> {
  const padY = dim(props.paddingY);
  const t = buttonTypography(s);
  const padX = square.value ? '0' : dim(props.paddingX) ?? `${s.paddingHorizontal}px`;
  const css: Record<string, string> = {
    height: padY === undefined ? `${s.height}px` : 'auto',
    paddingLeft: padX,
    paddingRight: padX,
    borderRadius: t.borderRadius,
    display: 'inline-flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: `${s.gap}px`,
    backgroundColor: c.bg,
    color: c.text,
    fontSize: t.fontSize,
    fontFamily: t.fontFamily,
    fontWeight: '600',
    borderWidth: c.borderColor ? '1px' : '0',
    borderStyle: 'solid',
    borderColor: c.borderColor ?? 'transparent',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? '0.4' : '1',
  };
  applyButtonExtras(css, { padY, square: square.value, stretch: stretch.value, height: s.height });
  return css;
}

const style = computed<Record<string, string>>(() =>
  buildButtonCss(colors.value, spec.value, isDisabled.value),
);

function applyButtonExtras(
  css: Record<string, string>,
  o: { padY: string | undefined; square: boolean; stretch: boolean; height: number },
): void {
  if (o.padY !== undefined) {
    css.paddingTop = o.padY;
    css.paddingBottom = o.padY;
  }
  if (o.square) css.width = `${o.height}px`;
  else if (o.stretch) css.width = '100%';
}

const hasPressedBg = computed(() => props.tintPressedBg !== undefined);

const rootStyle = computed<Record<string, string>>(() => {
  const pressed = props.tintPressedBg;
  return pressed === undefined
    ? style.value
    : { ...style.value, '--kit-btn-pressed-bg': pressed };
});

function onClick(event: MouseEvent): void {
  if (isDisabled.value) return;
  emit('click', event);
}
</script>

<template>
  <button
    type="button"
    :style="rootStyle"
    :class="{ 'kit-btn-pressable': hasPressedBg }"
    :disabled="isDisabled"
    @click="onClick"
  >
    <slot name="iconStart" />
    <slot>{{ label }}</slot>
    <slot name="iconEnd" />
  </button>
</template>

<style scoped>
.kit-btn-pressable:active:not(:disabled) {
  background-color: var(--kit-btn-pressed-bg) !important;
}
</style>
