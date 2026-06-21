<script setup lang="ts">
import { computed } from 'vue';
import { resolveColorToken, type ColorToken } from '../tokens';
import { useKitPalette, useKitScheme } from './theme-context';

export type TitleLevel = 1 | 2 | 3;
export type TitleSizeToken = 'sm' | 'md' | 'lg';

const props = defineProps<{
  level?: TitleLevel;
  size?: TitleSizeToken;
  color?: ColorToken | (string & {});
}>();

const LEVEL_SIZE: Record<TitleLevel, number> = { 1: 30, 2: 24, 3: 21 };
const TOKEN_LEVEL: Record<TitleSizeToken, TitleLevel> = { lg: 1, md: 2, sm: 3 };

const palette = useKitPalette();
const scheme = useKitScheme();

const level = computed<TitleLevel>(() =>
  props.level ?? (props.size ? TOKEN_LEVEL[props.size] : 2),
);

const tag = computed(() => `h${level.value}`);

const style = computed<Record<string, string>>(() => ({
  color: props.color != null ? resolveColorToken(props.color, scheme) : palette.link,
  fontSize: `${LEVEL_SIZE[level.value]}px`,
  fontFamily: 'Calibre-Semibold',
  fontWeight: '600',
  margin: '0',
}));
</script>

<template>
  <component :is="tag" :style="style"><slot /></component>
</template>
