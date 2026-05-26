<script setup lang="ts">
/** Plain-text composer wired to the local XMTP client. Enter sends, Shift+Enter newlines.
 *  When a reply target is set the bar above the input shows the snippet with a clear button. */

import { xmtpSendText, xmtpReply, xmtpSendAttachment } from '../lib/xmtpSend';

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

function toggleAttach(): void { attachOpen.value = !attachOpen.value; }

function pickImage(): void {
  attachOpen.value = false;
  fileInput.value?.click();
}

async function onFileChange(ev: Event): Promise<void> {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const dataB64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (): void => {
        const r = reader.result;
        if (typeof r !== 'string') { reject(new Error('FileReader returned non-string')); return; }
        const comma = r.indexOf(',');
        resolve(comma === -1 ? r : r.slice(comma + 1));
      };
      reader.onerror = (): void => reject(reader.error ?? new Error('FileReader failed'));
      reader.readAsDataURL(file);
    });
    await xmtpSendAttachment(props.line, file.name, file.type || 'application/octet-stream', dataB64);
  } catch (e) {
    err.value = (e as Error).message;
  }
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
    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileChange" />
    <!-- Mobile-style composer: textarea on top, [+ / spacer / send] row below,
         both inside one rounded surface. Mirrors MessengerComposer.tsx. -->
    <div class="m-2.5 p-2.5 rounded-2xl bg-metro-surface-light dark:bg-metro-surface-dark">
      <textarea
        v-model="text"
        placeholder="Message…"
        rows="2"
        class="w-full resize-none min-h-[44px] max-h-[140px] font-sans
          bg-transparent px-2 pt-1 pb-2 text-[16px] leading-snug outline-none
          text-metro-fg-light dark:text-metro-fg-dark
          placeholder:text-metro-sub-light dark:placeholder:text-metro-sub-dark"
        @keydown.enter.exact.prevent="send"
      />
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="w-9 h-9 shrink-0 rounded-full flex items-center justify-center
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
          :disabled="sending || !text.trim()"
          class="w-9 h-9 shrink-0 rounded-full flex items-center justify-center
            bg-metro-head-light dark:bg-metro-head-dark text-metro-bg-light dark:text-metro-bg-dark
            disabled:opacity-50"
          :title="sending ? 'Sending…' : 'Send'"
          @click="send"
        >
          <HeroIcon name="send" :size="18" />
        </button>
      </div>
    </div>
    <!-- Attach menu drops BELOW the composer row when open, matching mobile.
         Mobile uses box-style options stacked horizontally; mirror that. -->
    <div v-if="attachOpen" class="flex gap-2 px-2.5 pb-3">
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
