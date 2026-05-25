/** Floating two-line composer (Claude-mobile-style): textarea on top, [+ / mic / send] below. */

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Pressable, Text, TextInput, View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { ComposerGradient } from './ComposerGradient';
import { HeroIcon, type HeroIconName } from './HeroIcon';
import { sendMessenger, uploadAttachment, type Attachment } from '../lib/messenger';
import { drainStagedAttachments, hasStagedAttachments } from '../lib/share-intent-staging';
import { fileUriToBase64, xmtpReply, xmtpSendAttachment, xmtpSendText } from '../lib/xmtp';

/** Persist composer draft across app restarts so typed-but-unsent text survives a
 *  force-close. Mirrors how iMessage / WhatsApp keep your half-finished reply. */
const DRAFT_KEY = 'messenger-composer-draft';

interface Props {
  daemonUrl: string; token: string; dark: boolean;
  /** When set (= `metro://xmtp/<convId>`), the composer skips the daemon entirely and
   *  sends text/attachments/replies via the local XMTP client. The `daemonUrl`/`token`
   *  pair is ignored for sending in that mode, but still used to build the image chip
   *  thumbnail URL — fine because the staged-attachment chip uses the local file URI
   *  directly in xmtp mode (`a.url` is the file:// path, not a daemon route). */
  xmtpLine?: string;
  replyingTo?: { id: string; preview: string };
  onClearReply?: () => void;
  /** Optimistic-render hook: invoked the moment the user taps send, before the API call. */
  onOptimistic?: (entry: { localId: string; text: string; attachments: Attachment[]; replyTo?: string }) => void;
  /** Fired AFTER the send completes (success OR failure). Lets the parent drop the
   *  optimistic entry instead of waiting for an SSE/stream echo that may never arrive
   *  (XMTP `streamMessages` doesn't always replay self-sends — pending bubbles would stick). */
  onSent?: (localId: string, error?: string) => void;
}

function chipImageUrl(daemonUrl: string, token: string, url: string): string {
  return `${daemonUrl.replace(/\/$/, '')}${url}?token=${encodeURIComponent(token)}`;
}

