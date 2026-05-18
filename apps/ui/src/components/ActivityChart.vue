<script setup lang="ts">
import { bucketByHour, type BucketEvent } from '@shared/charts/activity-buckets';
import { getStationIcon } from '@shared/icons/stations';

const props = defineProps<{ events: ReadonlyArray<BucketEvent> }>();

const HOURS = 24;
const HEIGHT = 48;

const buckets = computed(() => bucketByHour(props.events, HOURS));
const peak = computed(() => buckets.value.reduce((m, b) => Math.max(m, b.count), 0));

interface Bar { x: number; y: number; w: number; h: number; fill: string }

/** CSS var (--chart-empty) drives empty-bucket fill so we don't plumb dark-mode per rect. */
const bars = computed<Bar[]>(() => {
  const p = peak.value;
  if (p === 0) return [];
  return buckets.value.map((b, i) => {
    const h = Math.max(2, Math.round((b.count / p) * (HEIGHT - 4)));
    return {
      x: i * 10 + 1, y: HEIGHT - h - 2, w: 8, h,
      fill: b.count === 0 ? 'var(--chart-empty)' : getStationIcon(b.dominantStation).color,
    };
  });
});
</script>

<template>
  <div
    v-if="peak > 0"
    class="activity-chart px-4 py-2 border-b border-metro-border-light dark:border-metro-border-dark bg-metro-bg-light dark:bg-metro-bg-dark"
  >
    <div class="w-full overflow-hidden rounded-md bg-metro-hover-light dark:bg-metro-hover-dark" style="height: 48px;">
      <svg :viewBox="`0 0 ${HOURS * 10} ${HEIGHT}`" preserveAspectRatio="none" width="100%" :height="HEIGHT" aria-hidden="true">
        <rect v-for="(b, i) in bars" :key="i" :x="b.x" :y="b.y" :width="b.w" :height="b.h" :fill="b.fill" rx="1.5" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.activity-chart { --chart-empty: #dfe4ee; }
@media (prefers-color-scheme: dark) {
  .activity-chart { --chart-empty: #262c38; }
}
</style>
