<script setup lang="ts">
import { computed } from 'vue';
import { useKitScheme } from './theme-context';

const props = withDefaults(
  defineProps<{
    name?: string;
    checked: boolean;
    disabled?: boolean;
    label?: string;
    dark?: boolean;
  }>(),
  {},
);

const emit = defineEmits<{ 'update:checked': [value: boolean] }>();

const scheme = useKitScheme();
const isDark = computed(() => props.dark ?? scheme === 'dark');

const trackStyle = computed<Record<string, string>>(() => {
  const on = isDark.value ? '#ffffff' : '#000000';
  const off = isDark.value ? '#3a3c40' : '#d8d8da';
  return {
    width: '44px',
    height: '26px',
    borderRadius: '13px',
    backgroundColor: props.checked ? on : off,
    padding: '3px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: props.checked ? 'flex-end' : 'flex-start',
    transition: 'background-color 0.15s ease',
  };
});

const knobStyle = computed<Record<string, string>>(() => ({
  width: '20px',
  height: '20px',
  borderRadius: '10px',
  backgroundColor: props.checked && isDark.value ? '#000000' : '#ffffff',
}));

const rootStyle = computed<Record<string, string>>(() => ({
  display: 'inline-flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: '10px',
  background: 'none',
  border: '0',
  padding: '0',
  opacity: props.disabled ? '0.5' : '1',
  cursor: props.disabled ? 'default' : 'pointer',
}));

function toggle(): void {
  if (props.disabled) return;
  emit('update:checked', !props.checked);
}
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="checked"
    :aria-label="label ?? name"
    :disabled="disabled"
    :style="rootStyle"
    @click="toggle"
  >
    <span :style="trackStyle"><span :style="knobStyle" /></span>
    <span
      v-if="label"
      :style="{
        color: isDark ? '#ffffff' : '#000000',
        fontSize: '15px',
        fontFamily: 'Calibre-Medium',
      }"
    >{{ label }}</span>
  </button>
</template>
