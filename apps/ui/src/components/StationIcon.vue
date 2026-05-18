<script setup lang="ts">
import { computed } from 'vue';
import { getStationIcon, stationLabel } from '@shared/icons/stations';

const props = defineProps<{ station: string; withLabel?: boolean }>();
const def = computed(() => getStationIcon(props.station));
const label = computed(() => stationLabel(props.station));
</script>

<template>
  <span class="inline-flex items-center gap-1.5">
    <span
      class="inline-flex items-center justify-center rounded"
      :style="{ backgroundColor: def.color, color: def.fg, width: '20px', height: '20px' }"
      :aria-label="label"
    >
      <svg viewBox="0 0 24 24" width="14" height="14" v-html="def.svg" />
    </span>
    <span v-if="withLabel" class="text-sm font-semibold">{{ label }}</span>
  </span>
</template>
