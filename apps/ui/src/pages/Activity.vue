<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppHeader from '../components/AppHeader.vue';
import EventRow from '../components/EventRow.vue';
import { isConfigured, loadConfig, type Config } from '../lib/config';
import { fetchHistoryPage, fetchState, openTail } from '../lib/api';
import type { HistoryEntry } from '../lib/types';

const route = useRoute();
const router = useRouter();
const cfg = ref<Config>(loadConfig());
const events = ref<HistoryEntry[]>([]);
const older = ref<HistoryEntry[]>([]);
const olderDone = ref(false);
const loadingOlder = ref(false);
const status = ref<'idle' | 'connecting' | 'open' | 'error' | 'closed'>('idle');
const errMsg = ref<string | null>(null);
let abort: AbortController | null = null;

const chat = computed(() => (route.query.chat as string | undefined) ?? undefined);
const allEvents = computed(() => {
  const seen = new Set(events.value.map(e => e.id));
  return [...events.value, ...older.value.filter(e => !seen.has(e.id))];
});

function connect(): void {
  if (abort) abort.abort();
  events.value = [];
  older.value = [];
  olderDone.value = false;
  errMsg.value = null;
  if (!isConfigured(cfg.value)) { status.value = 'idle'; return; }
  status.value = 'connecting';
  void fetchState(cfg.value.daemonUrl, cfg.value.token).then(r => {
    if (!r.ok) return;
    const seed = (r.data as { recent_history?: HistoryEntry[] }).recent_history ?? [];
    const filtered = chat.value ? seed.filter(e => e.line === chat.value) : seed;
    events.value = filtered.slice(0, 500);
  });
  abort = new AbortController();
  void openTail({
    daemonUrl: cfg.value.daemonUrl,
    token: cfg.value.token,
    as: cfg.value.userId || undefined,
    chat: chat.value,
    includeWebhooks: true,
    signal: abort.signal,
    onOpen: () => { status.value = 'open'; },
    onEntry: e => {
      events.value = [e, ...events.value.filter(x => x.id !== e.id)].slice(0, 500);
    },
    onError: m => { status.value = 'error'; errMsg.value = m; },
    onClose: () => { status.value = 'closed'; },
  });
}

async function loadOlder(): Promise<void> {
  if (olderDone.value || loadingOlder.value) return;
  loadingOlder.value = true;
  const before = events.value.length + older.value.length;
  const r = await fetchHistoryPage(cfg.value.daemonUrl, cfg.value.token, before, 20);
  loadingOlder.value = false;
  if (!r.ok || r.entries.length === 0) { olderDone.value = true; return; }
  const seen = new Set([...events.value, ...older.value].map(e => e.id));
  older.value = [...older.value, ...r.entries.filter(e => !seen.has(e.id))];
}

onMounted(() => {
  cfg.value = loadConfig();
  connect();
});
onBeforeUnmount(() => abort?.abort());
watch(() => route.query.chat, connect);

function clearChat(): void { void router.push({ name: 'activity' }); }
</script>

<template>
  <div class="flex flex-col h-screen">
    <AppHeader
      :status="status"
      :errorMsg="errMsg"
      :count="allEvents.length"
      :chat="chat"
      @clearChat="clearChat"
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
      <div class="flex-1 overflow-y-auto">
        <EventRow v-for="e in allEvents" :key="e.id" :entry="e" />
        <div v-if="allEvents.length === 0" class="p-8 text-center text-metro-sub-light dark:text-metro-sub-dark">
          Waiting for events…
        </div>
        <div v-if="allEvents.length > 0" class="p-4 text-center">
          <button
            v-if="!olderDone"
            type="button"
            class="text-sm text-metro-accent hover:underline"
            :disabled="loadingOlder"
            @click="loadOlder"
          >{{ loadingOlder ? 'Loading…' : 'Load older' }}</button>
          <span v-else class="text-xs text-metro-sub-light dark:text-metro-sub-dark">— end of history —</span>
        </div>
      </div>
    </template>
  </div>
</template>
