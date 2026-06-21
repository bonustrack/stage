<script setup lang="ts">
import { computed } from 'vue';
import {
  FONT_SIZE,
  type FontSizeName,
  resolveColorToken,
  type ColorToken,
} from '../tokens';
import { useKitPalette, useKitScheme, type KitPalette } from './theme-context';

export type TextVariant = 'body' | 'secondary' | 'caption' | 'mono';

export type TextRole =
  | 'default'
  | 'secondary'
  | 'muted'
  | 'link'
  | 'primary'
  | 'danger'
  | 'success';

export type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold' | 'regular';

export type TextSizeToken = FontSizeName;

export type TextAlign = 'start' | 'center' | 'end';

const props = withDefaults(
  defineProps<{
    value?: string;
    role?: TextRole;
    variant?: TextVariant;
    size?: TextSizeToken;
    weight?: TextWeight;
    color?: ColorToken | (string & {});
    textAlign?: TextAlign;
    italic?: boolean;
    lineThrough?: boolean;
    truncate?: boolean;
    tag?: string;
  }>(),
  { weight: 'normal', truncate: false, tag: 'span' },
);

const FONTS: Record<'normal' | 'medium' | 'semibold' | 'bold', string> = {
  normal: 'Calibre-Medium',
  medium: 'Calibre-Medium',
  semibold: 'Calibre-Semibold',
  bold: 'Calibre-Semibold',
};

const WEIGHT_NUM: Record<'normal' | 'medium' | 'semibold' | 'bold', string> = {
  normal: '500',
  medium: '500',
  semibold: '600',
  bold: '600',
};

function normalizeWeight(w: TextWeight): keyof typeof FONTS {
  return w === 'regular' ? 'normal' : w;
}

function resolveSize(size: TextSizeToken | undefined, variant: TextVariant | undefined): number {
  if (size) return FONT_SIZE[size];
  return variant === 'caption' ? FONT_SIZE.xs : FONT_SIZE.md;
}

function variantRole(variant: TextVariant | undefined): TextRole {
  if (variant === 'secondary' || variant === 'caption') return 'secondary';
  return 'default';
}

function roleColor(role: TextRole, palette: KitPalette): string {
  switch (role) {
    case 'secondary':
    case 'muted':
      return palette.sub;
    case 'link':
      return palette.link;
    case 'primary':
      return palette.primary;
    case 'danger':
      return palette.danger;
    case 'success':
      return palette.success;
    default:
      return palette.link;
  }
}

const ALIGN_MAP: Record<TextAlign, string> = {
  start: 'left',
  center: 'center',
  end: 'right',
};

const palette = useKitPalette();
const scheme = useKitScheme();

const style = computed<Record<string, string>>(() => {
  const effectiveRole: TextRole = props.role ?? variantRole(props.variant);
  const weightKey = normalizeWeight(props.weight);
  const css: Record<string, string> = {
    color:
      props.color != null
        ? resolveColorToken(props.color, scheme)
        : roleColor(effectiveRole, palette),
    fontSize: `${resolveSize(props.size, props.variant)}px`,
    fontFamily: props.variant === 'mono' ? 'Menlo' : FONTS[weightKey],
    fontWeight: WEIGHT_NUM[weightKey],
  };
  if (props.textAlign) css.textAlign = ALIGN_MAP[props.textAlign];
  if (props.italic) css.fontStyle = 'italic';
  if (props.lineThrough) css.textDecorationLine = 'line-through';
  if (props.truncate) {
    css.overflow = 'hidden';
    css.textOverflow = 'ellipsis';
    css.whiteSpace = 'nowrap';
  }
  return css;
});
</script>

<template>
  <component :is="tag" :style="style"><slot>{{ value }}</slot></component>
</template>
