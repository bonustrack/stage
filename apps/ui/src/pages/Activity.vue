<script setup lang="ts">
import { type Filters } from '../components/FilterSheet.vue';
import { type Config } from '../lib/config';
import type { HistoryEntry } from '../lib/types';

const route = useRoute();
const router = useRouter();
const cfg = ref<Config>(loadConfig());
const chat = computed(() => (route.query.chat as string | undefined) ?? undefined);
const filterOpen = ref(false);
const filters = ref<Filters>({ kinds: new Set(), stations: new Set(), includeWebhooks: true });

const tail = useTail(cfg, chat);

function matchesFilters(e: HistoryEntry): boolean {
  if (!filters.value.includeWebhooks && e.station === 'webhook') return false;
  if (filters.value.kinds.size > 0 && !filters.value.kinds.has(e.kind)) return false;
  if (filters.value.stations.size > 0 && !filters.value.stations.has(e.station)) return false;
  return true;
}

const visible = computed(() => {
  const seen = new Set(tail.events.value.map(e => e.id));
  return [
    ...tail.events.value,
    ...tail.older.value.filter(e => !seen.has(e.id)),
  ].filter(e => matchesFilters(e));
});

const filterActive = computed(() =>
  filters.value.kinds.size > 0 || filters.value.stations.size > 0 || !filters.value.includeWebhooks,
);

onMounted(() => { cfg.value = loadConfig(); tail.reconnect(); });
onBeforeUnmount(() => tail.stop());

function clearChat(): void { void router.push({ name: 'activity' }); }
</script>

<template>
  <div class="flex flex-col min-h-screen">
    <AppHeader
      :status="tail.status.value"
      :errorMsg="tail.errMsg.value"
      :count="visible.length"
      :chat="chat"
      :filterActive="filterActive"
      @clearChat="clearChat"
      @filter="filterOpen = true"
    />
    <template v-if="!isConfigured(cfg)">
      <div class="flex-1 flex flex-col items-center justify-center gap-4 p-6">
        <h1 class="text-2xl font-bold">Welcome to Metro</h1>
        <p class="text-metro-sub-light dark:text-metro-sub-dark max-w-md text-center">
          Set the daemon URL + bearer token to start streaming your activity feed.
        </p>
        <button
          type="button"
          class="bg-metro-accent hover:bg-metro-accent-hover text-white font-bold px-6 py-3 rounded"
          @click="router.push('/settings')"
        >Open Settings</button>
      </div>
    </template>
    <template v-else>
      <ActivityChart :events="visible" />
      <div class="flex-1">
        <EventRow v-for="e in visible" :key="e.id" :entry="e" />
        <div v-if="visible.length === 0" class="p-8 text-center text-metro-sub-light dark:text-metro-sub-dark">
          <template v-if="filterActive">No events match the active filters.</template>
          <template v-else>Waiting for events…</template>
        </div>
        <div v-if="visible.length > 0" class="p-4 text-center">
          <button
            v-if="!tail.olderDone.value"
            type="button"
            class="text-sm text-metro-accent hover:underline disabled:opacity-50"
            :disabled="tail.loadingOlder.value"
            @click="tail.loadOlder()"
          >{{ tail.loadingOlder.value ? 'Loading…' : 'Load older' }}</button>
          <span v-else class="text-xs text-metro-sub-light dark:text-metro-sub-dark">— end of history —</span>
        </div>
      </div>
      <Composer v-if="chat" :daemonUrl="cfg.daemonUrl" :token="cfg.token" :line="chat" />
      <FilterSheet :open="filterOpen" :filters="filters" @close="filterOpen = false" @update="filters = $event" />
    </template>
  </div>
</template>
