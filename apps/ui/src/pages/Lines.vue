<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppHeader from '../components/AppHeader.vue';
import { isConfigured, loadConfig } from '../lib/config';
import { fetchState } from '../lib/api';

interface Row { line: string; owner: string | null }

const rows = ref<Row[] | null>(null);
const errMsg = ref('');
const router = useRouter();

onMounted(async () => {
  const cfg = loadConfig();
  if (!isConfigured(cfg)) { errMsg.value = 'not configured — open Settings'; return; }
  const r = await fetchState(cfg.daemonUrl, cfg.token);
  if (!r.ok) { errMsg.value = `failed (${r.status}): ${r.error}`; return; }
  const data = r.data as { lines?: string[]; claims?: Record<string, string> };
  const lines = data.lines ?? [];
  const claims = data.claims ?? {};
  rows.value = lines.map(line => ({ line, owner: claims[line] ?? null }));
});

function open(line: string): void {
  void router.push({ name: 'activity', query: { chat: line } });
}
function short(s: string): string { return s.replace(/^metro:\/\//, ''); }
</script>

<template>
  <div class="flex flex-col h-screen">
    <AppHeader />
    <div v-if="errMsg" class="flex-1 flex items-center justify-center p-6">
      <span>{{ errMsg }}</span>
    </div>
    <div v-else-if="!rows" class="flex-1 flex items-center justify-center p-6 text-metro-sub-light dark:text-metro-sub-dark">
      Loading…
    </div>
    <div v-else-if="rows.length === 0" class="flex-1 flex items-center justify-center p-6 text-metro-sub-light dark:text-metro-sub-dark">
      No lines seen yet.
    </div>
    <ul v-else class="flex-1 overflow-y-auto">
      <li
        v-for="r in rows"
        :key="r.line"
        class="px-4 py-3 border-b border-metro-border-light dark:border-metro-border-dark
          bg-metro-surface-light dark:bg-metro-surface-dark hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark
          cursor-pointer"
        @click="open(r.line)"
      >
        <div class="font-mono text-sm truncate">{{ short(r.line) }}</div>
        <div :class="r.owner ? 'text-metro-ok' : 'text-metro-sub-light dark:text-metro-sub-dark'" class="text-xs mt-1">
          {{ r.owner ? `claimed by ${short(r.owner)}` : 'unclaimed' }}
        </div>
      </li>
    </ul>
  </div>
</template>
