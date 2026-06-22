<script setup lang="ts">
import { computed } from 'vue';

export interface RadioOption {
  label: string;
  value: string;
  disabled?: boolean;
}

const props = withDefaults(
  defineProps<{
    name?: string;
    options?: RadioOption[];
    modelValue?: string;
    direction?: 'row' | 'col';
    disabled?: boolean;
    required?: boolean;
    ariaLabel?: string;
    size?: number;
    dark?: boolean;
  }>(),
  { options: () => [], direction: 'col', size: 20, dark: false },
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const head = computed(() => (props.dark ? '#ffffff' : '#000000'));
const border = computed(() => (props.dark ? '#282a2d' : '#e4e4e5'));

const groupStyle = computed<Record<string, string>>(() => ({
  display: 'flex',
  flexDirection: props.direction === 'row' ? 'row' : 'column',
  gap: '12px',
}));

function isSelected(opt: RadioOption): boolean {
  return opt.value === props.modelValue;
}

function isDisabled(opt: RadioOption): boolean {
  return props.disabled || (opt.disabled ?? false);
}

function rowStyle(opt: RadioOption): Record<string, string> {
  return {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '10px',
    opacity: isDisabled(opt) ? '0.5' : '1',
    cursor: isDisabled(opt) ? 'default' : 'pointer',
    background: 'none',
    border: '0',
    padding: '0',
  };
}

function outerStyle(opt: RadioOption): Record<string, string> {
  return {
    width: `${props.size}px`,
    height: `${props.size}px`,
    borderRadius: `${props.size / 2}px`,
    borderWidth: '1.5px',
    borderStyle: 'solid',
    borderColor: isSelected(opt) ? head.value : border.value,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

const dotStyle = computed<Record<string, string>>(() => ({
  width: `${props.size * 0.5}px`,
  height: `${props.size * 0.5}px`,
  borderRadius: `${props.size * 0.25}px`,
  backgroundColor: head.value,
}));

const labelStyle = computed<Record<string, string>>(() => ({
  color: head.value,
  fontSize: '15px',
  fontFamily: 'Calibre-Medium',
}));

function pick(opt: RadioOption): void {
  if (isDisabled(opt)) return;
  emit('update:modelValue', opt.value);
}
</script>

<template>
  <div role="radiogroup" :aria-label="ariaLabel ?? name" :style="groupStyle">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      role="radio"
      :aria-checked="isSelected(opt)"
      :aria-label="opt.label"
      :disabled="isDisabled(opt)"
      :style="rowStyle(opt)"
      @click="pick(opt)"
    >
      <span :style="outerStyle(opt)">
        <span v-if="isSelected(opt)" :style="dotStyle" />
      </span>
      <span :style="labelStyle">{{ opt.label }}</span>
    </button>
  </div>
</template>
