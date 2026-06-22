<script setup lang="ts">

import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import { xmtpSendText, xmtpReply } from '../lib/xmtpSend';
import { useComposerAttach } from '../lib/useComposerAttach';
import { stampAvatarUrl } from '../lib/xmtp';
import { shortAddress } from '@stage-labs/client/identity/format';
import { computeMentionQuery, applyMention, type MentionCandidate } from '@stage-labs/client/xmtp/mentions';

const palette = useKitPalette();

const props = defineProps<{
  line: string;
  mentionCandidates?: MentionCandidate[];
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
const imageInput = ref<HTMLInputElement | null>(null);
const cameraInput = ref<HTMLInputElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const textarea = ref<HTMLTextAreaElement | null>(null);
const { pending, clear: clearPending, onPaste, onFileChange, flush: flushPending } =
  useComposerAttach(() => props.line, m => { err.value = m; });

const mentionMatches = ref<MentionCandidate[]>([]);
const mentionRange = ref<{ start: number; end: number } | null>(null);
const mentionActive = ref(0);

function refreshMentions(): void {
  const el = textarea.value;
  if (!el) { mentionRange.value = null; return; }
  const { matches, range } = computeMentionQuery(el.value, el.selectionStart, props.mentionCandidates);
  mentionMatches.value = matches;
  mentionRange.value = matches.length > 0 ? range : null;
  if (mentionActive.value >= matches.length) mentionActive.value = 0;
}

function pickMention(c: MentionCandidate): void {
  const range = mentionRange.value;
  const el = textarea.value;
  if (!range || !el) return;
  const { next, cursor } = applyMention(el.value, range, c.address);
  text.value = next;
  mentionRange.value = null;
  void nextTick(() => {
    const el = textarea.value;
    if (el) { el.focus(); el.setSelectionRange(cursor, cursor); }
    autoGrow();
  });
}

function moveMentionActive(delta: number): void {
  const n = mentionMatches.value.length;
  mentionActive.value = (mentionActive.value + delta + n) % n;
}

function onMentionKeydown(ev: KeyboardEvent): boolean {
  if (ev.key === 'ArrowDown') { ev.preventDefault(); moveMentionActive(1); return true; }
  if (ev.key === 'ArrowUp') { ev.preventDefault(); moveMentionActive(-1); return true; }
  if (ev.key === 'Enter' || ev.key === 'Tab') {
    ev.preventDefault();
    const pick = mentionMatches.value[mentionActive.value];
    if (pick) pickMention(pick);
    return true;
  }
  if (ev.key === 'Escape') { ev.preventDefault(); mentionRange.value = null; return true; }
  return false;
}

function onComposerKeydown(ev: KeyboardEvent): void {
  const open = mentionRange.value !== null && mentionMatches.value.length > 0;
  if (open && onMentionKeydown(ev)) return;
  if (!open && ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); void send(); }
}

function toggleAttach(): void { attachOpen.value = !attachOpen.value; }

function pickImage(): void {
  attachOpen.value = false;
  imageInput.value?.click();
}

function pickCamera(): void {
  attachOpen.value = false;
  cameraInput.value?.click();
}

function pickFile(): void {
  attachOpen.value = false;
  fileInput.value?.click();
}

const attachTiles = [
  { icon: 'photo', label: 'Image', action: pickImage },
  { icon: 'camera', label: 'Camera', action: pickCamera },
  { icon: 'paperClip', label: 'File', action: pickFile },
  { icon: 'mapPin', label: 'Location', action: () => { void shareLocation(); } },
] as const;

