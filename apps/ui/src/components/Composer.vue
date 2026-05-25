<script setup lang="ts">
/** Plain-text composer wired to the local XMTP client. Enter sends, Shift+Enter newlines.
 *  When a reply target is set the bar above the input shows the snippet with a clear button. */

import { xmtpSendText, xmtpReply } from '../lib/xmtpSend';

const props = defineProps<{
  line: string;
  replyingTo?: { id: string; preview: string } | null;
}>();
const emit = defineEmits<{
  (e: 'clear-reply'): void;
  (e: 'optimistic', payload: { localId: string; text: string; replyTo?: string }): void;
  (e: 'sent', localId: string): void;
}>();

const text = ref('');
const sending = ref(false);
const err = ref<string | null>(null);

async function send(): Promise<void> {
  const body = text.value.trim();
  if (!body || sending.value) return;
  sending.value = true;
  err.value = null;
  const localId = `tmp_${Math.random().toString(36).slice(2, 10)}`;
  const replyTo = props.replyingTo?.id;
  emit('optimistic', { localId, text: body, ...(replyTo ? { replyTo } : {}) });
  text.value = '';
  try {
    if (replyTo) await xmtpReply(props.line, replyTo, body);
    else await xmtpSendText(props.line, body);
    emit('clear-reply');
    emit('sent', localId);
  } catch (e) {
    err.value = (e as Error).message;
    emit('sent', localId);
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <div class="border-t border-metro-border-light dark:border-metro-border-dark
    bg-metro-bg-light dark:bg-metro-bg-dark">
    <div v-if="err" class="px-4 pt-2 text-xs text-metro-err">send failed: {{ err }}</div>
    <div v-if="props.replyingTo"
      class="flex items-center gap-2 px-4 pt-2 text-xs text-metro-sub-light dark:text-metro-sub-dark">
      <HeroIcon name="reply" :size="14" />
      <span class="flex-1 truncate">Replying to: {{ props.replyingTo.preview }}</span>
      <button type="button" class="opacity-70 hover:opacity-100" @click="emit('clear-reply')">
        <HeroIcon name="x" :size="14" />
      </button>
    </div>
    <div class="flex items-end gap-2 p-3">
      <textarea
        v-model="text"
        placeholder="Message…"
        rows="1"
        class="flex-1 resize-none min-h-[40px] max-h-[120px]
          bg-metro-surface-light dark:bg-metro-surface-dark
          border border-metro-border-light dark:border-metro-border-dark rounded-2xl px-4 py-2 text-sm outline-none
          text-metro-fg-light dark:text-metro-fg-dark
          focus:ring-2 focus:ring-metro-fg-light dark:focus:ring-metro-fg-dark"
        @keydown.enter.exact.prevent="send"
      />
      <button
        type="button"
        :disabled="sending || !text.trim()"
        class="bg-metro-fg-light dark:bg-metro-fg-dark text-metro-bg-light dark:text-metro-bg-dark
          font-semibold px-5 py-2 rounded-full disabled:opacity-50 min-w-[68px]"
        @click="send"
      >{{ sending ? '…' : 'Send' }}</button>
    </div>
  </div>
</template>