export function MessengerComposer({
  daemonUrl, token, dark, xmtpLine, replyingTo, onClearReply, onOptimistic, onSent,
}: Props): React.ReactElement {
  const xmtpMode = !!xmtpLine;
  const fg = dark ? '#e8ecf2' : '#1a1f29';
  const sub = dark ? '#8a94a6' : '#5a6477';
  const inputBg = dark ? '#16191f' : '#f3f5f9';
  const chipBg = dark ? '#1d2230' : '#eef1f7';

  const [text, setText] = useState('');
  const [pending, setPending] = useState<Attachment[]>(() => drainStagedAttachments());
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const recRef = useRef<Audio.Recording | null>(null);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Restore draft on mount + persist on change (debounced). Skip the persist
   *  on the very first restore so we don'​t clobber a fresher save. */
  const draftRestored = useRef(false);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    void SecureStore.getItemAsync(DRAFT_KEY).then(v => {
      if (v) setText(v);
      draftRestored.current = true;
    }).catch(() => { draftRestored.current = true; });
  }, []);
  useEffect(() => {
    if (!draftRestored.current) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      void (text
        ? SecureStore.setItemAsync(DRAFT_KEY, text)
        : SecureStore.deleteItemAsync(DRAFT_KEY)
      ).catch(() => { /* ignore */ });
    }, 300);
  }, [text]);

  const canSend = !sending && (text.trim().length > 0 || pending.length > 0);

  const upload = async (uri: string, mime: string, name?: string): Promise<void> => {
    setUploading(true);
    try {
      if (xmtpMode) {
        /** In xmtp mode the daemon isn't involved — we just stage the local file URI
         *  and base64-encode at send time. The chip uses `url` as a render hint
         *  (`file://...` works with `Image` source on RN), and `id` is just a
         *  client-side dedupe key.
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
      } else {
        const att = await uploadAttachment(daemonUrl, token, uri, mime, name);
        setPending(prev => [...prev, att]);
      }
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

  const pickFile = async (): Promise<void> => {
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (r.canceled) return;
    const a = r.assets[0];
    await upload(a.uri, a.mimeType ?? 'application/octet-stream', a.name);
  };

  const startRec = async (): Promise<void> => {
    setErr(null);
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) { Alert.alert('Mic permission denied'); return; }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await rec.startAsync();
    recRef.current = rec;
    setRecording(true);
    setRecordSecs(0);
    recTimerRef.current = setInterval(() => { setRecordSecs(s => s + 1); }, 1000);
  };

  const stopRec = async (): Promise<void> => {
    const rec = recRef.current; if (!rec) return;
    setRecording(false); recRef.current = null;
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
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
      if (xmtpMode && xmtpLine) {
        /** XMTP path — send text + each attachment as its own typed message. The body
         *  is sent as a `reply` when there's a `replyingTo`; standalone attachments
         *  go as plain `attachment` messages (replies-with-attachments would need a
         *  ReplyContent wrapping an attachment, not v1). */
        if (body) {
          if (sendingReplyTo) await xmtpReply(xmtpLine, sendingReplyTo, body);
          else await xmtpSendText(xmtpLine, body);
        }
        for (const a of sendingAttachments) {
          const dataB64 = await fileUriToBase64(a.url);
          await xmtpSendAttachment(xmtpLine, a.name ?? a.id, a.mime, dataB64);
        }
      } else {
        await sendMessenger(daemonUrl, token, body, sendingAttachments, sendingReplyTo);
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
  const bg = dark ? '#000000' : '#ffffff';
  return (
    <View style={{ paddingHorizontal: 10, paddingTop: 6, paddingBottom: 18, backgroundColor: bg }}>
      <ComposerGradient bg={bg} direction="down" top={-10} height={10} />
      {replyingTo ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 6 }}>
          <View style={{ flex: 1, borderLeftWidth: 2, borderLeftColor: sub, paddingLeft: 8 }}>
            <Text style={{ color: sub, fontSize: 10 }}>Replying to</Text>
            <Text style={{ color: fg, fontSize: 12 }} numberOfLines={1}>{replyingTo.preview}</Text>
          </View>
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
                    /** In xmtp mode `a.url` is already a local file:// URI; otherwise it's
                     *  the daemon-served attachment route that needs auth-token appended. */
                    source={{ uri: xmtpMode ? a.url : chipImageUrl(daemonUrl, token, a.url) }}
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
                <Text style={{ color: fg, fontSize: 11, width: 72, textAlign: 'center' }} numberOfLines={1}>
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
                <Text style={{ color: fg, fontSize: 12, maxWidth: 140 }} numberOfLines={1}>{a.name ?? a.id}</Text>
                <Pressable onPress={() => setPending(prev => prev.filter((_, j) => j !== i))} hitSlop={6}>
                  <HeroIcon name="x" size={14} color={sub} />
                </Pressable>
              </View>
            )
          ))}
        </View>
      ) : null}
      {attachMenuOpen ? (
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 6, paddingBottom: 6 }}>
          {(
            [['photo', 'Image', pickImage], ['paperClip', 'File', pickFile]] as const
          ).map(([icon, label, action]) => (
            <Pressable
              key={label}
              onPress={() => { setAttachMenuOpen(false); void action(); }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: chipBg,
              }}
            >
              <HeroIcon name={icon} size={16} color={fg} />
              <Text style={{ color: fg, fontSize: 13 }}>{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {recording || uploading || err ? (
        <Text style={{
          color: err ? '#d96868' : recording ? '#d96868' : sub,
          fontSize: 12, paddingHorizontal: 14, paddingBottom: 4,
        }}>
          {err ?? (recording
            ? `● Recording… ${Math.floor(recordSecs / 60)}:${(recordSecs % 60).toString().padStart(2, '0')}`
            : 'Uploading…')}
        </Text>
      ) : null}
      <View style={{ backgroundColor: inputBg, borderRadius: 14, padding: 10 }}>
        <TextInput
          value={text} onChangeText={setText} placeholder="Ask Metro" placeholderTextColor={sub} multiline
          style={{ color: fg, fontFamily: 'Calibre-Medium', fontSize: 17, lineHeight: 22, minHeight: 24, maxHeight: 140, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 8, textAlignVertical: 'top' }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Btn icon={attachMenuOpen ? 'x' : 'plus'} onPress={() => setAttachMenuOpen(o => !o)} />
          <View style={{ flex: 1 }} />
          <Btn icon={recording ? 'stop' : 'microphone'} onPress={() => void (recording ? stopRec() : startRec())} active={recording} />
          <Pressable onPress={() => void send()} disabled={!canSend}
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#cccccc' : '#ffffff', opacity: canSend ? 1 : 0.45,
              width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
            })}>
            {sending ? <ActivityIndicator color="#000" /> : <HeroIcon name="send" size={20} color="#000" />}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