function autoGrow(): void {
  const el = textarea.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 210)}px`;
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
      void nextTick(autoGrow);
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
  <Col class="bg-metro-bg-light dark:bg-metro-bg-dark">
    <Col v-if="err" class="px-4 pt-2 text-xs text-metro-err">send failed: {{ err }}</Col>
    <Row v-if="props.replyingTo"
      class="flex items-center gap-2 px-4 pt-2 text-xs text-metro-sub-light dark:text-metro-sub-dark">
      <Icon name="reply" :size="14" />
      <span class="flex-1 truncate">Replying to: {{ props.replyingTo.preview }}</span>
      <Pressable tag="button" type="button" class="opacity-70 hover:opacity-100" @click="emit('clear-reply')">
        <Icon name="x" :size="14" />
      </Pressable>
    </Row>
    <!-- kit-exception: no kit equivalent (native file inputs — kit Input has no 'file'
         inputType; rendered via dynamic tag to keep bare <input> semantics). Three
         hidden inputs back the attach tiles: Image (gallery), Camera (capture), File
         (any type), mirroring mobile pickImage/takePhoto/pickFile. -->
    <component :is="'input'" ref="imageInput" type="file" accept="image/*" class="hidden" @change="onFileChange" />
    <component :is="'input'" ref="cameraInput" type="file" accept="image/*" capture="environment" class="hidden" @change="onFileChange" />
    <component :is="'input'" ref="fileInput" type="file" class="hidden" @change="onFileChange" />
    <!-- Full-bleed flat composer bar: textarea on top, [+ / spacer / send] row
         below. Edge-to-edge surface=raised with uniform padding 10, mirroring
         MessengerComposer.tsx ComposerEditor (Col padding={10} surface="raised"). -->
    <!-- @mention autocomplete: opens above the composer when the caret sits in an
         "@query" token and matches group members. Mirrors mobile MentionPopup
         (MessengerComposer.parts.tsx) — avatar + semibold name + short address rows.
         Group-only: mentionCandidates is empty for DMs. -->
    <Col v-if="mentionRange && mentionMatches.length > 0"
      surface="raised"
      class="mx-1.5 mb-2 rounded-lg overflow-hidden
        border border-metro-border-light dark:border-metro-border-dark">
      <Pressable
        tag="button"
        v-for="(c, i) in mentionMatches"
        :key="c.address"
        type="button"
        class="flex flex-row items-center gap-2.5 px-3 py-2 text-left
          border-metro-border-light dark:border-metro-border-dark"
        :class="[
          i === 0 ? '' : 'border-t',
          i === mentionActive ? 'bg-metro-hover-light dark:bg-metro-hover-dark' : '',
        ]"
        @mousedown.prevent="pickMention(c)"
        @mouseenter="mentionActive = i"
      >
        <img :src="stampAvatarUrl(c.address, 48)" alt="" class="w-6 h-6 rounded-full bg-metro-border-dark shrink-0" />
        <span class="flex-1 min-w-0 truncate text-sm font-head
          text-metro-head-light dark:text-metro-head-dark">{{ c.name }}</span>
        <span class="text-xs text-metro-sub-light dark:text-metro-sub-dark shrink-0">{{ shortAddress(c.address) }}</span>
      </Pressable>
    </Col>
    <Col surface="raised" :padding="10">
      <!-- Pending pasted/selected attachment preview — image thumbnail for image
           types, a file chip otherwise. Removable, sent on Send. -->
      <Col v-if="pending" class="relative inline-block mb-2">
        <img
          v-if="pending.file.type.startsWith('image/')"
          :src="pending.url"
          alt=""
          class="max-h-32 rounded-lg"
        />
        <Row
          v-else
          class="flex items-center gap-2 px-3 py-2 rounded-lg
            border border-metro-border-light dark:border-metro-border-dark
            bg-metro-surface-light dark:bg-metro-surface-dark
            text-sm text-metro-fg-light dark:text-metro-fg-dark font-sans"
        >
          <Icon name="paperClip" :size="16" />
          <span class="truncate max-w-[200px]">{{ pending.file.name }}</span>
        </Row>
        <Pressable
          tag="button"
          type="button"
          class="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center"
          title="Remove"
          @click="clearPending"
        >
          <Icon name="x" :size="12" />
        </Pressable>
      </Col>
      <!-- kit-exception: no kit equivalent (auto-grow textarea — needs a direct DOM ref
           for scrollHeight measurement, and kit Textarea forces its own boxed inline
           style (bg/border/padding/font) that would override this transparent surface). -->
      <component
        :is="'textarea'"
        ref="textarea"
        v-model="text"
        placeholder="Message…"
        rows="1"
        class="w-full resize-none min-h-[24px] max-h-[210px] font-sans
          bg-transparent px-2 pt-1 pb-2 text-[17px] leading-[23px] outline-none
          text-metro-head-light dark:text-metro-head-dark
          placeholder:text-metro-sub-light dark:placeholder:text-metro-sub-dark"
        @input="autoGrow(); refreshMentions()"
        @keydown="onComposerKeydown"
        @keyup="refreshMentions"
        @click="refreshMentions"
        @blur="mentionRange = null"
        @paste="onPaste"
      />
      <Row class="flex items-center gap-1">
        <Pressable
          tag="button"
          type="button"
          class="w-10 h-10 shrink-0 rounded-full flex items-center justify-center
            text-metro-fg-light dark:text-metro-fg-dark
            hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
          :title="attachOpen ? 'Close attach menu' : 'Attach'"
          @click="toggleAttach"
        >
          <Icon :name="attachOpen ? 'x' : 'plus'" :size="20" />
        </Pressable>
        <Col class="flex-1" />
        <!-- Send: kit Button primary md pill, palette.primary bg / palette.bg fg,
             arrowSmUp icon size 20. Mirrors MessengerComposer ComposerRightAction. -->
        <Button
          variant="primary"
          size="md"
          pill
          :tint-bg="palette.primary"
          :tint-fg="palette.bg"
          :disabled="sending || (!text.trim() && !pending)"
          :title="sending ? 'Sending…' : 'Send'"
          @click="send"
        >
          <Icon name="arrowSmUp" :size="20" :color="palette.bg" />
        </Button>
      </Row>
    </Col>
    <!-- Attach menu drops BELOW the composer row when open, matching mobile.
         Mobile (MessengerComposer.editor AttachMenu) renders labeled square tiles
         in a horizontal scroll row; mirror that. Only the actions web can fulfil
         are shown: Image, Camera, File, Location. Mobile's Poll/Sign/Payment tiles
         are omitted — web has no create flow for those yet, so we don't ship dead
         tiles. -->
    <Row v-if="attachOpen" class="flex gap-4 px-3 pt-3 pb-3 overflow-x-auto no-scrollbar">
      <Col
        v-for="tile in attachTiles"
        :key="tile.label"
        class="flex flex-col items-center gap-1.5 shrink-0"
      >
        <Pressable
          tag="button"
          type="button"
          class="w-14 h-14 rounded-2xl flex items-center justify-center
            border border-metro-border-light dark:border-metro-border-dark
            bg-metro-surface-light dark:bg-metro-surface-dark
            text-metro-head-light dark:text-metro-head-dark
            hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
          :title="tile.label"
          @click="tile.action"
        >
          <Icon :name="tile.icon" :size="26" />
        </Pressable>
        <span class="text-xs font-head text-metro-head-light dark:text-metro-head-dark">
          {{ tile.label }}
        </span>
      </Col>
    </Row>
  </Col>
</template>
