<script setup lang="ts">
/** Messenger — direct chat with the assistant, with image/audio/file attachments. */

import type { Config } from '../lib/config';
import { sendMessenger, uploadAttachment, type Attachment } from '../lib/messenger';

const MESSENGER_LINE = 'metro://messenger/owner';

const cfg = ref<Config>(loadConfig());
const chat = ref<string | undefined>(MESSENGER_LINE);
const text = ref('');
const sending = ref(false);
const err = ref<string | null>(null);
const pending = ref<Attachment[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const imageInput = ref<HTMLInputElement | null>(null);

const tail = useTail(cfg, chat);
const bubbles = computed(() => [...tail.events.value].reverse());

/** MediaRecorder state for press-and-hold voice notes. */
const recording = ref(false);
const recordSecs = ref(0);
let recorder: MediaRecorder | null = null;
let recordChunks: Blob[] = [];
let recordTimer: ReturnType<typeof setInterval> | null = null;

async function pickAndUpload(input: HTMLInputElement | null): Promise<void> {
  const file = input?.files?.[0];
  if (!file) return;
  try {
    const att = await uploadAttachment(cfg.value.daemonUrl, cfg.value.token, file, file.name);
    pending.value = [...pending.value, att];
  } catch (e) { err.value = (e as Error).message; }
  finally { if (input) input.value = ''; }
}

async function startRecording(): Promise<void> {
  err.value = null;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordChunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e): void => { if (e.data.size > 0) recordChunks.push(e.data); };
    recorder.onstop = (): void => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(recordChunks, { type: recorder?.mimeType ?? 'audio/webm' });
      void uploadAttachment(cfg.value.daemonUrl, cfg.value.token, blob, `voice-${Date.now()}.webm`)
        .then(att => { pending.value = [...pending.value, att]; })
        .catch(e => { err.value = (e as Error).message; });
    };
    recorder.start();
    recording.value = true;
    recordSecs.value = 0;
    recordTimer = setInterval(() => { recordSecs.value += 1; }, 1000);
  } catch (e) { err.value = (e as Error).message; }
}

function stopRecording(): void {
  if (!recorder || recorder.state === 'inactive') return;
  recorder.stop();
  recording.value = false;
  if (recordTimer) { clearInterval(recordTimer); recordTimer = null; }
}

async function send(): Promise<void> {
  const body = text.value.trim();
  if (!body && pending.value.length === 0) return;
  sending.value = true; err.value = null;
  try {
    await sendMessenger(cfg.value.daemonUrl, cfg.value.token, body, pending.value);
    text.value = ''; pending.value = [];
  } catch (e) { err.value = (e as Error).message; }
  finally { sending.value = false; }
}

onMounted(() => { cfg.value = loadConfig(); tail.reconnect(); });
onBeforeUnmount(() => { tail.stop(); stopRecording(); });
</script>

<template>
  <div class="flex flex-col min-h-screen pb-[124px]">
    <AppHeader
      :status="tail.status.value"
      :errorMsg="tail.errMsg.value"
      :count="tail.events.value.length"
    />
    <div class="flex-1 px-3 py-3 flex flex-col gap-1.5">
      <MessengerBubble
        v-for="e in bubbles"
        :key="e.id"
        :entry="e"
        :daemonUrl="cfg.daemonUrl"
        :token="cfg.token"
      />
      <div v-if="bubbles.length === 0" class="p-8 text-center text-metro-sub-light dark:text-metro-sub-dark">
        Type a message below to start chatting.
      </div>
    </div>
    <div v-if="err" class="px-4 pt-2 text-xs text-metro-err fixed bottom-[124px] left-0 right-0">send failed: {{ err }}</div>
    <div class="fixed bottom-[60px] left-0 right-0 z-10
      border-t border-metro-border-light dark:border-metro-border-dark
      bg-metro-surface-light dark:bg-metro-surface-dark">
      <div v-if="pending.length" class="flex flex-wrap gap-2 px-3 pt-2">
        <div v-for="(a, i) in pending" :key="a.id"
          class="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs
            bg-metro-hover-light dark:bg-metro-hover-dark text-metro-fg-light dark:text-metro-fg-dark">
          <span>{{ a.kind === 'image' ? '🖼' : a.kind === 'audio' ? '🎤' : '📎' }}</span>
          <span class="max-w-[140px] truncate">{{ a.name ?? a.id }}</span>
          <button class="opacity-60 hover:opacity-100" @click="pending = pending.filter((_, j) => j !== i)">✕</button>
        </div>
      </div>
      <div v-if="recording" class="flex items-center gap-2 px-3 pt-2 text-xs text-metro-err">
        <span class="w-2 h-2 rounded-full bg-metro-err animate-pulse"></span>
        Recording… {{ recordSecs }}s
      </div>
      <div class="flex items-end gap-1.5 p-3">
        <input ref="imageInput" type="file" accept="image/*" class="hidden" @change="pickAndUpload(imageInput)" />
        <input ref="fileInput" type="file" class="hidden" @change="pickAndUpload(fileInput)" />
        <button type="button" title="Image"
          class="text-lg w-9 h-9 rounded-full hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
          @click="imageInput?.click()">🖼</button>
        <button type="button" title="File"
          class="text-lg w-9 h-9 rounded-full hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
          @click="fileInput?.click()">📎</button>
        <button type="button" :title="recording ? 'Stop' : 'Record'"
          class="text-lg w-9 h-9 rounded-full"
          :class="recording
            ? 'bg-metro-err text-white'
            : 'hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark'"
          @click="recording ? stopRecording() : startRecording()">{{ recording ? '⏹' : '🎤' }}</button>
        <textarea
          v-model="text"
          placeholder="Message the assistant…"
          rows="1"
          class="flex-1 resize-none min-h-[40px] max-h-[120px] bg-metro-bg-light dark:bg-metro-bg-dark
            border border-metro-border-light dark:border-metro-border-dark rounded-2xl px-4 py-2 text-sm outline-none
            focus:ring-2 focus:ring-metro-accent"
          @keydown.enter.exact.prevent="send"
        />
        <button
          type="button"
          :disabled="sending || (!text.trim() && pending.length === 0)"
          class="bg-metro-accent hover:bg-metro-accent-hover text-black font-bold px-5 py-2 rounded-full
            disabled:opacity-50 min-w-[68px]"
          @click="send"
        >{{ sending ? '…' : 'Send' }}</button>
      </div>
    </div>
  </div>
</template>
