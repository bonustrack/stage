<script setup lang="ts">
import { computed } from 'vue';
import { resolveColorToken, type ColorToken } from '../tokens';
import {
  TEXT_ALIGN_MAP,
  TEXT_WEIGHT_NUM,
  textFontFamily,
  textRoleColor,
  textVariantRole,
  normalizeTextWeight,
  resolveTextSize,
  type TextAlign,
  type TextRole,
  type TextSizeToken,
  type TextVariant,
  type TextWeight,
} from '../text.styles';
import { useKitPalette, useKitScheme } from './theme-context';

export type { TextAlign, TextRole, TextSizeToken, TextVariant, TextWeight };

const props = withDefaults(
  defineProps<{
    value?: string;
    role?: TextRole;
    variant?: TextVariant;
    size?: TextSizeToken;
    weight?: TextWeight;
    color?: ColorToken | (string & {});
    background?: ColorToken | (string & {});
    fontSize?: number;
    lineHeight?: number;
    textAlign?: TextAlign;
    italic?: boolean;
    lineThrough?: boolean;
    truncate?: boolean;
    tag?: string;
  }>(),
  { weight: 'normal', truncate: false, tag: 'span' },
);

const palette = useKitPalette();
const scheme = useKitScheme();

function applyOverrides(css: Record<string, string>): void {
  if (props.background != null) css.backgroundColor = resolveColorToken(props.background, scheme);
  if (props.fontSize != null) css.fontSize = `${props.fontSize}px`;
  if (props.lineHeight != null) css.lineHeight = `${props.lineHeight}px`;
}

const style = computed<Record<string, string>>(() => {
  const effectiveRole: TextRole = props.role ?? textVariantRole(props.variant);
  const css: Record<string, string> = {
    color:
      props.color != null
        ? resolveColorToken(props.color, scheme)
        : textRoleColor(effectiveRole, palette),
    fontSize: `${resolveTextSize(props.size, props.variant)}px`,
    fontFamily: textFontFamily(props.variant, props.weight),
    fontWeight: TEXT_WEIGHT_NUM[normalizeTextWeight(props.weight)],
  };
  applyOverrides(css);
  if (props.textAlign) css.textAlign = TEXT_ALIGN_MAP[props.textAlign];
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
