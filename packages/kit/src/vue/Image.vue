<script setup lang="ts">
import { computed } from 'vue';

export type ImageFit = 'none' | 'cover' | 'contain' | 'fill' | 'scale-down';
export type ImagePosition =
  | 'center' | 'top' | 'bottom' | 'left' | 'right'
  | 'top left' | 'top right' | 'bottom left' | 'bottom right';
export type ImageRadius =
  | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'
  | 'full' | '100%' | 'none';

const RADIUS: Record<ImageRadius, number> = {
  none: 0, '2xs': 2, xs: 4, sm: 6, md: 8, lg: 12,
  xl: 16, '2xl': 20, '3xl': 24, '4xl': 28, full: 999, '100%': 999,
};

function radiusValue(radius?: ImageRadius | number): number | undefined {
  if (radius === undefined) return undefined;
  return typeof radius === 'number' ? radius : RADIUS[radius];
}

const props = withDefaults(
  defineProps<{
    src: string;
    alt?: string;
    fit?: ImageFit;
    position?: ImagePosition;
    frame?: boolean;
    flush?: number | boolean;
    radius?: ImageRadius | number;
    size?: number | string;
    aspectRatio?: number;
    width?: number | string;
    height?: number | string;
    minWidth?: number | string;
    maxWidth?: number | string;
    minHeight?: number | string;
    maxHeight?: number | string;
    background?: string;
    margin?: number;
  }>(),
  { fit: 'cover' },
);

const emit = defineEmits<{ load: [event: Event]; error: [] }>();

function toLength(v: number | string | undefined): string | undefined {
  if (v === undefined) return undefined;
  return typeof v === 'number' ? `${v}px` : v;
}

function assignDefined(
  css: Record<string, string>,
  entries: Record<string, string | undefined>,
): void {
  for (const [k, v] of Object.entries(entries)) {
    if (v !== undefined) css[k] = v;
  }
}

function sizingStyle(): Record<string, string> {
  const css: Record<string, string> = {};
  assignDefined(css, {
    width: toLength(props.size ?? props.width),
    height: toLength(props.size ?? props.height),
    minWidth: toLength(props.minWidth),
    maxWidth: toLength(props.maxWidth),
    minHeight: toLength(props.minHeight),
    maxHeight: toLength(props.maxHeight),
    aspectRatio: props.aspectRatio !== undefined ? String(props.aspectRatio) : undefined,
  });
  return css;
}

const style = computed<Record<string, string>>(() => {
  const css = sizingStyle();
  const bleed = props.flush === true ? 16 : typeof props.flush === 'number' ? props.flush : 0;
  const r = radiusValue(props.radius);
  assignDefined(css, {
    borderRadius: r !== undefined ? `${r}px` : undefined,
    backgroundColor: props.background,
    margin: props.margin !== undefined ? `${props.margin}px` : undefined,
    marginLeft: bleed ? `${-bleed}px` : undefined,
    marginRight: bleed ? `${-bleed}px` : undefined,
    objectPosition: props.position,
  });
  css.objectFit = props.fit === 'none' ? 'none' : props.fit;
  if (props.frame) {
    css.borderWidth = '1px';
    css.borderStyle = 'solid';
    css.borderColor = '#e4e4e5';
  }
  return css;
});

function onLoad(event: Event): void {
  emit('load', event);
}

function onError(): void {
  emit('error');
}
</script>

<template>
  <img :src="src" :alt="alt" :style="style" @load="onLoad" @error="onError" />
</template>
