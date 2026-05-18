<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppHeader from '../components/AppHeader.vue';
import { loadConfig, saveConfig, type Config } from '../lib/config';
import { fetchState } from '../lib/api';

const cfg = ref<Config>({ daemonUrl: '', token: '', userId: '' });
const testing = ref(false);
const testResult = ref('');
const daemonVersion = ref<string | null>(null);
const router = useRouter();

onMounted(async () => {
  cfg.value = loadConfig();
  if (cfg.value.daemonUrl && cfg.value.token) {
    const r = await fetchState(cfg.value.daemonUrl, cfg.value.token);
    if (r.ok) daemonVersion.value = (r.data as { version?: string }).version ?? null;
  }
});

async function test(): Promise<void> {
  testing.value = true; testResult.value = '';
  const r = await fetchState(cfg.value.daemonUrl, cfg.value.token);
  testing.value = false;
  if (r.ok) {
    const d = r.data as { recent_history?: unknown[]; claims?: Record<string, unknown>; version?: string };
    const ev = d.recent_history?.length ?? 0;
    const claims = Object.keys(d.claims ?? {}).length;
    testResult.value = `ok — ${ev} recent events, ${claims} claims`;
    if (d.version) daemonVersion.value = d.version;
  } else {
    testResult.value = `failed (${r.status || 'network'}): ${r.error}`;
  }
}

function save(then: 'back' | 'stay'): void {
  saveConfig(cfg.value);
  if (then === 'back') router.back();
}
</script>

<template>
  <div class="flex flex-col h-screen">
    <AppHeader />
    <div class="flex-1 overflow-y-auto p-4 max-w-xl w-full mx-auto space-y-4">
      <div>
        <label class="block text-sm font-semibold mb-1">Daemon URL</label>
        <input
          v-model="cfg.daemonUrl"
          type="url"
          placeholder="https://monitor.metro.box"
          class="w-full font-mono text-sm bg-metro-surface-light dark:bg-metro-surface-dark
            border border-metro-border-light dark:border-metro-border-dark rounded-md px-3 py-2 outline-none
            focus:ring-2 focus:ring-metro-accent"
        />
        <p class="mt-1 text-xs text-metro-sub-light dark:text-metro-sub-dark">e.g. https://monitor.metro.box</p>
      </div>
      <div>
        <label class="block text-sm font-semibold mb-1">Bearer token</label>
        <input
          v-model="cfg.token"
          type="password"
          class="w-full font-mono text-sm bg-metro-surface-light dark:bg-metro-surface-dark
            border border-metro-border-light dark:border-metro-border-dark rounded-md px-3 py-2 outline-none
            focus:ring-2 focus:ring-metro-accent"
        />
        <p class="mt-1 text-xs text-metro-sub-light dark:text-metro-sub-dark">value of METRO_MONITOR_TOKEN on the daemon</p>
      </div>
      <div>
        <label class="block text-sm font-semibold mb-1">Self URI (optional)</label>
        <input
          v-model="cfg.userId"
          type="text"
          placeholder="metro://claude/user/…"
          class="w-full font-mono text-sm bg-metro-surface-light dark:bg-metro-surface-dark
            border border-metro-border-light dark:border-metro-border-dark rounded-md px-3 py-2 outline-none
            focus:ring-2 focus:ring-metro-accent"
        />
        <p class="mt-1 text-xs text-metro-sub-light dark:text-metro-sub-dark">enables 'mine + free' filtering</p>
      </div>
      <div class="flex gap-3">
        <button
          type="button"
          :disabled="testing || !cfg.daemonUrl || !cfg.token"
          class="flex-1 px-4 py-2 rounded-md border border-metro-border-light dark:border-metro-border-dark
            bg-metro-surface-light dark:bg-metro-surface-dark disabled:opacity-50"
          @click="test"
        >{{ testing ? 'Testing…' : 'Test connection' }}</button>
        <button
          type="button"
          class="flex-1 px-4 py-2 rounded-md bg-metro-accent hover:bg-metro-accent-hover text-white font-bold"
          @click="save('back')"
        >Save</button>
      </div>
      <p
        v-if="testResult"
        :class="testResult.startsWith('ok') ? 'text-metro-ok' : 'text-metro-err'"
        class="text-sm"
      >{{ testResult }}</p>
      <p class="text-xs text-metro-sub-light dark:text-metro-sub-dark leading-relaxed">
        Tokens are stored in <code>localStorage</code> in this browser only. They are sent only as
        the <code>Authorization: Bearer</code> header on requests to the daemon URL above.
      </p>
      <p class="text-xs text-center text-metro-sub-light dark:text-metro-sub-dark">
        daemon {{ daemonVersion ? `v${daemonVersion}` : '(unknown — test connection)' }}
      </p>
    </div>
  </div>
</template>
