<script setup lang="ts">

import { computed } from 'vue';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import { fontFamily } from '@stage-labs/kit/tokens';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type { WidgetActionRegistry, WidgetRoot } from '@stage-labs/kit/kit';
import { xmtpSendText, xmtpReply, xmtpSendPoll } from '../lib/xmtpSend';
import { pollFallbackText } from '@stage-labs/client/xmtp/poll';
import { useRequestCompose, type PaymentPayload, type SignPayload } from '../lib/useRequestCompose';
import { useComposerAttach } from '../lib/useComposerAttach';
import { useComposerMentions } from '../lib/useComposerMentions';
import { useVoiceRecorder } from '../lib/useVoiceRecorder';
import { stampAvatarUrl } from '../lib/xmtp';
import { shortAddress } from '@stage-labs/client/identity/format';
import { type MentionCandidate } from '@stage-labs/client/xmtp/mentions';

const palette = useKitPalette();
const composerFont = fontFamily.sans.join(', ');

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
const pollOpen = ref(false);
const paymentOpen = ref(false);
const signOpen = ref(false);
const imageNonce = ref(0);
const cameraNonce = ref(0);
const fileNonce = ref(0);
const selStart = ref(0);
const selection = ref<{ start: number; end: number }>({ start: 0, end: 0 });
const focusNonce = ref(0);
const { pending, clear: clearPending, onPaste, stageFile, flush: flushPending } =
  useComposerAttach(() => props.line, m => { err.value = m; });

const filePickerNode = computed<WidgetRoot>(() => ({
  type: 'Basic',
  children: [
    { type: 'FilePicker', openNonce: imageNonce.value, accept: 'image/*', onPickAction: { type: 'attach_file', handler: 'client' } },
    { type: 'FilePicker', openNonce: cameraNonce.value, accept: 'image/*', capture: 'environment', onPickAction: { type: 'attach_file', handler: 'client' } },
    { type: 'FilePicker', openNonce: fileNonce.value, onPickAction: { type: 'attach_file', handler: 'client' } },
  ],
}));

const filePickerRegistry: WidgetActionRegistry = {
  attach_file: (a) => {
    const files = a.payload.files;
    const file = Array.isArray(files) ? (files[0] as File | undefined) : undefined;
    if (file) stageFile(file);
  },
};
const {
  recording, seconds: recordSecs, levels: recordLevels,
  start: startRecording, stopAndSend: stopRecording, cancel: cancelRecording,
} = useVoiceRecorder(() => props.line, m => { err.value = m; });

const {
  matches: mentionMatches, range: mentionRange, active: mentionActive,
  refresh: refreshMentions, pick: pickMention, onKeydown: onMentionKeydown,
  isOpen: mentionsOpen, close: closeMentions,
} = useComposerMentions(
  () => text.value,
  () => selStart.value,
  () => props.mentionCandidates,
  next => { text.value = next; },
  cursor => { selection.value = { start: cursor, end: cursor }; focusNonce.value += 1; },
  () => { refreshMentions(); },
);

function onInput(value: string): void {
  text.value = value;
  refreshMentions();
}

function onSelection(range: { start: number; end: number }): void {
  selStart.value = range.start;
  refreshMentions();
}

function onComposerKeydown(ev: KeyboardEvent): void {
  const open = mentionsOpen();
  if (open && onMentionKeydown(ev)) return;
  if (!open && ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); void send(); }
}

function toggleAttach(): void { attachOpen.value = !attachOpen.value; }

function pickImage(): void {
  attachOpen.value = false;
  imageNonce.value += 1;
}

function pickCamera(): void {
  attachOpen.value = false;
  cameraNonce.value += 1;
}

function pickFile(): void {
  attachOpen.value = false;
  fileNonce.value += 1;
}

function openPoll(): void {
  attachOpen.value = false;
  pollOpen.value = true;
}

function recordVoice(): void {
  attachOpen.value = false;
  void startRecording();
}

