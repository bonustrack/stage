<script setup lang="ts">
/** Messenger — direct chat with the assistant. Mirrors the mobile composer (floating, 2-line, heroicons). */

import type { Config } from '../lib/config';
import {
  isReaction, reactMessenger, reactionsByMessage, sendMessenger, uploadAttachment, type Attachment,
} from '../lib/messenger';

const MESSENGER_LINE = 'metro://messenger/owner';

const cfg = ref<Config>(loadConfig());
const chat = ref<string | undefined>(MESSENGER_LINE);
const text = ref('');
const sending = ref(false);
const err = ref<string | null>(null);
const pending = ref<Attachment[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const imageInput = ref<HTMLInputElement | null>(null);
const attachMenuOpen = ref(false);

const tail = useTail(cfg, chat);
const bubbles = computed(() => [...tail.events.value].reverse().filter(e => !isReaction(e)));
const reactions = computed(() => reactionsByMessage(tail.events.value));

function chipImageUrl(a: Attachment): string {
  return `${cfg.value.daemonUrl.replace(/\/$/, '')}${a.url}?token=${encodeURIComponent(cfg.value.token)}`;
}

function onReact(messageId: string, emoji: string): void {
  void reactMessenger(cfg.value.daemonUrl, cfg.value.token, messageId, emoji)
    .catch(e => { err.value = (e as Error).message; });
}

const recording = ref(false);
const recordSecs = ref(0);
let recorder: MediaRecorder | null = null;
let recordChunks: Blob[] = [];
let recordTimer: ReturnType<typeof setInterval> | null = null;

async function pickAndUpload(input: HTMLInputElement | null): Promise<void> {
  attachMenuOpen.value = false;
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
  <div class="flex flex-col min-h-screen pb-[140px]">
    <div
      v-if="tail.status.value !== 'open' && tail.status.value !== 'idle'"
      class="fixed top-2 left-1/2 -translate-x-1/2 z-20 px-2.5 py-1 rounded-full
        flex items-center gap-1.5 text-[11px]
        bg-metro-surface-light dark:bg-metro-surface-dark
        text-metro-sub-light dark:text-metro-sub-dark
        border border-metro-border-light dark:border-metro-border-dark"
    >
      <span class="w-1.5 h-1.5 rounded-full"
        :class="tail.status.value === 'connecting' ? 'bg-metro-warn' : 'bg-metro-err'"></span>
      <span>{{ tail.status.value === 'connecting' ? 'Connecting…' : tail.status.value === 'error' ? 'Reconnecting…' : 'Offline' }}</span>
    </div>
    <div class="flex-1 px-3 pt-3 flex flex-col gap-1.5">
      <MessengerBubble
        v-for="e in bubbles"
        :key="e.id"
        :entry="e"
        :daemonUrl="cfg.daemonUrl"
        :token="cfg.token"
        :reactions="reactions.get(e.id)"
        @react="(emoji) => onReact(e.id, emoji)"
      />
      <div v-if="bubbles.length === 0" class="p-8 text-center text-metro-sub-light dark:text-metro-sub-dark">
        Type a message below to start chatting.
      </div>
    </div>
    <div v-if="err" class="px-4 pt-2 text-xs text-metro-err fixed bottom-[150px] left-0 right-0">send failed: {{ err }}</div>
    <input ref="imageInput" type="file" accept="image/*" class="hidden" @change="pickAndUpload(imageInput)" />
    <input ref="fileInput" type="file" class="hidden" @change="pickAndUpload(fileInput)" />
    <div class="fixed bottom-[60px] left-0 right-0 z-10 px-3 pb-3 pt-1.5">
      <div v-if="pending.length" class="flex flex-wrap gap-1.5 pb-1.5">
        <div v-for="(a, i) in pending" :key="a.id"
          class="flex items-center gap-1.5 rounded-xl text-xs
            bg-metro-hover-light dark:bg-metro-hover-dark text-metro-fg-light dark:text-metro-fg-dark"
          :class="a.kind === 'image' ? 'pl-1 pr-2 py-1' : 'px-2 py-1'">
          <img v-if="a.kind === 'image'" :src="chipImageUrl(a)" class="w-7 h-7 rounded object-cover" />
          <HeroIcon v-else :name="a.kind === 'audio' ? 'microphone' : 'paperClip'" :size="14" />
          <span class="max-w-[140px] truncate">{{ a.name ?? a.id }}</span>
          <button class="opacity-60 hover:opacity-100" @click="pending = pending.filter((_, j) => j !== i)">
            <HeroIcon name="x" :size="14" />
          </button>
        </div>
      </div>
      <div v-if="attachMenuOpen" class="flex gap-2 pb-1.5">
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-2 rounded-full
            bg-metro-hover-light dark:bg-metro-hover-dark text-metro-fg-light dark:text-metro-fg-dark"
          @click="imageInput?.click()">
          <HeroIcon name="photo" :size="16" />
          <span class="text-sm">Image</span>
        </button>
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-2 rounded-full
            bg-metro-hover-light dark:bg-metro-hover-dark text-metro-fg-light dark:text-metro-fg-dark"
          @click="fileInput?.click()">
          <HeroIcon name="paperClip" :size="16" />
          <span class="text-sm">File</span>
        </button>
      </div>
      <div v-if="recording" class="text-xs text-metro-err pb-1 flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-metro-err animate-pulse"></span>
        Recording… {{ recordSecs }}s
      </div>
      <div class="rounded-xl bg-metro-surface-light dark:bg-metro-surface-dark p-2.5">
        <textarea
          v-model="text"
          placeholder="Message the assistant…"
          rows="1"
          class="w-full resize-none min-h-[24px] max-h-[140px] bg-transparent
            text-metro-fg-light dark:text-metro-fg-dark text-[15px] outline-none
            placeholder:text-metro-sub-light dark:placeholder:text-metro-sub-dark px-1 py-0.5"
          @keydown.enter.exact.prevent="send"
        />
        <div class="flex items-center gap-1 mt-1.5">
          <button type="button" title="Attach"
            class="w-9 h-9 rounded-full hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark
              flex items-center justify-center text-metro-fg-light dark:text-metro-fg-dark"
            @click="attachMenuOpen = !attachMenuOpen">
            <HeroIcon :name="attachMenuOpen ? 'x' : 'plus'" :size="20" />
          </button>
          <div class="flex-1"></div>
          <button type="button" :title="recording ? 'Stop' : 'Record'"
            class="w-9 h-9 rounded-full flex items-center justify-center"
            :class="recording
              ? 'bg-metro-err text-white'
              : 'hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark text-metro-fg-light dark:text-metro-fg-dark'"
            @click="recording ? stopRecording() : startRecording()">
            <HeroIcon :name="recording ? 'stop' : 'microphone'" :size="20" />
          </button>
          <button type="button"
            :disabled="sending || (!text.trim() && pending.length === 0)"
            class="w-9 h-9 rounded-full bg-metro-accent hover:bg-metro-accent-hover text-black
              disabled:opacity-45 flex items-center justify-center"
            @click="send">
            <span v-if="sending">…</span>
            <HeroIcon v-else name="send" :size="18" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
