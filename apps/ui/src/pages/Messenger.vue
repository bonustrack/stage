<script setup lang="ts">
/** Messenger — direct chat with the assistant. Mirrors the mobile composer (floating, 2-line, heroicons). */

import type { Config } from '../lib/config';
import type { HistoryEntry } from '../lib/types';
import {
  isReaction, isTranscript, reactMessenger, reactionsByMessage, sendMessenger,
  transcriptsByMessage, uploadAttachment, type Attachment,
} from '../lib/messenger';
import { useRecorder } from '../lib/useRecorder';

const MESSENGER_LINE = 'metro://messenger/owner';
const MESSENGER_USER = 'metro://messenger/user/owner';

const cfg = ref<Config>(loadConfig());
const chat = ref<string | undefined>(MESSENGER_LINE);
const text = ref('');
const sending = ref(false);
const err = ref<string | null>(null);
const pending = ref<Attachment[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const imageInput = ref<HTMLInputElement | null>(null);
const attachMenuOpen = ref(false);
const replyingTo = ref<{ id: string; preview: string } | null>(null);

function previewOf(e: { text?: string; payload?: unknown }): string {
  if (e.text) return e.text.slice(0, 80);
  const p = e.payload as { attachments?: { kind: string }[] } | undefined;
  return `[${p?.attachments?.[0]?.kind ?? 'attachment'}]`;
}

const tail = useTail(cfg, chat);
/** Optimistic outbound entries — rendered immediately on send, dedupe by text + freshness when
 *  the real SSE event lands. */
const optimistic = ref<HistoryEntry[]>([]);
const liveBubbles = computed(() =>
  [...tail.events.value].reverse().filter(e => !isReaction(e) && !isTranscript(e)));
watch(liveBubbles, current => {
  if (!optimistic.value.length) return;
  optimistic.value = optimistic.value.filter(o =>
    !current.some(e => e.from === MESSENGER_USER && e.text === o.text
      && Math.abs(new Date(e.ts).getTime() - new Date(o.ts).getTime()) < 30_000));
});
/** Optimistic entries are stored newest-first; live bubbles already are. */
const bubbles = computed(() => [...optimistic.value, ...liveBubbles.value]);
const reactions = computed(() => reactionsByMessage(tail.events.value));
const transcripts = computed(() => transcriptsByMessage(tail.events.value));

function chipImageUrl(a: Attachment): string {
  return `${cfg.value.daemonUrl.replace(/\/$/, '')}${a.url}?token=${encodeURIComponent(cfg.value.token)}`;
}

function onReact(messageId: string, emoji: string): void {
  void reactMessenger(cfg.value.daemonUrl, cfg.value.token, messageId, emoji)
    .catch(e => { err.value = (e as Error).message; });
}

async function uploadFile(file: File): Promise<void> {
  try {
    const att = await uploadAttachment(cfg.value.daemonUrl, cfg.value.token, file, file.name);
    pending.value = [...pending.value, att];
  } catch (e) { err.value = (e as Error).message; }
}
async function pickAndUpload(input: HTMLInputElement | null): Promise<void> {
  attachMenuOpen.value = false;
  const file = input?.files?.[0];
  if (file) await uploadFile(file);
  if (input) input.value = '';
}
function onDrop(ev: DragEvent): void {
  ev.preventDefault();
  for (const f of ev.dataTransfer?.files ?? []) void uploadFile(f);
}
function onPaste(ev: ClipboardEvent): void {
  for (const item of ev.clipboardData?.items ?? []) {
    if (item.kind === 'file') { const f = item.getAsFile(); if (f) void uploadFile(f); }
  }
}

const { recording, recordSecs, start: startRecording, stop: stopRecording } = useRecorder(
  blob => void uploadFile(new File([blob], `voice-${Date.now()}.webm`, { type: blob.type })),
  msg => { err.value = msg; },
);

async function send(): Promise<void> {
  const body = text.value.trim();
  if (!body && pending.value.length === 0) return;
  /** Build the optimistic entry first → bubble appears at 50% opacity instantly. */
  const localId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const ts = new Date().toISOString();
  const replyTo = replyingTo.value?.id;
  const atts = pending.value;
  optimistic.value = [{
    id: localId, ts,
    station: 'messenger', line: MESSENGER_LINE,
    from: MESSENGER_USER, to: MESSENGER_LINE,
    text: body || undefined,
    ...(replyTo ? { replyTo } : {}),
    ...(atts.length ? { payload: { attachments: atts } } : {}),
  } as HistoryEntry, ...optimistic.value];
  /** Clear the composer immediately — the bubble carries the user'​s input now. */
  const sentBody = body; const sentAtts = atts;
  text.value = ''; pending.value = []; replyingTo.value = null;
  sending.value = true; err.value = null;
  try {
    await sendMessenger(cfg.value.daemonUrl, cfg.value.token, sentBody, sentAtts, replyTo);
  } catch (e) { err.value = (e as Error).message; }
  finally { sending.value = false; }
}

onMounted(() => { cfg.value = loadConfig(); tail.reconnect(); });
onBeforeUnmount(() => { tail.stop(); stopRecording(); });
</script>

<template>
  <div class="flex flex-col min-h-screen pb-[140px]"
    @dragover.prevent
    @drop="onDrop"
    @paste="onPaste">
    <div v-if="tail.status.value !== 'open' && tail.status.value !== 'idle'"
      class="fixed top-2 left-1/2 -translate-x-1/2 z-20 px-2.5 py-1 rounded-full flex items-center gap-1.5 text-[11px]
        bg-metro-surface-light dark:bg-metro-surface-dark text-metro-sub-light dark:text-metro-sub-dark
        border border-metro-border-light dark:border-metro-border-dark">
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
        :pending="e.id.startsWith('tmp_')"
        :replyTarget="replyingTo?.id === e.id"
        :reactions="reactions.get(e.id)"
        :transcript="transcripts.get(e.id)"
        :replyPreview="e.replyTo ? previewOf(tail.events.value.find(x => x.id === e.replyTo) ?? e) : undefined"
        @react="(emoji) => onReact(e.id, emoji)"
        @reply="replyingTo = { id: e.id, preview: previewOf(e) }"
      />
      <div v-if="bubbles.length === 0" class="p-8 text-center text-metro-sub-light dark:text-metro-sub-dark">
        Type a message below to start chatting.
      </div>
    </div>
    <div v-if="err" class="px-4 pt-2 text-xs text-metro-err fixed bottom-[150px] left-0 right-0">send failed: {{ err }}</div>
    <input ref="imageInput" type="file" accept="image/*" class="hidden" @change="pickAndUpload(imageInput)" />
    <input ref="fileInput" type="file" class="hidden" @change="pickAndUpload(fileInput)" />
    <div class="fixed bottom-[60px] left-0 right-0 z-10 px-3 pb-3 pt-1.5">
      <div v-if="replyingTo" class="flex items-center gap-2 pb-1.5">
        <div class="flex-1 border-l-2 border-metro-sub-light dark:border-metro-sub-dark pl-2">
          <div class="text-[10px] text-metro-sub-light dark:text-metro-sub-dark">Replying to</div>
          <div class="text-xs truncate text-metro-fg-light dark:text-metro-fg-dark">{{ replyingTo.preview }}</div>
        </div>
        <button type="button" class="text-metro-sub-light dark:text-metro-sub-dark"
          @click="replyingTo = null"><HeroIcon name="x" :size="14" /></button>
      </div>
      <div v-if="pending.length" class="flex flex-wrap gap-2 pb-1.5">
        <template v-for="(a, i) in pending" :key="a.id">
          <!-- Image attachment: 72×72 thumbnail with filename underneath + x in the top-right -->
          <div v-if="a.kind === 'image'" class="w-[72px] flex flex-col items-center gap-1">
            <div class="relative">
              <img :src="chipImageUrl(a)" class="w-[72px] h-[72px] rounded-lg object-cover" />
              <button
                class="absolute -top-1 -right-1 bg-black rounded-full p-0.5 text-white"
                @click="pending = pending.filter((_, j) => j !== i)"
              ><HeroIcon name="x" :size="12" /></button>
            </div>
            <span class="text-[11px] w-[72px] text-center truncate text-metro-fg-light dark:text-metro-fg-dark">{{ a.name ?? a.id }}</span>
          </div>
          <!-- Non-image: inline chip -->
          <div v-else
            class="flex items-center gap-1.5 rounded-xl text-xs px-2 py-1
              bg-metro-hover-light dark:bg-metro-hover-dark text-metro-fg-light dark:text-metro-fg-dark"
          >
            <HeroIcon :name="a.kind === 'audio' ? 'microphone' : 'paperClip'" :size="14" />
            <span class="max-w-[140px] truncate">{{ a.name ?? a.id }}</span>
            <button class="opacity-60 hover:opacity-100" @click="pending = pending.filter((_, j) => j !== i)">
              <HeroIcon name="x" :size="14" />
            </button>
          </div>
        </template>
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
