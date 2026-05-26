<script setup lang="ts">
/** Plain-text composer wired to the local XMTP client. Enter sends, Shift+Enter newlines.
 *  When a reply target is set the bar above the input shows the snippet with a clear button. */

import { xmtpSendText, xmtpReply } from '../lib/xmtpSend';
import { useComposerAttach } from '../lib/useComposerAttach';

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
const attachOpen = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const textarea = ref<HTMLTextAreaElement | null>(null);
const { pending, clear: clearPending, onPaste, onFileChange, flush: flushPending } =
  useComposerAttach(() => props.line, m => { err.value = m; });

function toggleAttach(): void { attachOpen.value = !attachOpen.value; }

function pickImage(): void {
  attachOpen.value = false;
  fileInput.value?.click();
}

/** Grow the textarea with its content up to the max height. */
function autoGrow(): void {
  const el = textarea.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
}

async function shareLocation(): Promise<void> {
  attachOpen.value = false;
  if (!navigator.geolocation) {
    err.value = 'Geolocation unavailable in this browser.';
    return;
  }
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000,
      });
    });
    const { latitude, longitude } = pos.coords;
    const url = `https://maps.google.com/?q=${latitude.toFixed(7)},${longitude.toFixed(7)}`;
    const localId = `tmp_${Math.random().toString(36).slice(2, 10)}`;
    const body = `📍 ${url}`;
    emit('optimistic', { localId, text: body });
    await xmtpSendText(props.line, body);
    emit('sent', localId);
  } catch (e) {
    err.value = `Location failed: ${(e as Error).message ?? 'permission denied'}`;
  }
}

async function send(): Promise<void> {
  const body = text.value.trim();
  const staged = pending.value;
  if ((!body && !staged) || sending.value) return;
  sending.value = true;
  err.value = null;
  try {
    if (staged) await flushPending();
    if (body) {
      const localId = `tmp_${Math.random().toString(36).slice(2, 10)}`;
      const replyTo = props.replyingTo?.id;
      emit('optimistic', { localId, text: body, ...(replyTo ? { replyTo } : {}) });
      text.value = '';
      nextTick(autoGrow);
      if (replyTo) await xmtpReply(props.line, replyTo, body);
      else await xmtpSendText(props.line, body);
      emit('clear-reply');
      emit('sent', localId);
    }
  } catch (e) {
    err.value = (e as Error).message;
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <div class="bg-metro-bg-light dark:bg-metro-bg-dark">
    <div v-if="err" class="px-4 pt-2 text-xs text-metro-err">send failed: {{ err }}</div>
    <div v-if="props.replyingTo"
      class="flex items-center gap-2 px-4 pt-2 text-xs text-metro-sub-light dark:text-metro-sub-dark">
      <HeroIcon name="reply" :size="14" />
      <span class="flex-1 truncate">Replying to: {{ props.replyingTo.preview }}</span>
      <button type="button" class="opacity-70 hover:opacity-100" @click="emit('clear-reply')">
        <HeroIcon name="x" :size="14" />
      </button>
    </div>
    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileChange" />
    <!-- Mobile-style composer: textarea on top, [+ / spacer / send] row below,
         both inside one rounded surface. Mirrors MessengerComposer.tsx. -->
    <div class="m-3 px-3 pt-2.5 pb-1.5 rounded-2xl bg-metro-surface-light dark:bg-metro-surface-dark">
      <!-- Pending pasted/selected image preview — removable, sent on Send. -->
      <div v-if="pending" class="relative inline-block mb-2">
        <img :src="pending.url" alt="" class="max-h-32 rounded-lg" />
        <button
          type="button"
          class="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center"
          title="Remove"
          @click="clearPending"
        >
          <HeroIcon name="x" :size="12" />
        </button>
      </div>
      <textarea
        ref="textarea"
        v-model="text"
        placeholder="Message…"
        rows="1"
        class="w-full resize-none min-h-[24px] max-h-[140px] font-sans
          bg-transparent px-2 py-0 text-[17px] leading-snug outline-none
          text-metro-head-light dark:text-metro-head-dark
          placeholder:text-metro-sub-light dark:placeholder:text-metro-sub-dark"
        @input="autoGrow"
        @keydown.enter.exact.prevent="send"
        @paste="onPaste"
      />
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="w-10 h-10 shrink-0 rounded-full flex items-center justify-center
            text-metro-fg-light dark:text-metro-fg-dark
            hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
          :title="attachOpen ? 'Close attach menu' : 'Attach'"
          @click="toggleAttach"
        >
          <HeroIcon :name="attachOpen ? 'x' : 'plus'" :size="20" />
        </button>
        <div class="flex-1" />
        <button
          type="button"
          :disabled="sending || (!text.trim() && !pending)"
          class="w-10 h-10 shrink-0 rounded-full flex items-center justify-center
            bg-metro-head-light dark:bg-metro-head-dark text-metro-bg-light dark:text-metro-bg-dark
            disabled:opacity-50"
          :title="sending ? 'Sending…' : 'Send'"
          @click="send"
        >
          <HeroIcon name="send" :size="22" />
        </button>
      </div>
    </div>
    <!-- Attach menu drops BELOW the composer row when open, matching mobile.
         Mobile uses box-style options stacked horizontally; mirror that. -->
    <div v-if="attachOpen" class="flex gap-2 px-3 pb-3">
      <button
        type="button"
        class="flex items-center gap-2 px-3 py-2 rounded-xl
          border border-metro-border-light dark:border-metro-border-dark
          bg-metro-surface-light dark:bg-metro-surface-dark text-sm font-sans
          text-metro-fg-light dark:text-metro-fg-dark
          hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
        @click="pickImage"
      >
        <HeroIcon name="photo" :size="16" /> Image
      </button>
      <button
        type="button"
        class="flex items-center gap-2 px-3 py-2 rounded-xl
          border border-metro-border-light dark:border-metro-border-dark
          bg-metro-surface-light dark:bg-metro-surface-dark text-sm font-sans
          text-metro-fg-light dark:text-metro-fg-dark
          hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
        @click="shareLocation"
      >
        <HeroIcon name="mapPin" :size="16" /> Location
      </button>
    </div>
  </div>
</template>
