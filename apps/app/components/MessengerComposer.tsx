/** Floating two-line composer (Claude-mobile-style): textarea on top, [+ / mic / send] below. */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Animated, Image, PanResponder, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { loadDrafts, getDraft, setDraft } from '../lib/drafts';
import { Audio } from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { ComposerGradient } from './ComposerGradient';
import { HeroIcon, type HeroIconName } from './HeroIcon';
import { Avatar } from './Avatar';
import { Box, Row, Col } from './layout';
import { fileUriToBase64, shortAddress, xmtpReply, xmtpSendAttachment, xmtpSendText, xmtpSendPoll } from '../lib/xmtp';
import { AppModal } from './AppModal';
import { type PollContent, mintPollId, pollFallbackText } from '@metro-labs/client/xmtp/poll';

/** Composer-local representation of a staged attachment. `url` is a `file://` URI in xmtp
 *  mode (the only mode the mobile composer supports now). `id` is a client-side dedupe key. */
interface Attachment {
  id: string; url: string; kind: string; mime: string; size: number; name?: string;
}

/** Map a file extension → MIME type for the formats the composer can stage. The
 *  voice recorder writes `.m4a` (AAC) and image pickers can hand back HEIC/PNG
 *  etc. with a missing `mimeType`, so we need a deterministic fallback. */
const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', bmp: 'image/bmp',
  m4a: 'audio/m4a', mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac',
  ogg: 'audio/ogg', caf: 'audio/x-caf', mp4: 'video/mp4', mov: 'video/quicktime',
  webm: 'video/webm', pdf: 'application/pdf',
};

/** Resolve a usable MIME for a staged file. Prefers the picker/recorder-supplied
 *  `mime`, but pickers frequently return `''`/`undefined` (HEIC screenshots,
 *  some Android gallery `content://` rows, the voice recorder on certain OS
 *  builds). An empty MIME breaks the `kind` bucket and the native
 *  `encryptAttachment`/IPFS upload at send time, so fall back to the file
 *  extension, then to a generic binary type. */
function mimeOf(mime: string | undefined | null, nameOrUri: string): string {
  if (mime && mime.includes('/')) return mime;
  const ext = nameOrUri.split('?')[0]?.split('#')[0]?.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MIME[ext] ?? 'application/octet-stream';
}

/** Inline (StaticAttachment) attachments are encrypted into the MLS message
 *  envelope, which libxmtp caps at ~1 MB. Guard below that with codec overhead
 *  headroom so the send fails fast with a clear, user-facing message instead of
 *  a cryptic native error (restores the pre-#118 inline size guard). The
 *  multi-remote / blob-store path (xmtpSendMultiRemoteAttachment) is the future
 *  home for larger files — currently disabled on the send side because the
 *  pineapple upload endpoint rejects ciphertext. */
const INLINE_ATTACHMENT_MAX_BYTES = 900 * 1024;


interface Props {
  dark: boolean;
  /** Target XMTP conversation line URI (`metro://xmtp/<convId>`). Required — the
   *  mobile composer only supports the XMTP transport now (the daemon-routed
   *  messenger pipeline was removed). */
  xmtpLine: string;
  /** Candidates surfaced in the `@`-mention popup — channel members for
   *  groups, or contact list for DMs. Parent owns the source-of-truth list;
   *  composer just filters/renders. Empty array disables the popup. */
  mentionCandidates?: { address: string; name: string; cacheBuster?: number }[];
  /** `nonce` (optional) changes on every reply action — even re-replying to the
   *  same message — so the composer re-focuses + re-opens the keyboard each time. */
  replyingTo?: { id: string; preview: string; nonce?: number };
  /** Bump to focus the composer + raise the keyboard WITHOUT setting a reply
   *  target (e.g. opening a DM from the floating pill). Each new value re-fires
   *  the focus effect. */
  autoFocusNonce?: number;
  onClearReply?: () => void;
  /** Tap on the "Replying to …" preview — parent scrolls the feed to the
   *  target message + flashes the highlight. No-op when omitted. */
  onReplyPreviewPress?: () => void;
  /** Optimistic-render hook: invoked the moment the user taps send, before the API call. */
  onOptimistic?: (entry: { localId: string; text: string; attachments: Attachment[]; replyTo?: string; payload?: unknown }) => void;
  /** Fired AFTER the send completes (success OR failure). Lets the parent drop the
   *  optimistic entry instead of waiting for an SSE/stream echo that may never arrive
   *  (XMTP `streamMessages` doesn't always replay self-sends — pending bubbles would stick). */
  onSent?: (localId: string, error?: string, sentId?: string) => void;
}

