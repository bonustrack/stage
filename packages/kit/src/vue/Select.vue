<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  controlBoxStyle,
  controlColors,
  type ControlSize,
  type ControlVariant,
} from '../control.styles';
import { BLOCK_RADIUS_DEFAULT, FONT_SIZE, schemePalette } from '../tokens';
import Icon from './Icon.vue';
import { useKitScheme } from './theme-context';

export interface SelectOption {
  label: string;
  value: string;
}

const props = withDefaults(
  defineProps<{
    name?: string;
    options?: SelectOption[];
    modelValue?: string;
    placeholder?: string;
    variant?: ControlVariant;
    size?: ControlSize;
    pill?: boolean;
    block?: boolean;
    clearable?: boolean;
    disabled?: boolean;
    radius?: number;
    dark?: boolean;
  }>(),
  {
    options: () => [],
    placeholder: 'Select...',
    variant: 'soft',
    size: 'md',
  },
);

const scheme = useKitScheme();
const isDark = computed(() => props.dark ?? scheme === 'dark');

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const open = ref(false);

const colors = computed(() => controlColors(props.variant, isDark.value));
const corner = computed(() => props.radius ?? (props.pill ? 999 : BLOCK_RADIUS_DEFAULT));
const p = computed(() => schemePalette(isDark.value));
const sheetBg = computed(() => (isDark.value ? '#1b1c1e' : '#ffffff'));

const current = computed(() => props.options.find((o) => o.value === props.modelValue));

function toCss(entries: Record<string, string | number>): Record<string, string> {
  const css: Record<string, string> = {};
  for (const [k, v] of Object.entries(entries)) {
    css[k] = typeof v === 'number' ? `${v}px` : v;
  }
  return css;
}

const triggerStyle = computed<Record<string, string>>(() => {
  const box = controlBoxStyle(props.size, props.variant, colors.value, corner.value, false);
  return {
    ...toCss(box as Record<string, string | number>),
    borderStyle: 'solid',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '8px',
    width: props.block ? '100%' : 'auto',
    alignSelf: props.block ? 'stretch' : 'flex-start',
    opacity: props.disabled ? '0.5' : '1',
    cursor: props.disabled ? 'default' : 'pointer',
  };
});

const labelStyle = computed<Record<string, string>>(() => ({
  flex: '1',
  color: current.value ? p.value.head : colors.value.placeholder,
  fontSize: `${FONT_SIZE.md}px`,
  fontFamily: 'Calibre-Medium',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}));

const panelStyle = computed<Record<string, string>>(() => ({
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: '0',
  right: '0',
  zIndex: '50',
  backgroundColor: sheetBg.value,
  borderRadius: '14px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: p.value.border,
  overflow: 'hidden',
  maxHeight: '320px',
  overflowY: 'auto',
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
}));

function rowStyle(opt: SelectOption): Record<string, string> {
  return {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '10px',
    paddingLeft: '16px',
    paddingRight: '16px',
    paddingTop: '13px',
    paddingBottom: '13px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: p.value.border,
    width: '100%',
    background: opt.value === props.modelValue ? p.value.pressed : 'transparent',
    border: '0',
    cursor: 'pointer',
  };
}

const rowLabelStyle = computed<Record<string, string>>(() => ({
  flex: '1',
  color: p.value.head,
  fontSize: `${FONT_SIZE.lg}px`,
  fontFamily: 'Calibre-Medium',
  textAlign: 'left',
}));

function openMenu(): void {
  if (props.disabled) return;
  open.value = true;
}

function pick(opt: SelectOption): void {
  emit('update:modelValue', opt.value);
  open.value = false;
}

function clear(): void {
  emit('update:modelValue', '');
}
</script>

<template>
  <div :style="{ position: 'relative', width: block ? '100%' : 'auto', display: 'inline-block' }">
    <button
      type="button"
      :aria-label="name"
      :aria-expanded="open"
      :disabled="disabled"
      :style="triggerStyle"
      @click="openMenu"
    >
      <span :style="labelStyle">{{ current ? current.label : placeholder }}</span>
      <span
        v-if="clearable && current"
        role="button"
        aria-label="Clear"
        :style="{ display: 'inline-flex', cursor: 'pointer' }"
        @click.stop="clear"
      >
        <Icon name="x" :size="16" :color="colors.placeholder" />
      </span>
      <Icon name="selector" :size="16" :color="colors.placeholder" />
    </button>

    <template v-if="open">
      <div
        :style="{ position: 'fixed', inset: '0', zIndex: '40' }"
        @click="open = false"
      />
      <div :style="panelStyle">
        <button
          v-for="opt in options"
          :key="opt.value"
          type="button"
          :style="rowStyle(opt)"
          @click="pick(opt)"
        >
          <span :style="rowLabelStyle">{{ opt.label }}</span>
          <Icon v-if="opt.value === modelValue" name="check" :size="18" :color="p.head" />
        </button>
        <div v-if="options.length === 0" :style="{ padding: '16px' }">
          <span :style="{ color: colors.placeholder, fontFamily: 'Calibre-Medium' }">No options</span>
        </div>
      </div>
    </template>
  </div>
</template>
