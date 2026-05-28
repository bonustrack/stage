/** Floating two-line composer (Claude-mobile-style): textarea on top, [+ / mic / send] below. */

import { useEffect, useRef, useState } from 'react';
import {
  Alert, Image, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { loadDrafts, getDraft, setDraft } from '../lib/drafts';
import { Audio } from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { ComposerGradient } from './ComposerGradient';
import { HeroIcon, type HeroIconName } from './HeroIcon';
import { fileUriToBase64, xmtpReply, xmtpSendAttachment, xmtpSendText } from '../lib/xmtp';

/** Composer-local representation of a staged attachment. `url` is a `file://` URI in xmtp
 *  mode (the only mode the mobile composer supports now). `id` is a client-side dedupe key. */
interface Attachment {
  id: string; url: string; kind: string; mime: string; size: number; name?: string;
}


interface Props {
  dark: boolean;
  /** Target XMTP conversation line URI (`metro://xmtp/<convId>`). Required — the
   *  mobile composer only supports the XMTP transport now (the daemon-routed
   *  messenger pipeline was removed). */
  xmtpLine: string;
  replyingTo?: { id: string; preview: string };
  onClearReply?: () => void;
  /** Tap on the "Replying to …" preview — parent scrolls the feed to the
   *  target message + flashes the highlight. No-op when omitted. */
  onReplyPreviewPress?: () => void;
  /** Optimistic-render hook: invoked the moment the user taps send, before the API call. */
  onOptimistic?: (entry: { localId: string; text: string; attachments: Attachment[]; replyTo?: string }) => void;
  /** Fired AFTER the send completes (success OR failure). Lets the parent drop the
   *  optimistic entry instead of waiting for an SSE/stream echo that may never arrive
   *  (XMTP `streamMessages` doesn't always replay self-sends — pending bubbles would stick). */
  onSent?: (localId: string, error?: string) => void;
}

export function MessengerComposer({
  dark, xmtpLine, replyingTo, onClearReply, onReplyPreviewPress, onOptimistic, onSent,
}: Props): React.ReactElement {
  const fg = dark ? '#9f9fa3' : '#57606a';
  const head = dark ? '#ffffff' : '#000000';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const inputBg = dark ? '#282a2d' : '#e4e4e5';
  const chipBg = dark ? '#282a2d' : '#e4e4e5';

  const [text, setText] = useState('');
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
  /** Recent device photos shown inline in the attach menu (Discord-style). */
  const [recentPhotos, setRecentPhotos] = useState<MediaLibrary.Asset[]>([]);
  const recRef = useRef<Audio.Recording | null>(null);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Mic press timestamp — distinguishes push-to-talk (hold ≥ threshold →
   *  release stops) from a tap (click to start, then tap ✓ to stop). */
  const micPressStart = useRef(0);
  /** Synchronous mirror of `recording` — the mic's onPressOut needs to know we're
   *  recording without waiting for the async state update, so push-to-talk release
   *  reliably stops. */
  const recordingRef = useRef(false);
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

  const canSend = !sending && (text.trim().length > 0 || pending.length > 0);

  const upload = async (uri: string, mime: string, name?: string): Promise<void> => {
    setUploading(true);
    try {
      /** Stage the local file URI and base64-encode at send time. The chip uses `url`
       *  as a render hint (`file://...` works with `Image` source on RN), and `id` is
       *  just a client-side dedupe key.
       *
       *  Pre-flight the file size: libxmtp's native side silently drops oversize
       *  attachments without raising a JS error (the send "succeeds" but the message
       *  never publishes). Reject in the composer where the user sees the error
       *  instead of staring at a ghost bubble. */
      const head = await fetch(uri);
      const blob = await head.blob();
      const XMTP_INLINE_MAX = 800 * 1024;
      if (blob.size > XMTP_INLINE_MAX) {
        throw new Error(`Image is ${(blob.size / 1024).toFixed(0)} KB — XMTP inline limit ~${XMTP_INLINE_MAX / 1024} KB. Pick a smaller image (or take a screenshot/crop).`);
      }
      const kind = mime.startsWith('image/') ? 'image'
        : mime.startsWith('audio/') ? 'audio'
          : mime.startsWith('video/') ? 'video' : 'file';
      const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setPending(prev => [...prev, { id, url: uri, kind, mime, size: blob.size, name }]);
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
    try {
      /** Send text + each attachment as its own typed XMTP message. The body is sent as
       *  a `reply` when there's a `replyingTo`; standalone attachments go as plain
       *  `attachment` messages (replies-with-attachments would need a ReplyContent
       *  wrapping an attachment, not v1). */
      if (body) {
        if (sendingReplyTo) await xmtpReply(xmtpLine, sendingReplyTo, body);
        else await xmtpSendText(xmtpLine, body);
      }
      for (const a of sendingAttachments) {
        const dataB64 = await fileUriToBase64(a.url);
        await xmtpSendAttachment(xmtpLine, a.name ?? a.id, a.mime, dataB64);
      }
    } catch (e) { sendErr = (e as Error).message; setErr(sendErr); }
    finally {
      setSending(false);
      /** Always tell the parent the send finished (success or failure) so the optimistic
       *  bubble clears. XMTP self-sends don't always come back through streamMessages, so
       *  waiting for an echo stranded the bubble in pending state forever. */
      onSent?.(localId, sendErr);
    }
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
    <View style={{ paddingHorizontal: 10, paddingTop: 0, paddingBottom: 14, backgroundColor: bg }}>
      {/** 24px fade sits directly above the composer (paddingTop is 0), so the
       *  messages fade straight into the composer over a uniform 24px ramp. */}
      {/** left/right -10 cancels this View's paddingHorizontal:10 so the fade
       *   bleeds to the screen edges instead of leaving un-faded side strips. */}
      <ComposerGradient bg={bg} direction="down" top={-24} height={24} left={-10} right={-10} />
      {replyingTo ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 6 }}>
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
        </View>
      ) : null}
      {pending.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 6, paddingBottom: 6 }}>
          {pending.map((a, i) => (
            a.kind === 'image' ? (
              /** Image attachments: 72px square with the filename label beneath, x-to-remove
               *  pinned to the top-right corner of the thumbnail. */
              <View key={a.id} style={{ width: 72, alignItems: 'center', gap: 4 }}>
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
              </View>
            ) : (
              /** Non-image attachments keep the inline chip layout — files/audio don'​t benefit
               *  from a thumbnail and look fine as a row. */
              <View key={a.id} style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 8, paddingVertical: 4,
                borderRadius: 12, backgroundColor: chipBg,
              }}>
                <HeroIcon name={kindIcon(a.kind)} size={14} color={fg} />
                <Text style={{ color: fg, fontSize: 12, maxWidth: 140 , fontFamily: 'Calibre-Medium'}} numberOfLines={1}>{a.name ?? a.id}</Text>
                <Pressable onPress={() => setPending(prev => prev.filter((_, j) => j !== i))} hitSlop={6}>
                  <HeroIcon name="x" size={14} color={sub} />
                </Pressable>
              </View>
            )
          ))}
        </View>
      ) : null}
      {uploading || err ? (
        <Text style={{ color: err ? '#d96868' : sub, fontSize: 12, paddingHorizontal: 14, paddingBottom: 4 }}>
          {err ?? 'Uploading…'}
        </Text>
      ) : null}
      <View style={{ backgroundColor: inputBg, borderRadius: 10, padding: 10 }}>
        {/** Top slot: live waveform + timer while recording, else the textarea. The
         *   button row (incl. the mic) below stays mounted across both states, so a
         *   push-to-talk press→release gesture isn't interrupted by a UI swap. */}
        {recording ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', height: 28, paddingHorizontal: 4 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: 28, overflow: 'hidden' }}>
              {[...Array(Math.max(0, 40 - levels.length)).fill(0.05), ...levels].slice(-40).map((lvl, i) => (
                <View key={i} style={{ width: 3, marginHorizontal: 1, borderRadius: 2, height: Math.max(3, Math.round(lvl * 26)), backgroundColor: head, opacity: 0.85 }} />
              ))}
            </View>
            <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium', minWidth: 40, textAlign: 'center' }}>
              {Math.floor(recordSecs / 60)}:{(recordSecs % 60).toString().padStart(2, '0')}
            </Text>
          </View>
        ) : (
          <View style={{ position: 'relative' }}>
            <TextInput
              value={text} onChangeText={setText} placeholder="Ask Metro" placeholderTextColor={sub} multiline
              onContentSizeChange={(e) => setTextareaH(e.nativeEvent.contentSize.height)}
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {/** Left: cancel (✕) while recording, else the attach (+) menu toggle. */}
          {recording
            ? <Btn icon="x" onPress={() => void cancelRec()} />
            : <Btn icon={attachMenuOpen ? 'x' : 'plus'} onPress={() => setAttachMenuOpen(o => !o)} />}
          <View style={{ flex: 1 }} />
          {/** Mic — both record flows, mounted across recording so the gesture survives:
           *   • tap to start → tap again (or the ✓) to stop+stage;
           *   • press-hold to record → release (held ≥350ms) to stop+stage.
           *   The clip lands as a PENDING attachment in the composer, not auto-sent. */}
          <Pressable
            onPressIn={() => { micPressStart.current = Date.now(); if (recordingRef.current) void stopRec(); else void startRec(); }}
            onPressOut={() => { if (recordingRef.current && Date.now() - micPressStart.current >= 350) void stopRec(); }}
            style={({ pressed }) => ({
              width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
              backgroundColor: recording ? '#e2622f' : (pressed ? chipBg : 'transparent'),
            })}
          >
            <HeroIcon name="microphone" size={22} color={recording ? '#ffffff' : fg} />
          </Pressable>
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
        </View>
      </View>
      {/** Attach menu — boxes below the composer with icon + label per source.
       *   Tap the + button in the composer row to toggle. */}
      {attachMenuOpen ? (
        <View style={{ paddingTop: 10, gap: 10 }}>
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
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {(
            [
              ['photo', 'Image', pickImage],
              ['paperClip', 'File', pickFile],
              ['mapPin', 'Location', pickLocation],
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
        </View>
        </View>
      ) : null}
    </View>
  );
}