export function MessengerComposer({
  dark, xmtpLine, mentionCandidates, replyingTo, autoFocusNonce, onClearReply, onReplyPreviewPress, onOptimistic, onSent,
}: Props): React.ReactElement {
  const fg = dark ? '#9f9fa3' : '#57606a';
  const head = dark ? '#ffffff' : '#000000';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const inputBg = dark ? '#282a2d' : '#e4e4e5';
  const chipBg = dark ? '#282a2d' : '#e4e4e5';

  const [text, setText] = useState('');
  /** Cursor position in `text`, kept in sync via onSelectionChange so the
   *  mention detector knows where the user is typing. */
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [pending, setPending] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  /** Textarea content height — drives the scroll fades (only shown once the
   *  input grows tall enough to scroll, so short messages aren't faded). */
  const [textareaH, setTextareaH] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  /** Rolling mic levels (0..1) for the recording waveform — newest at the end. */
  const [levels, setLevels] = useState<number[]>([]);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  /** Poll-builder sheet state. `pollOpen` toggles the AppModal; the rest is the
   *  in-progress poll being authored. Options start as two empty rows (min 2). */
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollHeader, setPollHeader] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollMulti, setPollMulti] = useState(false);
  /** Recent device photos shown inline in the attach menu (Discord-style). */
  const [recentPhotos, setRecentPhotos] = useState<MediaLibrary.Asset[]>([]);
  /** Composer text input — focused programmatically when a reply target is
   *  set so the keyboard pops straight up (the user is clearly about to type). */
  const inputRef = useRef<TextInput>(null);
  const recRef = useRef<Audio.Recording | null>(null);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Mic press timestamp — distinguishes push-to-talk (hold ≥ threshold →
   *  release stops) from a tap (click to start, then tap ✓ to stop). */
  const micPressStart = useRef(0);
  /** Synchronous mirror of `recording` — the mic's onPressOut needs to know we're
   *  recording without waiting for the async state update, so push-to-talk release
   *  reliably stops. */
  const recordingRef = useRef(false);
  /** Slide-to-cancel: while a push-to-talk gesture is in flight, the user
   *  can drag the mic button leftwards past `SLIDE_CANCEL_THRESHOLD_PX`
   *  to cancel the recording on release (Discord/Telegram pattern). The
   *  Animated value drives both the mic translateX and the inline
   *  "← slide to cancel" hint fade. */
  const slideX = useRef(new Animated.Value(0)).current;
  /** Synchronous mirror of the latest drag dx, so onPanResponderRelease
   *  can decide between cancel vs stop without consulting the
   *  AnimatedValue (which doesn't expose a readable current value
   *  without going through `addListener`). */
  const slideXRef = useRef(0);
  /** Restore draft on mount + persist on change (debounced). Skip the persist
   *  on the very first restore so we don'​t clobber a fresher save. */
  /** Per-conversation draft: restore on mount, persist (debounced) on change,
   *  keyed by convId so each channel keeps its own unsent text and the channels
   *  list can flag rows that have a draft. */
  const convId = xmtpLine.replace('metro://xmtp/', '');
  const draftRestored = useRef(false);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    draftRestored.current = false;
    void loadDrafts().then(() => {
      const d = getDraft(convId);
      if (d) setText(d);
      draftRestored.current = true;
    });
  }, [convId]);
  useEffect(() => {
    if (!draftRestored.current) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => { setDraft(convId, text); }, 300);
    return () => { if (draftTimer.current) clearTimeout(draftTimer.current); };
  }, [text, convId]);

  /** When the user picks a message to reply to, focus the input + raise the
   *  keyboard immediately — they're about to type. Keyed on the reply `nonce`
   *  (bumped by the parent on EVERY reply action, incl. re-tapping the same
   *  message after a keyboard dismiss) so the focus re-fires each time rather
   *  than deduping on the message id. Falls back to the id for callers that
   *  don't pass a nonce. Works whether or not the keyboard was already open
   *  (`.focus()` is idempotent). Deferred a tick so the "Replying to" slab has
   *  mounted first. */
  const replyTargetId = replyingTo?.id;
  const replyNonce = replyingTo?.nonce;
  useEffect(() => {
    if (!replyTargetId) return;
    const t = setTimeout(() => {
      console.warn('[reply-focus]', { replyTargetId, replyNonce });
      inputRef.current?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [replyTargetId, replyNonce]);

  /** Focus + raise the keyboard on a reply-less autofocus signal (e.g. opening
   *  the DM from the floating pill). Deferred a tick so the input has mounted;
   *  re-fires on each new nonce. */
  useEffect(() => {
    if (!autoFocusNonce) return;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [autoFocusNonce]);

  const canSend = !sending && (text.trim().length > 0 || pending.length > 0);

  const upload = async (uri: string, mime: string, name?: string): Promise<void> => {
    setUploading(true);
    try {
      /** Stage the local file URI; it's encrypted in-message at send time (see
       *  `send`). The chip uses `url` as a render hint (`file://...` works with
       *  `Image` source on RN), and `id` is just a client-side dedupe key.
       *
       *  No size check at staging time — the inline ~1 MB cap is enforced at
       *  send time (see `send`), where we have the decoded byte length and can
       *  surface a clear error.
       *
       *  Always derive a concrete MIME: pickers/recorders sometimes hand back an
       *  empty or undefined `mimeType` (HEIC screenshots, some Android gallery
       *  rows, the voice recorder on certain OS builds). An empty MIME breaks
       *  both the `kind` bucket below AND the encrypt/upload step at send time,
       *  so fall back to the file extension and finally to a sane default. */
      const resolvedMime = mimeOf(mime, name ?? uri);
      const kind = resolvedMime.startsWith('image/') ? 'image'
        : resolvedMime.startsWith('audio/') ? 'audio'
          : resolvedMime.startsWith('video/') ? 'video' : 'file';
      /** Size is cosmetic now (chip metadata only — no cap), so read it
       *  best-effort. `fetch(file://).blob()` is flaky on some platforms and
       *  must never block staging: a throw here previously rejected the whole
       *  attachment, surfacing as an add-time error. Default to 0 on failure. */
      let size = 0;
      try { size = (await (await fetch(uri)).blob()).size; } catch { /* size is cosmetic */ }
      const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setPending(prev => [...prev, { id, url: uri, kind, mime: resolvedMime, size, name }]);
    } catch (e) { setErr((e as Error).message); }
    finally { setUploading(false); }
  };

  const pickImage = async (): Promise<void> => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', quality: 0.85, allowsMultipleSelection: true, selectionLimit: 10,
    });
    if (r.canceled || !r.assets?.length) return;
    for (const a of r.assets) {
      await upload(a.uri, a.mimeType ?? 'image/jpeg', a.fileName ?? undefined);
    }
  };

  /** Load recent device photos when the attach menu opens, so they show inline
   *  (Discord-style) without leaving the app. Permission is requested on first
   *  open. We always ask for the FULL `photo` access (`granularPermissions:
   *  ['photo']` is configured at the plugin layer in app.json) — accepting the
   *  partial / "selected photos" grant would dump us into Android's system
   *  picker and defeat the whole inline-strip feature. */
  useEffect(() => {
    if (!attachMenuOpen) return;
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        /** Request the full-photo permission explicitly via `granularPermissions`
         *  — without this Android 14+ defaults to the limited "user-selected"
         *  grant, which makes `getAssetsAsync` return only the picked subset. */
        const perm = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
        if (!perm.granted || cancelled) return;
        const res = await MediaLibrary.getAssetsAsync({
          first: 24, mediaType: 'photo', sortBy: [['creationTime', false]],
        });
        if (!cancelled) setRecentPhotos(res.assets);
      } catch { /* no gallery — the picker buttons below still work */ }
    })();
    return () => { cancelled = true; };
  }, [attachMenuOpen]);

  /** Tap a recent photo → stage it as a pending attachment.
   *
   *  We try `getAssetInfoAsync` first because it resolves a `file://` URI
   *  (more upload-friendly than `content://` on Android). But that call
   *  reads EXIF, which requires `ACCESS_MEDIA_LOCATION` — we deliberately
   *  configured the plugin with `isAccessMediaLocationEnabled: false` so
   *  users don't have to grant location for picture-sharing, so it throws.
   *  Catch that, fall back to `asset.uri` (RN's `fetch` handles `content://`
   *  on Android via the network module). */
  const pickRecent = async (asset: MediaLibrary.Asset): Promise<void> => {
    setAttachMenuOpen(false);
    let uri = asset.uri;
    try {
      const info = await MediaLibrary.getAssetInfoAsync(asset);
      uri = info.localUri ?? asset.uri;
    } catch { /* ACCESS_MEDIA_LOCATION missing — fall through with asset.uri */ }
    try { await upload(uri, 'image/jpeg', asset.filename); }
    catch (e) { setErr((e as Error).message); }
  };

  const pickFile = async (): Promise<void> => {
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (r.canceled) return;
    const a = r.assets[0];
    await upload(a.uri, a.mimeType ?? 'application/octet-stream', a.name);
  };

  /** Share current location as a Google Maps URL text message. Skipping the
   *  geo: scheme + bespoke attachment shape so any XMTP client that doesn't
   *  know about location attachments still gets a clickable link. */
  const pickLocation = async (): Promise<void> => {
    setErr(null);
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) { Alert.alert('Location permission denied'); return; }
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const url = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
      await xmtpSendText(xmtpLine, `📍 ${url}`);
    } catch (e) { setErr((e as Error).message); }
  };

  /** If a stop/cancel arrives while startRec is still preparing (recRef not set
   *  yet), we stash the intent here and honour it once start finishes. */
  const pendingStop = useRef<null | 'send' | 'cancel'>(null);

  const startRec = async (): Promise<void> => {
    if (recordingRef.current) return;
    setErr(null);
    recordingRef.current = true;
    pendingStop.current = null;
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) { recordingRef.current = false; Alert.alert('Mic permission denied'); return; }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync({ ...Audio.RecordingOptionsPresets.HIGH_QUALITY, isMeteringEnabled: true });
    /** Feed mic metering (dBFS, ~-55 silent → 0 loud) into the waveform. */
    rec.setProgressUpdateInterval(80);
    rec.setOnRecordingStatusUpdate((s) => {
      if (s.isRecording && typeof s.metering === 'number') {
        const level = Math.max(0.05, Math.min(1, (s.metering + 55) / 55));
        setLevels(prev => [...prev, level].slice(-40));
      }
    });
    setLevels([]);
    await rec.startAsync();
    recRef.current = rec;
    setRecording(true);
    setRecordSecs(0);
    recTimerRef.current = setInterval(() => { setRecordSecs(s => s + 1); }, 1000);
    /** A release/cancel that landed mid-prepare — honour it now that we're live. */
    if (pendingStop.current === 'cancel') void cancelRec();
    else if (pendingStop.current === 'send') void stopRec();
  };

  /** Stop without staging (the ✕ / slide-left cancel). */
  const cancelRec = async (): Promise<void> => {
    recordingRef.current = false;
    const rec = recRef.current;
    if (!rec) { pendingStop.current = 'cancel'; setRecording(false); return; }
    setRecording(false); recRef.current = null; pendingStop.current = null;
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    setLevels([]);
    try { await rec.stopAndUnloadAsync(); } catch { /* ignore */ }
  };

  /** Stop and stage the clip as a pending attachment in the composer (NOT auto-send). */
  const stopRec = async (): Promise<void> => {
    recordingRef.current = false;
    const rec = recRef.current;
    if (!rec) { pendingStop.current = 'send'; return; }
    setRecording(false); recRef.current = null; pendingStop.current = null;
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    setLevels([]);
    await rec.stopAndUnloadAsync();
    const uri = rec.getURI(); if (!uri) return;
    await upload(uri, 'audio/m4a', `voice-${Date.now()}.m4a`);
  };

  /** Build + send the in-progress poll, reusing the same optimistic flow as text:
   *  the optimistic entry carries `payload.poll` so the bubble renders the
   *  PollView instantly, and the real XMTP message id threads back via onSent so
   *  the dedup memo confirms it by id (else falls back to the fallback-text match). */
  const sendPoll = async (): Promise<void> => {
    const question = pollQuestion.trim();
    const options = pollOptions.map(o => o.trim()).filter(Boolean);
    if (!question || options.length < 2) {
      Alert.alert('Add a question and at least 2 options');
      return;
    }
    const poll: PollContent = {
      pollId: mintPollId(),
      question,
      ...(pollHeader.trim() ? { header: pollHeader.trim() } : {}),
      options: options.map(label => ({ label })),
      ...(pollMulti ? { multiSelect: true } : {}),
    };
    const localId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    onOptimistic?.({ localId, text: pollFallbackText(poll), attachments: [], payload: { contentType: 'poll', poll } });
    /** Reset + close the builder immediately — the bubble already shows the poll. */
    setPollOpen(false);
    setPollQuestion(''); setPollHeader(''); setPollOptions(['', '']); setPollMulti(false);
    let sendErr: string | undefined;
    let sentId: string | undefined;
    try { sentId = await xmtpSendPoll(xmtpLine, poll); }
    catch (e) { sendErr = (e as Error).message; setErr(sendErr); }
    finally { onSent?.(localId, sendErr, sentId); }
  };

  const send = async (): Promise<void> => {
    const body = text.trim();
    if (!body && pending.length === 0) return;
    /** Fire the optimistic-render hook first so the bubble shows up instantly while the
     *  API call is still in flight. The SSE event for the real message will dedupe by text. */
    const localId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    /** Snapshot the in-flight attachments + reply id so we can clear composer state
     *  before awaiting the network — `pending`/`replyingTo` could be set to new values
     *  by the time the send promise resolves. */
    const sendingAttachments = pending;
    const sendingReplyTo = replyingTo?.id;
    onOptimistic?.({ localId, text: body, attachments: sendingAttachments, replyTo: sendingReplyTo });
    /** Clear the composer immediately — the bubble already shows the user's input. */
    setText(''); setPending([]); onClearReply?.();
    setSending(true); setErr(null);
    let sendErr: string | undefined;
    /** Real XMTP message id of the bubble that represents this optimistic entry —
     *  the text body when there's text, else the first attachment. conv.send()
     *  returns it; we thread it to onSent so the parent confirms by exact id. */
    let sentId: string | undefined;
    try {
      /** Send the text body first (as a `reply` when there's a `replyingTo`,
       *  else plain text), then EACH staged attachment as its own INLINE
       *  StaticAttachment message — encrypted in-message via the XMTP
       *  AttachmentCodec, no external upload. This is the pre-#118 working
       *  behavior, restored because the multi-remote path uploads ciphertext to
       *  pineapple.fyi, which is image-only and 415s non-image bytes. Multiple
       *  files therefore land as multiple bubbles (acceptable). The multi-remote
       *  send helper (`xmtpSendMultiRemoteAttachment`) is left in place but
       *  unused, ready for a future blob-store follow-up; its receive/decode +
       *  ImageViewer render path is untouched so already-sent multi-remote
       *  messages still render. */
      if (body) {
        if (sendingReplyTo) sentId = await xmtpReply(xmtpLine, sendingReplyTo, body);
        else sentId = await xmtpSendText(xmtpLine, body);
      }
      for (const a of sendingAttachments) {
        const mimeType = mimeOf(a.mime, a.name ?? a.url);
        const filename = a.name ?? a.id;
        const dataB64 = await fileUriToBase64(a.url);
        /** Inline bytes ride the MLS envelope (~1 MB libxmtp cap). Compute the
         *  real decoded byte size from the base64 length (4 base64 chars → 3
         *  bytes, minus padding) and reject oversized files with a clear error
         *  rather than letting the native encoder fail opaquely. */
        const padding = dataB64.endsWith('==') ? 2 : dataB64.endsWith('=') ? 1 : 0;
        const byteLen = Math.floor((dataB64.length * 3) / 4) - padding;
        if (byteLen > INLINE_ATTACHMENT_MAX_BYTES) {
          throw new Error(
            `"${filename}" is too large to send (${(byteLen / (1024 * 1024)).toFixed(1)} MB). `
            + `Attachments must be under ${Math.round(INLINE_ATTACHMENT_MAX_BYTES / 1024)} KB.`,
          );
        }
        const attId = await xmtpSendAttachment(xmtpLine, filename, mimeType, dataB64);
        /** Attachment-only send (no text body) — the optimistic bubble carries the
         *  attachments, so its real-id twin is the first attachment message. */
        if (!sentId) sentId = attId;
      }
    } catch (e) { sendErr = (e as Error).message; setErr(sendErr); }
    finally {
      setSending(false);
      /** Always tell the parent the send finished (success or failure) so the optimistic
       *  bubble clears. XMTP self-sends don't always come back through streamMessages, so
       *  waiting for an echo stranded the bubble in pending state forever. */
      onSent?.(localId, sendErr, sentId);
    }
  };

  /** Slide-to-cancel threshold — distance the mic has to travel left before a
   *  release cancels the recording instead of stopping+staging it. */
  const SLIDE_CANCEL_THRESHOLD_PX = 80;
  /** PanResponder driving the push-to-talk + slide-to-cancel gesture on the
   *  mic button. Replaces the previous onPressIn/onPressOut Pressable so the
   *  same handler tracks horizontal drags during the hold. Defined once via
   *  useMemo — the closures read `recordingRef` + `slideXRef` so we don't
   *  re-bind every render. */
  const micPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      micPressStart.current = Date.now();
      slideXRef.current = 0;
      slideX.setValue(0);
      /** Tap mode: a press while recording stops it; otherwise it starts. */
      if (recordingRef.current) { void stopRec(); return; }
      void startRec();
    },
    onPanResponderMove: (_, g) => {
      /** Only track leftwards drag; rightwards is irrelevant. Clamp at
       *  -120 so the hint can't slide off-screen. */
      const dx = Math.max(-120, Math.min(0, g.dx));
      slideXRef.current = dx;
      slideX.setValue(dx);
    },
    onPanResponderRelease: () => {
      const dx = slideXRef.current;
      const held = Date.now() - micPressStart.current;
      Animated.spring(slideX, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 6 }).start();
      slideXRef.current = 0;
      if (!recordingRef.current) return;
      if (dx <= -SLIDE_CANCEL_THRESHOLD_PX) { void cancelRec(); return; }
      /** Held long enough → push-to-talk release stops + stages. Short
       *  press → leave running so the user can hit ✓ later (tap mode). */
      if (held >= 350) void stopRec();
    },
    onPanResponderTerminate: () => {
      Animated.spring(slideX, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 6 }).start();
      slideXRef.current = 0;
    },
    onPanResponderTerminationRequest: () => false,
  }), []);

  /** `@`-mention parser. Looks backwards from the cursor for the most recent
   *  `@` and grabs the token up to (but not including) any whitespace. Null
   *  when no active mention or when the candidate list is empty / disabled. */
  const mention = (() => {
    if (!mentionCandidates || mentionCandidates.length === 0) return null;
    const cursor = selection.start;
    const before = text.slice(0, cursor);
    /** Match `@<token>` (no whitespace in token) anchored at the end of
     *  `before`. The `@` must be at start-of-string or after whitespace
     *  so we don't trigger on email-like substrings. */
    const m = /(^|\s)@(\S*)$/.exec(before);
    if (!m) return null;
    const query = m[2] ?? '';
    /** Range to replace on selection — covers the `@` and the query token. */
    const start = cursor - query.length - 1;
    return { query: query.toLowerCase(), start, end: cursor };
  })();
  const mentionMatches = mention === null ? [] : mentionCandidates!
    .filter(c => {
      const q = mention.query;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q);
    })
    .slice(0, 6);
  const pickMention = (c: { address: string; name: string }): void => {
    if (!mention) return;
    /** Insert the bare address as `@<address> ` and advance the cursor to the end
     *  of the insertion. The lowercased address is the stable wire form (survives
     *  username changes); the bubble renderer resolves it to a tappable `@<name>`
     *  at render time. The trailing space ensures the just-inserted token isn't
     *  re-parsed as an active mention by `/(^|\s)@(\S*)$/` (the cursor lands after
     *  whitespace). */
    const insert = `@${c.address.toLowerCase()} `;
    const next = text.slice(0, mention.start) + insert + text.slice(mention.end);
    const nextCursor = mention.start + insert.length;
    setText(next);
    /** RN's TextInput selection prop is one-shot on Android — set it via
     *  state and let the controlled value reapply. */
    setSelection({ start: nextCursor, end: nextCursor });
  };

  const Btn = ({ icon, onPress, active }: { icon: HeroIconName; onPress: () => void; active?: boolean }): React.ReactElement => (
    <Pressable onPress={onPress} style={({ pressed }) => ({
      width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
      backgroundColor: active ? '#d96868' : (pressed ? chipBg : 'transparent'),
    })}>
      <HeroIcon name={icon} size={22} color={active ? '#ffffff' : fg} />
    </Pressable>
  );
  const kindIcon = (kind: string): HeroIconName => (
    kind === 'image' ? 'photo' : kind === 'audio' ? 'microphone' : 'paperClip'
  );
  const bg = dark ? '#0e0f10' : '#ffffff';
  return (
    <Col px={10} pt={0} pb={14} bg={bg}>
      {/** 24px fade sits directly above the composer (paddingTop is 0), so the
       *  messages fade straight into the composer over a uniform 24px ramp. */}
      {/** left/right -10 cancels this View's paddingHorizontal:10 so the fade
       *   bleeds to the screen edges instead of leaving un-faded side strips. */}
      <ComposerGradient bg={bg} direction="down" top={-24} height={24} left={-10} right={-10} />
      {replyingTo ? (
        <Row align="center" gap={8} px={14} pb={6}>
          {/** Tap the quoted slab → parent scrolls the feed to the target. The
           *   ✕ stays as its own Pressable so it stays clear-only. */}
          <Pressable
            onPress={onReplyPreviewPress}
            style={{ flex: 1, borderLeftWidth: 2, borderLeftColor: sub, paddingLeft: 8 }}
          >
            <Text style={{ color: sub, fontSize: 12 , fontFamily: 'Calibre-Medium'}}>Replying to</Text>
            <Text style={{ color: fg, fontSize: 14, marginTop: 3, fontFamily: 'Calibre-Medium'}} numberOfLines={1}>{replyingTo.preview}</Text>
          </Pressable>
          <Pressable onPress={onClearReply} hitSlop={6}><HeroIcon name="x" size={16} color={sub} /></Pressable>
        </Row>
      ) : null}
      {/** @-mention popup — Discord-style, stacked above the composer.
       *   Only renders when there's an active mention AND at least one match. */}
      {mention && mentionMatches.length > 0 ? (
        <Col mx={6} mb={8} radius={12} bg={dark ? '#1a1a1c' : '#ffffff'} style={{
          overflow: 'hidden',
          borderWidth: 1, borderColor: dark ? '#282a2d' : '#e4e4e5',
        }}>
          {mentionMatches.map((c, i) => (
            <Pressable
              key={c.address}
              onPress={() => pickMention(c)}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 10,
                paddingHorizontal: 12, paddingVertical: 8,
                backgroundColor: pressed ? (dark ? '#282a2d' : '#e4e4e5') : 'transparent',
                borderTopWidth: i === 0 ? 0 : 1, borderTopColor: dark ? '#282a2d' : '#e4e4e5',
              })}
            >
              <Avatar address={c.address} size="sm" cacheBuster={c.cacheBuster} />
              <Text style={{ color: head, fontSize: 15, fontFamily: 'Calibre-Semibold', flex: 1 }} numberOfLines={1}>
                {c.name}
              </Text>
              <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }} numberOfLines={1}>
                {shortAddress(c.address)}
              </Text>
            </Pressable>
          ))}
        </Col>
      ) : null}
      {pending.length > 0 ? (
        <Row wrap gap={8} px={6} pb={6}>
          {pending.map((a, i) => (
            a.kind === 'image' ? (
              /** Image attachments: 72px square with the filename label beneath, x-to-remove
               *  pinned to the top-right corner of the thumbnail. */
              <Col key={a.id} align="center" gap={4} style={{ width: 72 }}>
                <View>
                  <Image
                    /** `a.url` is a local file:// URI — works directly with RN `Image`. */
                    source={{ uri: a.url }}
                    style={{ width: 72, height: 72, borderRadius: 8 }}
                    resizeMode="cover"
                  />
                  <Pressable
                    onPress={() => setPending(prev => prev.filter((_, j) => j !== i))}
                    hitSlop={6}
                    style={{
                      position: 'absolute', top: -4, right: -4,
                      backgroundColor: '#000', borderRadius: 999, padding: 2,
                    }}
                  >
                    <HeroIcon name="x" size={12} color="#ffffff" />
                  </Pressable>
                </View>
                <Text style={{ color: fg, fontSize: 11, width: 72, textAlign: 'center' , fontFamily: 'Calibre-Medium'}} numberOfLines={1}>
                  {a.name ?? a.id}
                </Text>
              </Col>
            ) : (
              /** Non-image attachments keep the inline chip layout — files/audio don'​t benefit
               *  from a thumbnail and look fine as a row. */
              <Row key={a.id} align="center" gap={6} px={8} py={4} radius={12} bg={chipBg}>
                <HeroIcon name={kindIcon(a.kind)} size={14} color={fg} />
                <Text style={{ color: fg, fontSize: 12, maxWidth: 140 , fontFamily: 'Calibre-Medium'}} numberOfLines={1}>{a.name ?? a.id}</Text>
                <Pressable onPress={() => setPending(prev => prev.filter((_, j) => j !== i))} hitSlop={6}>
                  <HeroIcon name="x" size={14} color={sub} />
                </Pressable>
              </Row>
            )
          ))}
        </Row>
      ) : null}
      {uploading || err ? (
        <Text style={{ color: err ? '#d96868' : sub, fontSize: 12, paddingHorizontal: 14, paddingBottom: 4 }}>
          {err ?? 'Uploading…'}
        </Text>
      ) : null}
      <Col bg={inputBg} radius={10} p={10}>
        {/** Top slot: live waveform + timer while recording, else the textarea. The
         *   button row (incl. the mic) below stays mounted across both states, so a
         *   push-to-talk press→release gesture isn't interrupted by a UI swap. */}
        {recording ? (
          <Row align="center" px={4} style={{ height: 28 }}>
            {/** "← Slide to cancel" hint — fades in as the user drags the
             *   mic left, slides with the gesture. Opacity ramps from 0.4
             *   at rest to 1.0 at the cancel threshold. */}
            <Animated.View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              transform: [{ translateX: slideX }],
              opacity: slideX.interpolate({
                inputRange: [-SLIDE_CANCEL_THRESHOLD_PX, -16, 0],
                outputRange: [1, 0.7, 0.4],
                extrapolate: 'clamp',
              }),
            }}>
              <HeroIcon name="arrowLeft" size={14} color={sub} />
              <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>
                Slide to cancel
              </Text>
            </Animated.View>
            <Row flex={1} align="center" justify="end" style={{ height: 28, overflow: 'hidden' }}>
              {[...Array(Math.max(0, 40 - levels.length)).fill(0.05), ...levels].slice(-40).map((lvl, i) => (
                <View key={i} style={{ width: 3, marginHorizontal: 1, borderRadius: 2, height: Math.max(3, Math.round(lvl * 26)), backgroundColor: head, opacity: 0.85 }} />
              ))}
            </Row>
            <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium', minWidth: 40, textAlign: 'center' }}>
              {Math.floor(recordSecs / 60)}:{(recordSecs % 60).toString().padStart(2, '0')}
            </Text>
          </Row>
        ) : (
          <View style={{ position: 'relative' }}>
            <TextInput
              ref={inputRef}
              value={text} onChangeText={setText} placeholder="Ask Metro" placeholderTextColor={sub} multiline
              onContentSizeChange={(e) => setTextareaH(e.nativeEvent.contentSize.height)}
              selection={selection}
              onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
              style={{ color: head, fontFamily: 'Calibre-Medium', fontSize: 18, lineHeight: 23, minHeight: 24, maxHeight: 140, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 8, textAlignVertical: 'top' }}
            />
            {textareaH > 132 ? (
              <>
                <ComposerGradient bg={inputBg} direction="up" top={0} height={24} />
                <ComposerGradient bg={inputBg} direction="down" bottom={0} height={24} />
              </>
            ) : null}
          </View>
        )}
        <Row align="center" gap={4}>
          {/** Left: cancel (✕) while recording, else the attach (+) menu toggle. */}
          {recording
            ? <Btn icon="x" onPress={() => void cancelRec()} />
            : <Btn icon={attachMenuOpen ? 'x' : 'plus'} onPress={() => setAttachMenuOpen(o => !o)} />}
          <Box flex={1} />
          {/** Mic — both record flows, mounted across recording so the gesture survives:
           *   • tap to start → tap again (or the ✓) to stop+stage;
           *   • press-hold to record → release (held ≥350ms) to stop+stage.
           *   • slide-left past 80px during a hold → cancel on release.
           *   The clip lands as a PENDING attachment in the composer, not auto-sent. */}
          <Animated.View
            {...micPanResponder.panHandlers}
            style={{
              width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
              backgroundColor: recording ? '#e2622f' : 'transparent',
              transform: [{ translateX: slideX }],
            }}
          >
            <HeroIcon name="microphone" size={22} color={recording ? '#ffffff' : fg} />
          </Animated.View>
          {/** Right: ✓ confirm (stop+stage) while recording, else send. */}
          {recording ? (
            <Pressable onPress={() => void stopRec()}
              style={({ pressed }) => ({ backgroundColor: pressed ? '#cccccc' : (dark ? '#ffffff' : '#000000'), width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' })}>
              <HeroIcon name="check" size={20} color={dark ? '#000' : '#fff'} />
            </Pressable>
          ) : (
            <Pressable onPress={() => void send()} disabled={!canSend}
              style={({ pressed }) => ({
                backgroundColor: dark ? (pressed ? '#cccccc' : '#ffffff') : (pressed ? '#333333' : '#000000'),
                opacity: canSend ? 1 : 0.45,
                width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
              })}>
              <HeroIcon name="send" size={20} color={dark ? '#000' : '#fff'} />
            </Pressable>
          )}
        </Row>
      </Col>
      {/** Attach menu — boxes below the composer with icon + label per source.
       *   Tap the + button in the composer row to toggle. */}
      {attachMenuOpen ? (
        <Col pt={10} gap={10}>
          {/** Inline recent-photos strip (Discord-style) — tap to attach without
           *   leaving the app. Hidden until the gallery loads / permission granted. */}
          {recentPhotos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {recentPhotos.map(a => (
                <Pressable key={a.id} onPress={() => void pickRecent(a)}>
                  <Image source={{ uri: a.uri }} style={{ width: 76, height: 76, borderRadius: 10, backgroundColor: chipBg }} />
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        <Row gap={10}>
          {(
            [
              ['photo', 'Image', pickImage],
              ['paperClip', 'File', pickFile],
              ['mapPin', 'Location', pickLocation],
              ['chartBar', 'Poll', async () => setPollOpen(true)],
            ] as const
          ).map(([icon, label, action]) => (
            <Pressable
              key={label}
              onPress={() => { setAttachMenuOpen(false); void action(); }}
              style={({ pressed }) => ({
                flex: 1, alignItems: 'center', justifyContent: 'center',
                paddingVertical: 14, borderRadius: 12,
                backgroundColor: pressed ? chipBg : inputBg,
                borderWidth: 1, borderColor: chipBg,
              })}
            >
              <HeroIcon name={icon} size={22} color={fg} />
              <Text style={{ color: fg, fontSize: 13, marginTop: 6, fontFamily: 'Calibre-Medium' }}>{label}</Text>
            </Pressable>
          ))}
        </Row>
        </Col>
      ) : null}
      {/** Poll-builder sheet — question + optional header + dynamic option rows
       *   (min 2) + multi-select toggle. Submit mints a pollId and sends via the
       *   same optimistic flow as text. */}
      <AppModal visible={pollOpen} onClose={() => setPollOpen(false)} title="New poll">
        <Col gap={12} pb={8}>
          <TextInput
            value={pollQuestion}
            onChangeText={setPollQuestion}
            placeholder="Question"
            placeholderTextColor={sub}
            style={{ color: fg, backgroundColor: inputBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Calibre-Medium', fontSize: 16 }}
          />
          <TextInput
            value={pollHeader}
            onChangeText={setPollHeader}
            placeholder="Header (optional, e.g. LUNCH)"
            placeholderTextColor={sub}
            maxLength={12}
            autoCapitalize="characters"
            style={{ color: fg, backgroundColor: inputBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Calibre-Medium', fontSize: 14 }}
          />
          {pollOptions.map((opt, i) => (
            <Row key={i} align="center" gap={8}>
              <TextInput
                value={opt}
                onChangeText={t => setPollOptions(prev => prev.map((o, j) => (j === i ? t : o)))}
                placeholder={`Option ${i + 1}`}
                placeholderTextColor={sub}
                style={{ flex: 1, color: fg, backgroundColor: inputBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Calibre-Medium', fontSize: 16 }}
              />
              {pollOptions.length > 2 ? (
                <Pressable onPress={() => setPollOptions(prev => prev.filter((_, j) => j !== i))} hitSlop={8}>
                  <HeroIcon name="x" size={18} color={sub} />
                </Pressable>
              ) : null}
            </Row>
          ))}
          <Pressable
            onPress={() => setPollOptions(prev => [...prev, ''])}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingVertical: 8, paddingHorizontal: 4, opacity: pressed ? 0.6 : 1,
            })}
          >
            <HeroIcon name="plus" size={16} color={'#c0a06e'} />
            <Text style={{ color: '#c0a06e', fontSize: 14, fontFamily: 'Calibre-Semibold' }}>Add option</Text>
          </Pressable>
          <Pressable
            onPress={() => setPollMulti(m => !m)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}
          >
            <Text style={{ color: fg, fontSize: 15, fontFamily: 'Calibre-Medium' }}>Allow multiple choices</Text>
            <View style={{
              width: 44, height: 26, borderRadius: 999, padding: 3,
              backgroundColor: pollMulti ? '#c0a06e' : inputBg,
              alignItems: pollMulti ? 'flex-end' : 'flex-start',
            }}>
              <View style={{ width: 20, height: 20, borderRadius: 999, backgroundColor: '#ffffff' }} />
            </View>
          </Pressable>
          <Pressable
            onPress={() => void sendPoll()}
            style={({ pressed }) => ({
              marginTop: 4, alignItems: 'center', paddingVertical: 13, borderRadius: 12,
              backgroundColor: pressed ? '#a08458' : '#c0a06e',
            })}
          >
            <Text style={{ color: '#000', fontSize: 16, fontFamily: 'Calibre-Semibold' }}>Send poll</Text>
          </Pressable>
        </Col>
      </AppModal>
    </Col>
  );
}
