<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { ChartNode } from '../kit';
import {
  areaPathD,
  chartAxisColor,
  chartBars,
  chartGeometry,
  chartLegend,
  chartLines,
  chartTextColor,
  chartXTickLabels,
  formatTick,
  linePathD,
  CHART_DEFAULT_HEIGHT,
  type Scheme,
} from '../kit';

const props = defineProps<{ node: ChartNode; scheme: Scheme }>();

const host = ref<HTMLElement | null>(null);
const width = ref(0);
let observer: ResizeObserver | undefined;

onMounted(() => {
  if (host.value === null) return;
  observer = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (entry) width.value = entry.contentRect.width;
  });
  observer.observe(host.value);
  width.value = host.value.clientWidth;
});

onBeforeUnmount(() => {
  observer?.disconnect();
});

const fallbackHeight = computed(() =>
  typeof props.node.height === 'number' ? props.node.height : CHART_DEFAULT_HEIGHT,
);

const geometry = computed(() => chartGeometry(props.node, Math.max(1, width.value)));
const axisColor = computed(() => chartAxisColor(props.scheme));
const textColor = computed(() => chartTextColor(props.scheme));
const bars = computed(() => chartBars(props.node, geometry.value, props.scheme));
const areas = computed(() => chartLines(props.node, geometry.value, props.scheme, 'area'));
const lines = computed(() => chartLines(props.node, geometry.value, props.scheme, 'line'));
const strokes = computed(() => lines.value.concat(areas.value));
const xTicks = computed(() => chartXTickLabels(props.node));
const legend = computed(() => chartLegend(props.node, props.scheme));
const baseY = computed(() => geometry.value.plotTop + geometry.value.plotHeight);
</script>

<template>
  <div ref="host" style="width: 100%">
    <svg
      v-if="width > 0"
      :width="width"
      :height="geometry.height"
    >
      <template v-if="geometry.showYAxis">
        <g v-for="(t, i) in geometry.yTicks" :key="`y${i}`">
          <line
            :x1="geometry.plotLeft"
            :y1="t.y"
            :x2="geometry.plotLeft + geometry.plotWidth"
            :y2="t.y"
            :stroke="axisColor"
            stroke-width="1"
            opacity="0.5"
          />
          <text
            :x="geometry.plotLeft - 6"
            :y="t.y + 3"
            font-size="10"
            :fill="textColor"
            text-anchor="end"
          >{{ formatTick(t.value) }}</text>
        </g>
      </template>
      <line
        :x1="geometry.plotLeft"
        :y1="baseY"
        :x2="geometry.plotLeft + geometry.plotWidth"
        :y2="baseY"
        :stroke="axisColor"
        stroke-width="1"
      />
      <path
        v-for="(a, i) in areas"
        :key="`a${i}`"
        :d="areaPathD(a.points, a.baseY)"
        :fill="a.color"
        opacity="0.25"
      />
      <rect
        v-for="(b, i) in bars"
        :key="`b${i}`"
        :x="b.x"
        :y="b.y"
        :width="b.width"
        :height="b.height"
        :fill="b.color"
        rx="2"
      />
      <path
        v-for="(l, i) in strokes"
        :key="`l${i}`"
        :d="linePathD(l.points)"
        :stroke="l.color"
        stroke-width="2"
        fill="none"
      />
      <text
        v-for="(t, i) in xTicks"
        :key="`x${i}`"
        :x="geometry.plotLeft + t.x * geometry.bandWidth + geometry.bandWidth / 2"
        :y="geometry.height - 10"
        font-size="10"
        :fill="textColor"
        text-anchor="middle"
      >{{ t.label }}</text>
    </svg>
    <div v-else :style="{ height: `${fallbackHeight}px` }" />
    <div
      v-if="node.showLegend === true"
      style="
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 8px;
        justify-content: center;
      "
    >
      <div
        v-for="(item, i) in legend"
        :key="i"
        style="display: flex; align-items: center; gap: 6px"
      >
        <span
          :style="{
            width: '10px',
            height: '10px',
            borderRadius: '2px',
            display: 'inline-block',
            background: item.color,
          }"
        />
        <span :style="{ color: textColor, fontSize: '12px' }">{{ item.label }}</span>
      </div>
    </div>
  </div>
</template>
