<script setup lang="ts">
/** Channel list — every messenger channel the signed-in identity is a member of. */

import { channelShortId, listChannels, type Channel } from '../lib/channels';
import { isConfigured, loadConfig } from '../lib/config';

const rows = ref<Channel[] | null>(null);
const errMsg = ref('');
const router = useRouter();

onMounted(async () => {
  const cfg = loadConfig();
  if (!isConfigured(cfg)) { errMsg.value = 'not configured — open Settings'; return; }
  try { rows.value = await listChannels(cfg.daemonUrl, cfg.token); }
  catch (err) { errMsg.value = (err as Error).message; }
});

function openChannel(line: string): void {
  void router.push({ name: 'messenger', query: { line } });
}

function fmtTs(ts: string | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function shortAddr(uri: string): string {
  const m = uri.match(/^metro:\/\/user\/eth\/(0x[a-f0-9]{40})$/i);
  if (m) return `${m[1].slice(0, 6)}…${m[1].slice(-4)}`;
  return uri.replace(/^metro:\/\//, '');
}
</script>

<template>
  <div class="flex flex-col min-h-screen">
    <AppHeader />
    <div v-if="errMsg" class="flex-1 flex items-center justify-center p-6 text-metro-sub-light dark:text-metro-sub-dark">
      {{ errMsg }}
    </div>
    <div v-else-if="!rows" class="flex-1 flex items-center justify-center p-6 text-metro-sub-light dark:text-metro-sub-dark">
      Loading…
    </div>
    <div v-else-if="rows.length === 0" class="flex-1 flex items-center justify-center p-6 text-metro-sub-light dark:text-metro-sub-dark">
      No channels yet.
    </div>
    <ul v-else class="flex-1">
      <li
        v-for="r in rows"
        :key="r.line"
        class="px-4 py-3 border-b border-metro-border-light dark:border-metro-border-dark
          bg-metro-surface-light dark:bg-metro-surface-dark hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark
          cursor-pointer"
        @click="openChannel(r.line)"
      >
        <div class="flex items-center justify-between gap-2.5">
          <div class="min-w-0 flex-1">
            <div class="font-mono text-sm truncate">{{ channelShortId(r.line) }}</div>
            <div class="text-xs mt-0.5 text-metro-sub-light dark:text-metro-sub-dark">
              {{ r.members.map(shortAddr).join(' · ') }}
            </div>
          </div>
          <span class="text-xs text-metro-sub-light dark:text-metro-sub-dark shrink-0">{{ fmtTs(r.lastTs) }}</span>
        </div>
      </li>
    </ul>
  </div>
</template>
