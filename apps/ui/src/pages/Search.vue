<script setup lang="ts">
/** Search — live tail + substring filter. Mirrors apps/app/(tabs)/search.tsx. */

import type { Config } from '../lib/config';

const cfg = ref<Config>(loadConfig());
const chat = ref<string | undefined>(undefined);
const query = ref('');

const tail = useTail(cfg, chat);

const results = computed(() => {
  const all = tail.events.value;
  return query.value ? all.filter(e => matchesSearch(e, query.value)) : all;
});

onMounted(() => { cfg.value = loadConfig(); tail.reconnect(); });
onBeforeUnmount(() => tail.stop());
</script>

<template>
  <div class="flex flex-col h-screen">
    <AppHeader
      :status="tail.status.value"
      :errorMsg="tail.errMsg.value"
      :count="results.length"
    />
    <SearchBar v-model="query" />
    <div class="flex-1 overflow-y-auto">
      <EventRow v-for="e in results" :key="e.id" :entry="e" />
      <div v-if="results.length === 0" class="p-8 text-center text-metro-sub-light dark:text-metro-sub-dark">
        {{ query ? 'No matches.' : 'Type to search the live event stream…' }}
      </div>
    </div>
  </div>
</template>
