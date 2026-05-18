<script setup lang="ts">
import StationIcon from './StationIcon.vue';
import { stationLabel } from '@shared/icons/stations';
import type { HistoryKind } from '../lib/types';

export interface Filters {
  kinds: Set<HistoryKind>;
  stations: Set<string>;
  includeWebhooks: boolean;
}

const KINDS: HistoryKind[] = ['inbound', 'outbound', 'edit', 'react'];
const STATIONS: string[] = ['discord', 'telegram', 'webhook', 'claude', 'codex'];

const props = defineProps<{ open: boolean; filters: Filters }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'update', f: Filters): void }>();

function toggleKind(k: HistoryKind): void {
  const next = new Set(props.filters.kinds);
  if (next.has(k)) next.delete(k); else next.add(k);
  emit('update', { ...props.filters, kinds: next });
}
function toggleStation(s: string): void {
  const next = new Set(props.filters.stations);
  if (next.has(s)) next.delete(s); else next.add(s);
  emit('update', { ...props.filters, stations: next });
}
function toggleWebhooks(): void {
  emit('update', { ...props.filters, includeWebhooks: !props.filters.includeWebhooks });
}
function reset(): void {
  emit('update', { kinds: new Set(), stations: new Set(), includeWebhooks: true });
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 bg-black/40 z-30 flex items-end justify-center" @click.self="$emit('close')">
    <div class="w-full max-w-xl bg-metro-surface-light dark:bg-metro-surface-dark rounded-t-2xl
      border-t border-metro-border-light dark:border-metro-border-dark p-4 max-h-[85vh] overflow-y-auto">
      <div class="flex items-center gap-3 mb-4">
        <h2 class="font-bold text-lg flex-1">Filter events</h2>
        <button type="button" class="text-sm font-semibold text-metro-accent hover:underline" @click="reset">Reset</button>
        <button type="button" class="text-sm font-bold text-metro-accent hover:underline" @click="$emit('close')">Done</button>
      </div>
      <section class="mb-4">
        <h3 class="text-xs uppercase font-semibold text-metro-sub-light dark:text-metro-sub-dark mb-2">Kind</h3>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="k in KINDS"
            :key="k"
            type="button"
            class="px-3 py-1.5 rounded-full text-sm font-semibold border"
            :class="filters.kinds.has(k)
              ? 'bg-metro-accent border-metro-accent text-white'
              : 'bg-metro-hover-light dark:bg-metro-hover-dark border-metro-border-light dark:border-metro-border-dark'"
            @click="toggleKind(k)"
          >{{ k }}</button>
        </div>
      </section>
      <section class="mb-4">
        <h3 class="text-xs uppercase font-semibold text-metro-sub-light dark:text-metro-sub-dark mb-2">Station</h3>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="s in STATIONS"
            :key="s"
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border"
            :class="filters.stations.has(s)
              ? 'bg-metro-accent border-metro-accent text-white'
              : 'bg-metro-hover-light dark:bg-metro-hover-dark border-metro-border-light dark:border-metro-border-dark'"
            @click="toggleStation(s)"
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
          :class="filters.includeWebhooks
            ? 'bg-metro-accent border-metro-accent text-white'
            : 'bg-metro-hover-light dark:bg-metro-hover-dark border-metro-border-light dark:border-metro-border-dark'"
          @click="toggleWebhooks"
        >{{ filters.includeWebhooks ? 'Included' : 'Hidden' }}</button>
      </section>
    </div>
  </div>
</template>
