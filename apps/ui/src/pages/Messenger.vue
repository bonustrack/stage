<script setup lang="ts">
/** Messenger — direct chat with the assistant via POST /api/messenger/send. */

import type { Config } from '../lib/config';

const MESSENGER_LINE = 'metro://messenger/owner';

const cfg = ref<Config>(loadConfig());
const chat = ref<string | undefined>(MESSENGER_LINE);
const text = ref('');
const sending = ref(false);
const err = ref<string | null>(null);

const tail = useTail(cfg, chat);

async function sendMessenger(): Promise<void> {
  const body = text.value.trim();
  if (!body) return;
  sending.value = true; err.value = null;
  try {
    const res = await fetch(`${cfg.value.daemonUrl.replace(/\/$/, '')}/api/messenger/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.value.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: body, as: 'user' }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      err.value = j.error ?? `HTTP ${res.status}`;
    } else {
      text.value = '';
    }
  } catch (e) {
    err.value = (e as Error).message;
  } finally {
    sending.value = false;
  }
}

onMounted(() => { cfg.value = loadConfig(); tail.reconnect(); });
onBeforeUnmount(() => tail.stop());
</script>

<template>
  <div class="flex flex-col min-h-screen pb-[64px]">
    <AppHeader
      :status="tail.status.value"
      :errorMsg="tail.errMsg.value"
      :count="tail.events.value.length"
    />
    <div class="flex-1">
      <EventRow v-for="e in tail.events.value" :key="e.id" :entry="e" />
      <div v-if="tail.events.value.length === 0" class="p-8 text-center text-metro-sub-light dark:text-metro-sub-dark">
        Type a message below to start chatting.
      </div>
    </div>
    <div v-if="err" class="px-4 pt-2 text-xs text-metro-err fixed bottom-[124px] left-0 right-0">send failed: {{ err }}</div>
    <div class="fixed bottom-[60px] left-0 right-0 z-10
      border-t border-metro-border-light dark:border-metro-border-dark
      bg-metro-surface-light dark:bg-metro-surface-dark
      flex items-end gap-2 p-3">
      <textarea
        v-model="text"
        placeholder="Message the assistant…"
        rows="1"
        class="flex-1 resize-none min-h-[40px] max-h-[120px] bg-metro-bg-light dark:bg-metro-bg-dark
          border border-metro-border-light dark:border-metro-border-dark rounded-2xl px-4 py-2 text-sm outline-none
          focus:ring-2 focus:ring-metro-accent"
        @keydown.enter.exact.prevent="sendMessenger"
      />
      <button
        type="button"
        :disabled="sending || !text.trim()"
        class="bg-metro-accent hover:bg-metro-accent-hover text-black font-bold px-5 py-2 rounded-full
          disabled:opacity-50 min-w-[68px]"
        @click="sendMessenger"
      >{{ sending ? '…' : 'Send' }}</button>
    </div>
  </div>
</template>
