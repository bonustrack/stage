<script setup lang="ts">
import { computed, ref } from 'vue';
import Icon from './Icon.vue';
import { useKitScheme } from './theme-context';
import { fontSize } from '../tokens';
import { hexToHsv, hsvToHex, isHexColor } from '../color-math';

const DEFAULT_SWATCHES = [
  '#000000',
  '#ffffff',
  '#eb4c5b',
  '#e07a0c',
  '#e0a106',
  '#1f9d57',
  '#2f6df6',
  '#8b5cf6',
];

const props = withDefaults(
  defineProps<{
    value: string;
    mode?: 'swatches' | 'hsv';
    swatches?: string[];
    dark?: boolean;
    headColor?: string;
    subColor?: string;
    borderColor?: string;
    rowBg?: string;
  }>(),
  {},
);

const emit = defineEmits<{ 'update:value': [value: string] }>();

const scheme = useKitScheme();
const isDark = computed(() => props.dark ?? scheme === 'dark');
const list = computed(() => props.swatches ?? DEFAULT_SWATCHES);
const border = computed(() => props.borderColor ?? (isDark.value ? '#3a3c40' : '#d8d8da'));
const subColor = computed(() => props.subColor ?? (isDark.value ? '#9a9a9f' : '#71717a'));
const headColor = computed(() => props.headColor ?? (isDark.value ? '#ffffff' : '#111114'));
const rowBg = computed(() => props.rowBg ?? (isDark.value ? '#1a1a1c' : '#f4f4f5'));

function readable(hex: string): string {
  const group = /^#?([0-9a-f]{6})$/i.exec(hex.trim())?.[1];
  if (group === undefined) return '#ffffff';
  const n = Number.parseInt(group, 16);
  const lum =
    (0.299 * ((n >> 16) & 0xff) + 0.587 * ((n >> 8) & 0xff) + 0.114 * (n & 0xff)) / 255;
  return lum > 0.6 ? '#000000' : '#ffffff';
}

function swatchStyle(hex: string): Record<string, string> {
  return {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    backgroundColor: hex,
    border: `1px solid ${border.value}`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0',
    cursor: 'pointer',
  };
}

const hsv = ref(hexToHsv(props.value));
const text = ref<string | null>(null);
const hex = computed(() => hsvToHex(hsv.value.h, hsv.value.s, hsv.value.v));

function apply(h: number, s: number, v: number): void {
  hsv.value = { h, s, v };
  text.value = null;
  emit('update:value', hsvToHex(h, s, v));
}

function stops(make: (i: number) => string, count: number): string {
  return make(0) + Array.from({ length: count - 1 }, (_, i) => `, ${make(i + 1)}`).join('');
}

const hueGradient = computed(() =>
  `linear-gradient(to right, ${stops((i) => hsvToHex((i / 23) * 360, 1, 1), 24)})`,
);
const satGradient = computed(() =>
  `linear-gradient(to right, ${stops((i) => hsvToHex(hsv.value.h, i / 11, hsv.value.v), 12)})`,
);
const valGradient = computed(() =>
  `linear-gradient(to right, ${stops((i) => hsvToHex(hsv.value.h, hsv.value.s, i / 11), 12)})`,
);

const dragging = ref<null | 'h' | 's' | 'v'>(null);

function fractionFromEvent(el: HTMLElement, clientX: number): number {
  const rect = el.getBoundingClientRect();
  const w = rect.width || 1;
  return Math.max(0, Math.min(1, (clientX - rect.left) / w));
}

function setChannel(channel: 'h' | 's' | 'v', f: number): void {
  if (channel === 'h') apply(f * 360, hsv.value.s, hsv.value.v);
  else if (channel === 's') apply(hsv.value.h, f, hsv.value.v);
  else apply(hsv.value.h, hsv.value.s, f);
}

function onTrackDown(channel: 'h' | 's' | 'v', e: PointerEvent): void {
  const el = e.currentTarget as HTMLElement;
  el.setPointerCapture(e.pointerId);
  dragging.value = channel;
  setChannel(channel, fractionFromEvent(el, e.clientX));
}

function onTrackMove(channel: 'h' | 's' | 'v', e: PointerEvent): void {
  if (dragging.value !== channel) return;
  const el = e.currentTarget as HTMLElement;
  setChannel(channel, fractionFromEvent(el, e.clientX));
}

