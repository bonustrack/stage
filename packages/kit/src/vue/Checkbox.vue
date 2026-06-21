<script setup lang="ts">
import { computed } from 'vue';
import Icon from './Icon.vue';

const props = withDefaults(
  defineProps<{
    name?: string;
    label?: string;
    modelValue?: boolean;
    disabled?: boolean;
    required?: boolean;
    size?: number;
    dark?: boolean;
  }>(),
  { size: 20, dark: false },
);

const emit = defineEmits<{ 'update:modelValue': [checked: boolean] }>();

function checkboxColors(dark: boolean): { head: string; bg: string; border: string } {
  return {
    head: dark ? '#ffffff' : '#000000',
    bg: dark ? '#0e0f10' : '#ffffff',
    border: dark ? '#282a2d' : '#e4e4e5',
  };
}

const colors = computed(() => checkboxColors(props.dark));
const checked = computed(() => props.modelValue ?? false);

const rootStyle = computed<Record<string, string>>(() => ({
  display: 'inline-flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: '10px',
  opacity: props.disabled ? '0.5' : '1',
  cursor: props.disabled ? 'default' : 'pointer',
  background: 'none',
  border: '0',
  padding: '0',
}));

const boxStyle = computed<Record<string, string>>(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderRadius: '6px',
  borderWidth: checked.value ? '0' : '1px',
  borderStyle: 'solid',
  borderColor: colors.value.border,
  backgroundColor: checked.value ? colors.value.head : colors.value.bg,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const labelStyle = computed<Record<string, string>>(() => ({
  color: colors.value.head,
  fontSize: '15px',
  fontFamily: 'Calibre-Medium',
}));

function toggle(): void {
  if (props.disabled) return;
  emit('update:modelValue', !checked.value);
}
</script>

<template>
  <button
    type="button"
    role="checkbox"
    :aria-checked="checked"
    :aria-label="label ?? name"
    :disabled="disabled"
    :style="rootStyle"
    @click="toggle"
  >
    <span :style="boxStyle">
      <Icon v-if="checked" name="check" :size="size - 4" :color="colors.bg" />
    </span>
    <span v-if="label" :style="labelStyle">{{ label }}</span>
  </button>
</template>
