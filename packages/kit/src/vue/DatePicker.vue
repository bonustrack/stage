<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  controlBoxStyle,
  controlColors,
  type ControlSize,
  type ControlVariant,
} from '../control.styles';
import { BLOCK_RADIUS_DEFAULT } from '../tokens';
import Icon from './Icon.vue';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseISO(v: string | undefined): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toISO(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function buildCells(year: number, month: number): (Date | null)[] {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));
  return cells;
}

const props = withDefaults(
  defineProps<{
    name?: string;
    modelValue?: string;
    placeholder?: string;
    variant?: ControlVariant;
    size?: ControlSize;
    pill?: boolean;
    block?: boolean;
    clearable?: boolean;
    disabled?: boolean;
    min?: string;
    max?: string;
    radius?: number;
    dark?: boolean;
  }>(),
  {
    placeholder: 'Select date...',
    variant: 'soft',
    size: 'md',
    dark: false,
  },
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const open = ref(false);
const selDate = computed(() => parseISO(props.modelValue));
const view = ref<Date>(selDate.value ?? new Date());

watch(open, (isOpen) => {
  if (isOpen) view.value = selDate.value ?? new Date();
});

const ctrlColors = computed(() => controlColors(props.variant, props.dark));
const corner = computed(() => props.radius ?? (props.pill ? 999 : BLOCK_RADIUS_DEFAULT));

const sheetColors = computed(() => ({
  head: props.dark ? '#ffffff' : '#000000',
  sub: props.dark ? '#7a7a7e' : '#8a929d',
  sheetBg: props.dark ? '#1b1c1e' : '#ffffff',
  accent: props.dark ? '#4f9cf9' : '#2f6fed',
}));

const minD = computed(() => parseISO(props.min));
const maxD = computed(() => parseISO(props.max));

function inRange(d: Date): boolean {
  if (minD.value && d < minD.value) return false;
  if (maxD.value && d > maxD.value) return false;
  return true;
}

const cells = computed(() => buildCells(view.value.getFullYear(), view.value.getMonth()));
const monthLabel = computed(() => `${MONTHS[view.value.getMonth()]} ${view.value.getFullYear()}`);

const label = computed(() => {
  const d = selDate.value;
  return d ? `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : props.placeholder;
});

function toCss(entries: Record<string, string | number>): Record<string, string> {
  const css: Record<string, string> = {};
  for (const [k, v] of Object.entries(entries)) {
    css[k] = typeof v === 'number' ? `${v}px` : v;
  }
  return css;
}

const triggerStyle = computed<Record<string, string>>(() => {
  const box = controlBoxStyle(props.size, props.variant, ctrlColors.value, corner.value, false);
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

const triggerLabelStyle = computed<Record<string, string>>(() => ({
  flex: '1',
  color: selDate.value ? sheetColors.value.head : ctrlColors.value.placeholder,
  fontSize: '15px',
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
  zIndex: '50',
  width: '280px',
  backgroundColor: sheetColors.value.sheetBg,
  borderRadius: '16px',
  padding: '16px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
}));

function isSel(d: Date): boolean {
  return selDate.value != null && toISO(d) === toISO(selDate.value);
}

function cellStyle(d: Date): Record<string, string> {
  return {
    width: '34px',
    height: '34px',
    borderRadius: '17px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isSel(d) ? sheetColors.value.accent : 'transparent',
    opacity: inRange(d) ? '1' : '0.3',
  };
}

function cellTextStyle(d: Date): Record<string, string> {
  return {
    color: isSel(d) ? '#ffffff' : sheetColors.value.head,
    fontSize: '15px',
    fontFamily: 'Calibre-Medium',
  };
}

function openMenu(): void {
  if (props.disabled) return;
  open.value = true;
}

function pick(d: Date): void {
  if (!inRange(d)) return;
  emit('update:modelValue', toISO(d));
  open.value = false;
}

function clear(): void {
  emit('update:modelValue', '');
}

function shiftMonth(delta: number): void {
  view.value = new Date(view.value.getFullYear(), view.value.getMonth() + delta, 1);
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
      <span :style="triggerLabelStyle">{{ label }}</span>
      <span
        v-if="clearable && selDate"
        role="button"
        aria-label="Clear"
        :style="{ display: 'inline-flex', cursor: 'pointer' }"
        @click.stop="clear"
      >
        <Icon name="x" :size="16" :color="ctrlColors.placeholder" />
      </span>
      <Icon name="calendar" :size="16" :color="ctrlColors.placeholder" />
    </button>

    <template v-if="open">
      <div :style="{ position: 'fixed', inset: '0', zIndex: '40' }" @click="open = false" />
      <div :style="panelStyle">
        <div :style="{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '12px' }">
          <button
            type="button"
            aria-label="Previous month"
            :style="{ background: 'none', border: '0', cursor: 'pointer', display: 'inline-flex' }"
            @click="shiftMonth(-1)"
          >
            <Icon name="chevronLeft" :size="20" :color="sheetColors.head" />
          </button>
          <span
            :style="{ flex: '1', textAlign: 'center', color: sheetColors.head, fontSize: '16px', fontFamily: 'Calibre-Semibold' }"
          >{{ monthLabel }}</span>
          <button
            type="button"
            aria-label="Next month"
            :style="{ background: 'none', border: '0', cursor: 'pointer', display: 'inline-flex' }"
            @click="shiftMonth(1)"
          >
            <Icon name="chevronRight" :size="20" :color="sheetColors.head" />
          </button>
        </div>
        <div :style="{ display: 'flex', flexDirection: 'row' }">
          <div
            v-for="(w, i) in WEEKDAYS"
            :key="i"
            :style="{ width: `${100 / 7}%`, display: 'flex', justifyContent: 'center', paddingTop: '4px', paddingBottom: '4px' }"
          >
            <span :style="{ color: sheetColors.sub, fontSize: '12px', fontFamily: 'Calibre-Medium' }">{{ w }}</span>
          </div>
        </div>
        <div :style="{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }">
          <template v-for="(d, i) in cells" :key="i">
            <div v-if="!d" :style="{ width: `${100 / 7}%`, height: '40px' }" />
            <button
              v-else
              type="button"
              :aria-label="d ? `${d.getFullYear()}` : undefined"
              :disabled="!inRange(d)"
              :style="{ width: `${100 / 7}%`, height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: '0', cursor: inRange(d) ? 'pointer' : 'default' }"
              @click="pick(d)"
            >
              <span :style="cellStyle(d)">
                <span :style="cellTextStyle(d)">{{ d.getDate() }}</span>
              </span>
            </button>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>
