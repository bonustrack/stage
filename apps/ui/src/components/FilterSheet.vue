<script setup lang="ts">
import { stationLabel } from '@shared/icons/stations';

export interface Filters {
  stations: Set<string>;
  includeWebhooks: boolean;
}

const STATIONS: string[] = ['discord', 'telegram', 'webhook', 'claude', 'codex'];

const props = defineProps<{ open: boolean; filters: Filters }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'update', f: Filters): void }>();

function toggle(v: string): void {
  const next = new Set(props.filters.stations);
  if (next.has(v)) next.delete(v); else next.add(v);
  emit('update', { ...props.filters, stations: next });
}

const chipClass = (on: boolean): string => on
  ? 'bg-metro-accent border-metro-accent text-black'
  : 'bg-metro-hover-light dark:bg-metro-hover-dark border-metro-border-light dark:border-metro-border-dark';
</script>

<template>
  <div v-if="open" class="fixed inset-0 bg-black/40 z-30 flex items-end justify-center" @click.self="$emit('close')">
    <div class="w-full max-w-xl bg-metro-surface-light dark:bg-metro-surface-dark rounded-t-2xl
      border-t border-metro-border-light dark:border-metro-border-dark p-4 max-h-[85vh] overflow-y-auto">
      <div class="flex items-center gap-3 mb-4">
        <h2 class="font-bold text-lg flex-1">Filter events</h2>
        <button
          type="button"
          class="text-sm font-semibold text-metro-accent hover:underline"
          @click="emit('update', { stations: new Set(), includeWebhooks: true })"
        >Reset</button>
        <button type="button" class="text-sm font-bold text-metro-accent hover:underline" @click="$emit('close')">Done</button>
      </div>
      <section class="mb-4">
        <h3 class="text-xs uppercase font-semibold text-metro-sub-light dark:text-metro-sub-dark mb-2">Station</h3>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="s in STATIONS"
            :key="s"
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border"
            :class="chipClass(filters.stations.has(s))"
            @click="toggle(s)"
          >
            <StationIcon :station="s" />
            {{ stationLabel(s) }}
          </button>
        </div>
      </section>
      <section>
        <h3 class="text-xs uppercase font-semibold text-metro-sub-light dark:text-metro-sub-dark mb-2">Webhooks</h3>
        <button
          type="button"
          class="px-3 py-1.5 rounded-full text-sm font-semibold border"
          :class="chipClass(filters.includeWebhooks)"
          @click="emit('update', { ...filters, includeWebhooks: !filters.includeWebhooks })"
        >{{ filters.includeWebhooks ? 'Included' : 'Hidden' }}</button>
      </section>
    </div>
  </div>
</template>
