<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    size?: number;
    color?: string;
  }>(),
  { size: 24, color: '#888888' },
);

const stroke = computed(() => Math.max(2, Math.round(props.size / 10)));
const r = computed(() => (props.size - stroke.value) / 2);
const c = computed(() => 2 * Math.PI * r.value);
</script>

<template>
  <span
    :style="{
      display: 'inline-block',
      width: `${size}px`,
      height: `${size}px`,
      animation: 'kit-spin 0.8s linear infinite',
    }"
  >
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`">
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="r"
        :stroke="color"
        stroke-opacity="0.2"
        :stroke-width="stroke"
        fill="none"
      />
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="r"
        :stroke="color"
        :stroke-width="stroke"
        stroke-linecap="round"
        :stroke-dasharray="`${c * 0.25} ${c}`"
        fill="none"
      />
    </svg>
  </span>
</template>

<style>
@keyframes kit-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
