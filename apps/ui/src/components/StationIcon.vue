<script setup lang="ts">
import { getStationIcon, stationLabel } from '@shared/icons/stations';

const props = defineProps<{ station: string; withLabel?: boolean }>();
const def = computed(() => getStationIcon(props.station));
const label = computed(() => stationLabel(props.station));
</script>

<template>
  <span class="inline-flex items-center gap-1.5">
    <span
      class="inline-flex items-center justify-center rounded"
      :style="{ backgroundColor: def.color, width: '20px', height: '20px' }"
      :aria-label="label"
    >
      <svg viewBox="0 0 24 24" width="14" height="14">
        <path v-if="def.path" :d="def.path" fill="#ffffff" />
        <circle v-else cx="12" cy="12" r="6" fill="#0f1115" />
      </svg>
    </span>
    <span v-if="withLabel" class="text-sm font-semibold">{{ label }}</span>
  </span>
</template>
