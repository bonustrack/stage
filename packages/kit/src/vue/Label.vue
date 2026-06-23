<script setup lang="ts">
import { computed } from 'vue';
import { useKitScheme } from './theme-context';

export type LabelSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type LabelWeight = 'normal' | 'medium' | 'semibold' | 'bold';
export type LabelAlign = 'start' | 'center' | 'end';

const SIZE: Record<LabelSize, number> = { xs: 12, sm: 13, md: 15, lg: 17, xl: 20 };
const FONT: Record<LabelWeight, string> = {
  normal: 'Calibre-Medium',
  medium: 'Calibre-Medium',
  semibold: 'Calibre-Semibold',
  bold: 'Calibre-Semibold',
};
const ALIGN: Record<LabelAlign, string> = {
  start: 'left',
  center: 'center',
  end: 'right',
};

const props = withDefaults(
  defineProps<{
    value?: string;
    fieldName?: string;
    size?: LabelSize;
    weight?: LabelWeight;
    textAlign?: LabelAlign;
    color?: string;
    dark?: boolean;
  }>(),
  { size: 'md', weight: 'medium', textAlign: 'start' },
);

const scheme = useKitScheme();
const isDark = computed(() => props.dark ?? scheme === 'dark');

function headColor(dark: boolean): string {
  return dark ? '#ffffff' : '#000000';
}

const labelId = computed(() => (props.fieldName ? `label-${props.fieldName}` : undefined));

const style = computed<Record<string, string>>(() => ({
  color: props.color ?? headColor(isDark.value),
  fontSize: `${SIZE[props.size]}px`,
  fontFamily: FONT[props.weight],
  textAlign: ALIGN[props.textAlign],
}));
</script>

<template>
  <label :id="labelId" :style="style"><slot>{{ value }}</slot></label>
</template>