const attachTiles = [
  { icon: 'photo', label: 'Image', action: pickImage },
  { icon: 'camera', label: 'Camera', action: pickCamera },
  { icon: 'paperClip', label: 'File', action: pickFile },
  { icon: 'microphone', label: 'Voice', action: recordVoice },
  { icon: 'chartBar', label: 'Poll', action: openPoll },
  { icon: 'mapPin', label: 'Location', action: () => { void shareLocation(); } },
  { icon: 'wallet', label: 'Payment', action: () => { attachOpen.value = false; paymentOpen.value = true; } },
  { icon: 'pencil', label: 'Sign', action: () => { attachOpen.value = false; signOpen.value = true; } },
] as const;

async function createPoll(payload: { question: string; options: string[]; multiSelect: boolean }): Promise<void> {
  pollOpen.value = false;
  err.value = null;
  const localId = `tmp_${Math.random().toString(36).slice(2, 10)}`;
  emit('optimistic', {
    localId,
    text: pollFallbackText({ pollId: localId, question: payload.question, options: payload.options.map(label => ({ label })) }),
  });
  try {
    await xmtpSendPoll(props.line, payload.question, payload.options, { multiSelect: payload.multiSelect });
    emit('sent', localId);
  } catch (e) {
    err.value = (e as Error).message;
  }
}

const { sendPayment, sendSignRequest } = useRequestCompose(
  () => props.line,
  (localId, t) => { emit('optimistic', { localId, text: t }); },
  localId => { emit('sent', localId); },
  m => { err.value = m; },
);

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
    <KitRenderer :node="filePickerNode" :registry="filePickerRegistry" />
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
    <!-- Voice recording bar replaces the composer input while a MediaRecorder
         capture is in progress: pulsing dot, live level waveform, elapsed
         duration, cancel and send, mirroring the mobile press-to-record voice
         UX. On send the recorder encodes the blob to an audio/* static
         attachment, matching the mobile wire format. -->
    <VoiceRecordBar
      v-if="recording"
      :seconds="recordSecs"
      :levels="recordLevels"
      @send="stopRecording"
      @cancel="cancelRecording"
    />
    <Col v-else surface="raised" :padding="10">
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
      <!-- Composer input renders via the kit TextField (variant plain: transparent
           bg, no border) so the box/font/padding come from Kit. Keydown (mention
           nav + Enter-to-send), focusout (close mentions) and paste are captured on
           this wrapper since TextField exposes no keydown/blur/paste; selection +
           value flow through the kit selection-change / update:value events. -->
      <Col @keydown.capture="onComposerKeydown" @focusout="closeMentions" @paste="onPaste">
        <TextField
          :value="text"
          placeholder="Message"
          variant="plain"
          multiline
          auto-grow
          auto-capitalize="sentences"
          :selection="selection"
          :focus-nonce="focusNonce"
          :font-size="17"
          :font-family="composerFont"
          :padding-x="8"
          :padding-top="4"
          :padding-bottom="8"
          :line-height="23"
          :min-height="24"
          :max-height="210"
          @update:value="onInput"
          @selection-change="onSelection"
        />
      </Col>
      <Row class="flex items-center gap-1">
        <Pressable
          tag="button"
          type="button"
          class="w-[38px] h-[38px] shrink-0 rounded-full flex items-center justify-center
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
         in a horizontal scroll row; mirror that. Shows the actions web can fulfil:
         Image, Camera, File, Poll, Location, Payment, Sign. Poll/Payment/Sign open
         their compose sheets and send via the shared codecs, interoperating with
         mobile; Payment builds a walletSendCalls request, Sign a signatureRequest. -->
    <Row v-if="attachOpen" class="flex gap-4 px-3 pt-3 pb-3 overflow-x-auto no-scrollbar">
      <Col
        v-for="tile in attachTiles"
        :key="tile.label"
        class="flex flex-col items-center gap-1.5 shrink-0"
      >
        <Pressable
          tag="button"
          type="button"
          class="w-14 h-14 rounded-[28px] flex items-center justify-center
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
    <PollComposeSheet
      v-if="pollOpen"
      @close="pollOpen = false"
      @create="createPoll"
    />
    <PaymentComposeSheet
      v-if="paymentOpen"
      @close="paymentOpen = false"
      @create="(p: PaymentPayload) => { paymentOpen = false; err = null; void sendPayment(p); }"
    />
    <SignRequestComposeSheet
      v-if="signOpen"
      @close="signOpen = false"
      @create="(p: SignPayload) => { signOpen = false; err = null; void sendSignRequest(p); }"
    />
  </Col>
</template>
