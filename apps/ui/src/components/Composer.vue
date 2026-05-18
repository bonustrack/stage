<script setup lang="ts">
import { computed, ref } from 'vue';
import { sendCall } from '../lib/api';

const props = defineProps<{ daemonUrl: string; token: string; line: string }>();

const text = ref('');
const sending = ref(false);
const err = ref<string | null>(null);

const train = computed(() => {
  const m = props.line.match(/^metro:\/\/([^/]+)/);
  return m ? m[1] : null;
});

async function send(): Promise<void> {
  const body = text.value.trim();
  if (!body || !train.value) return;
  sending.value = true; err.value = null;
  const r = await sendCall(props.daemonUrl, props.token, train.value, 'send', { line: props.line, text: body });
  sending.value = false;
  if (r.ok) { text.value = ''; return; }
  err.value = r.error;
}

function onKeydown(ev: KeyboardEvent): void {
  if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); void send(); }
}
</script>

<template>
  <div v-if="train" class="border-t border-metro-border-light dark:border-metro-border-dark
    bg-metro-surface-light dark:bg-metro-surface-dark">
    <div v-if="err" class="px-4 pt-2 text-xs text-metro-err">send failed: {{ err }}</div>
    <div class="flex items-end gap-2 p-3">
      <textarea
        v-model="text"
        :placeholder="`Message ${train}…`"
        rows="1"
        class="flex-1 resize-none min-h-[40px] max-h-[120px] bg-metro-bg-light dark:bg-metro-bg-dark
          border border-metro-border-light dark:border-metro-border-dark rounded-2xl px-4 py-2 text-sm outline-none
          focus:ring-2 focus:ring-metro-accent"
        @keydown="onKeydown"
      />
      <button
        type="button"
        :disabled="sending || !text.trim()"
        class="bg-metro-accent hover:bg-metro-accent-hover text-white font-bold px-5 py-2 rounded-2xl
          disabled:opacity-50 min-w-[68px]"
        @click="send"
      >{{ sending ? '…' : 'Send' }}</button>
    </div>
  </div>
</template>
