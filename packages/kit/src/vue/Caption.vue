<script setup lang="ts">
import { computed } from 'vue';
import { resolveColorToken, type ColorToken } from '../tokens';
import { useKitPalette, useKitScheme } from './theme-context';

export type CaptionSize = 'sm' | 'md';
export type CaptionWeight = 'normal' | 'medium' | 'semibold';
export type CaptionAlign = 'start' | 'center' | 'end';

const SIZE: Record<CaptionSize, number> = { sm: 12, md: 13 };
const FONT: Record<CaptionWeight, string> = {
  normal: 'Calibre-Medium',
  medium: 'Calibre-Medium',
  semibold: 'Calibre-Semibold',
};
const ALIGN: Record<CaptionAlign, string> = {
  start: 'left',
  center: 'center',
  end: 'right',
};

const props = withDefaults(
  defineProps<{
    value?: string;
    size?: CaptionSize;
    weight?: CaptionWeight;
    textAlign?: CaptionAlign;
    color?: ColorToken | (string & {});
    truncate?: boolean;
    maxLines?: number;
    tag?: string;
  }>(),
  { size: 'md', weight: 'medium', textAlign: 'start', tag: 'span' },
);

const palette = useKitPalette();
const scheme = useKitScheme();

const style = computed<Record<string, string>>(() => {
  const css: Record<string, string> = {
    color: props.color != null ? resolveColorToken(props.color, scheme) : palette.sub,
    fontSize: `${SIZE[props.size]}px`,
    fontFamily: FONT[props.weight],
    textAlign: ALIGN[props.textAlign],
  };
  const lines = props.truncate ? 1 : props.maxLines;
  if (lines === 1) {
    css.overflow = 'hidden';
    css.textOverflow = 'ellipsis';
    css.whiteSpace = 'nowrap';
    css.display = 'block';
  } else if (lines) {
    css.overflow = 'hidden';
    css.display = '-webkit-box';
    css.webkitLineClamp = String(lines);
    css.webkitBoxOrient = 'vertical';
  }
  return css;
});
</script>

<template>
  <component :is="tag" :style="style"><slot>{{ value }}</slot></component>
</template>
