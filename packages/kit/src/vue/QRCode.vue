<script setup lang="ts">
import { computed } from 'vue';
import { buildQrMatrix } from '../kit';

const props = withDefaults(
  defineProps<{
    value: string;
    size?: number;
    color?: string;
    background?: string;
  }>(),
  { size: 160, color: '#000000', background: '#ffffff' },
);

const matrix = computed(() => buildQrMatrix(props.value, props.size));
</script>

<template>
  <svg :width="size" :height="size" :style="{ display: 'block' }">
    <rect :x="0" :y="0" :width="size" :height="size" :fill="background" />
    <path :d="matrix.path" :fill="color" />
  </svg>
</template>