function onTrackUp(e: PointerEvent): void {
  dragging.value = null;
  const el = e.currentTarget as HTMLElement;
  if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
}

function onHexInput(e: Event): void {
  const t = (e.target as HTMLInputElement).value;
  text.value = t;
  if (isHexColor(t)) {
    hsv.value = hexToHsv(t);
    emit('update:value', t.trim().toLowerCase());
  }
}

const trackStyle = (gradient: string): Record<string, string> => ({
  position: 'relative',
  height: '26px',
  borderRadius: '13px',
  background: gradient,
  border: `1px solid ${border.value}`,
  cursor: 'pointer',
  touchAction: 'none',
  marginTop: '6px',
});

const thumbStyle = (fraction: number): Record<string, string> => ({
  position: 'absolute',
  top: '50%',
  left: `${fraction * 100}%`,
  width: '22px',
  height: '22px',
  marginLeft: '-11px',
  marginTop: '-11px',
  borderRadius: '6px',
  border: '3px solid #ffffff',
  boxShadow: '0 0 2px rgba(0,0,0,0.4)',
  pointerEvents: 'none',
});

const labelStyle = computed<Record<string, string>>(() => ({
  fontFamily: 'Calibre-Semibold',
  fontSize: `${fontSize('xs')}px`,
  color: subColor.value,
  marginTop: '16px',
}));
</script>

<template>
  <div
    v-if="mode === 'hsv'"
    :style="{ display: 'flex', flexDirection: 'column' }"
  >
    <div :style="{ display: 'flex', gap: '14px', alignItems: 'center' }">
      <div
        :style="{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          backgroundColor: hex,
          border: `1px solid ${border}`,
        }"
      />
      <div :style="{ display: 'flex', flexDirection: 'column', flex: '1' }">
        <span :style="{ fontFamily: 'Calibre-Semibold', fontSize: `${fontSize('5xl')}px`, color: headColor }">
          {{ hex }}
        </span>
        <span :style="{ fontSize: `${fontSize('xs')}px`, color: subColor, marginTop: '2px' }">
          live preview
        </span>
      </div>
    </div>

    <span :style="labelStyle">Hue</span>
    <div
      :style="trackStyle(hueGradient)"
      @pointerdown="onTrackDown('h', $event)"
      @pointermove="onTrackMove('h', $event)"
      @pointerup="onTrackUp"
    >
      <div :style="thumbStyle(hsv.h / 360)" />
    </div>

    <span :style="labelStyle">Saturation</span>
    <div
      :style="trackStyle(satGradient)"
      @pointerdown="onTrackDown('s', $event)"
      @pointermove="onTrackMove('s', $event)"
      @pointerup="onTrackUp"
    >
      <div :style="thumbStyle(hsv.s)" />
    </div>

    <span :style="labelStyle">Value</span>
    <div
      :style="trackStyle(valGradient)"
      @pointerdown="onTrackDown('v', $event)"
      @pointermove="onTrackMove('v', $event)"
      @pointerup="onTrackUp"
    >
      <div :style="thumbStyle(hsv.v)" />
    </div>

    <span :style="labelStyle">Hex</span>
    <input
      :value="text ?? hex"
      placeholder="#rrggbb"
      autocapitalize="none"
      autocomplete="off"
      autocorrect="off"
      spellcheck="false"
      :style="{
        marginTop: '4px',
        padding: '8px 12px',
        borderRadius: '10px',
        border: `1px solid ${border}`,
        backgroundColor: rowBg,
        color: text != null && !isHexColor(text) ? '#eb4c5b' : headColor,
        fontSize: `${fontSize('md')}px`,
        fontFamily: 'Calibre-Medium',
      }"
      @input="onHexInput"
    />
  </div>

  <div v-else :style="{ display: 'flex', flexWrap: 'wrap', gap: '10px' }">
    <button
      v-for="hexValue in list"
      :key="hexValue"
      type="button"
      :aria-pressed="hexValue.toLowerCase() === value.toLowerCase()"
      :style="swatchStyle(hexValue)"
      @click="emit('update:value', hexValue)"
    >
      <Icon
        v-if="hexValue.toLowerCase() === value.toLowerCase()"
        name="check"
        :size="18"
        :color="readable(hexValue)"
      />
    </button>
  </div>
</template>
