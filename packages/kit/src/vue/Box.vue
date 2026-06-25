<script setup lang="ts">
import { computed } from 'vue';
import {
  boxStyleEntries,
  type Align,
  type BoxBaseProps,
  type Justify,
} from '../layout';
import { isColorToken, resolveColorToken } from '../tokens';
import { useKitPalette, useKitScheme, type KitPalette } from './theme-context';

export type { Align, Justify };

export type Surface = 'none' | 'surface' | 'raised' | 'sunken' | 'toolbar';

const props = withDefaults(
  defineProps<
    BoxBaseProps & {
      surface?: Surface;
      tag?: string;
    }
  >(),
  { surface: 'none', tag: 'div' },
);

function surfaceColor(surface: Surface, palette: KitPalette): string | undefined {
  switch (surface) {
    case 'surface':
      return palette.bg;
    case 'raised':
      return palette.inputBg;
    case 'sunken':
      return palette.bg;
    case 'toolbar':
      return palette.toolbarBg;
    default:
      return undefined;
  }
}

const palette = useKitPalette();
const scheme = useKitScheme();

const style = computed<Record<string, string>>(() => {
  const override =
    props.background !== undefined && isColorToken(props.background)
      ? resolveColorToken(props.background, scheme)
      : props.background;
  const bg = override ?? surfaceColor(props.surface, palette);

  const entries = boxStyleEntries({
    direction: props.direction,
    gap: props.gap,
    padding: props.padding,
    margin: props.margin,
    align: props.align,
    justify: props.justify,
    flex: props.flex,
    wrap: props.wrap,
    background: bg,
    radius: props.radius,
    width: props.width,
    height: props.height,
    size: props.size,
    minWidth: props.minWidth,
    minHeight: props.minHeight,
    maxWidth: props.maxWidth,
    maxHeight: props.maxHeight,
    aspectRatio: props.aspectRatio,
    border: props.border,
  });

  const css: Record<string, string> = { display: 'flex' };
  for (const [k, v] of Object.entries(entries)) {
    css[k] = typeof v === 'number' ? `${v}px` : v;
  }
  return css;
});
</script>

<template>
  <component :is="tag" :style="style">
    <slot />
  </component>
</template>
