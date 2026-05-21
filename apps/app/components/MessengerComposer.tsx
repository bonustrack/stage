/** Floating two-line composer (Claude-mobile-style): textarea on top, [+ / mic / send] below. */

import { useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Pressable, Text, TextInput, View,
} from 'react-native';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { ComposerGradient } from './ComposerGradient';
import { HeroIcon, type HeroIconName } from './HeroIcon';
import { sendMessenger, uploadAttachment, type Attachment } from '../lib/messenger';

interface Props {
  daemonUrl: string; token: string; dark: boolean;
  replyingTo?: { id: string; preview: string };
  onClearReply?: () => void;
  /** Optimistic-render hook: invoked the moment the user taps send, before the API call. */
  onOptimistic?: (entry: { localId: string; text: string; attachments: Attachment[]; replyTo?: string }) => void;
}

function chipImageUrl(daemonUrl: string, token: string, url: string): string {
  return `${daemonUrl.replace(/\/$/, '')}${url}?token=${encodeURIComponent(token)}`;
}

export function MessengerComposer({ daemonUrl, token, dark, replyingTo, onClearReply, onOptimistic }: Props): React.ReactElement {
  const fg = dark ? '#e8ecf2' : '#1a1f29';
  const sub = dark ? '#8a94a6' : '#5a6477';
  const inputBg = dark ? '#16191f' : '#f3f5f9';
  const chipBg = dark ? '#1d2230' : '#eef1f7';

  const [text, setText] = useState('');
  const [pending, setPending] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const recRef = useRef<Audio.Recording | null>(null);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canSend = !sending && (text.trim().length > 0 || pending.length > 0);

  const upload = async (uri: string, mime: string, name?: string): Promise<void> => {
    setUploading(true);
    try {
      const att = await uploadAttachment(daemonUrl, token, uri, mime, name);
      setPending(prev => [...prev, att]);
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
    onOptimistic?.({ localId, text: body, attachments: pending, replyTo: replyingTo?.id });
    /** Clear the composer immediately — the bubble already shows the user's input. */
    setText(''); setPending([]); onClearReply?.();
    setSending(true); setErr(null);
    try {
      await sendMessenger(daemonUrl, token, body, pending, replyingTo?.id);
    } catch (e) { setErr((e as Error).message); }
    finally { setSending(false); }
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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 6, paddingBottom: 6 }}>
          {pending.map((a, i) => (
            <View key={a.id} style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: a.kind === 'image' ? 4 : 8, paddingVertical: 4,
              borderRadius: 12, backgroundColor: chipBg,
            }}>
              {a.kind === 'image'
                ? <Image source={{ uri: chipImageUrl(daemonUrl, token, a.url) }} style={{ width: 28, height: 28, borderRadius: 6 }} resizeMode="cover" />
                : <HeroIcon name={kindIcon(a.kind)} size={14} color={fg} />}
              <Text style={{ color: fg, fontSize: 12, maxWidth: 140 }} numberOfLines={1}>{a.name ?? a.id}</Text>
              <Pressable onPress={() => setPending(prev => prev.filter((_, j) => j !== i))} hitSlop={6}>
                <HeroIcon name="x" size={14} color={sub} />
              </Pressable>
            </View>
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
          value={text} onChangeText={setText} placeholder="Message the assistant…" placeholderTextColor={sub} multiline
          style={{ color: fg, fontSize: 15, minHeight: 22, maxHeight: 140, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 8, textAlignVertical: 'top' }}
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
