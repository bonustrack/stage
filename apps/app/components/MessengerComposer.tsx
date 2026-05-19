/** Composer row for the messenger: text + image / file / audio buttons. */

import { useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, Text, TextInput, View,
} from 'react-native';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { sendMessenger, uploadAttachment, type Attachment } from '../lib/messenger';

interface Props { daemonUrl: string; token: string; dark: boolean }

export function MessengerComposer({ daemonUrl, token, dark }: Props): React.ReactElement {
  const fg = dark ? '#e8ecf2' : '#1a1f29';
  const sub = dark ? '#8a94a6' : '#5a6477';
  const inputBg = dark ? '#16191f' : '#f3f5f9';
  const chipBg = dark ? '#1d2230' : '#eef1f7';
  const border = dark ? '#262c38' : '#e3e7ef';

  const [text, setText] = useState('');
  const [pending, setPending] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const recRef = useRef<Audio.Recording | null>(null);

  const canSend = !sending && (text.trim().length > 0 || pending.length > 0);

  const upload = async (uri: string, mime: string, name?: string): Promise<void> => {
    try {
      const att = await uploadAttachment(daemonUrl, token, uri, mime, name);
      setPending(prev => [...prev, att]);
    } catch (e) { setErr((e as Error).message); }
  };

  const pickImage = async (): Promise<void> => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85,
    });
    const a = r.assets?.[0]; if (!a) return;
    await upload(a.uri, a.mimeType ?? 'image/jpeg', a.fileName ?? undefined);
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
  };

  const stopRec = async (): Promise<void> => {
    const rec = recRef.current; if (!rec) return;
    setRecording(false); recRef.current = null;
    await rec.stopAndUnloadAsync();
    const uri = rec.getURI(); if (!uri) return;
    await upload(uri, 'audio/m4a', `voice-${Date.now()}.m4a`);
  };

  const send = async (): Promise<void> => {
    const body = text.trim();
    if (!body && pending.length === 0) return;
    setSending(true); setErr(null);
    try {
      await sendMessenger(daemonUrl, token, body, pending);
      setText(''); setPending([]);
    } catch (e) { setErr((e as Error).message); }
    finally { setSending(false); }
  };

  const Btn = ({ glyph, onPress, active }: { glyph: string; onPress: () => void; active?: boolean }): React.ReactElement => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
        backgroundColor: active ? '#d96868' : (pressed ? chipBg : 'transparent'),
      })}
    >
      <Text style={{ fontSize: 18, color: active ? '#fff' : fg }}>{glyph}</Text>
    </Pressable>
  );

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: border }}>
      {pending.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingTop: 6 }}>
          {pending.map((a, i) => (
            <View key={a.id} style={{
              flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4,
              borderRadius: 999, backgroundColor: chipBg,
            }}>
              <Text style={{ color: fg, fontSize: 12 }}>{a.kind === 'image' ? '🖼' : a.kind === 'audio' ? '🎤' : '📎'}</Text>
              <Text style={{ color: fg, fontSize: 12, maxWidth: 140 }} numberOfLines={1}>{a.name ?? a.id}</Text>
              <Pressable onPress={() => setPending(prev => prev.filter((_, j) => j !== i))}>
                <Text style={{ color: sub, fontSize: 12 }}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {recording ? (
        <Text style={{ color: '#d96868', fontSize: 12, paddingHorizontal: 14, paddingTop: 6 }}>● Recording…</Text>
      ) : null}
      {err ? <Text style={{ color: '#d96868', fontSize: 12, paddingHorizontal: 14, paddingTop: 6 }}>{err}</Text> : null}
      <View style={{
        flexDirection: 'row', gap: 4, padding: 10, paddingBottom: 24, alignItems: 'flex-end',
      }}>
        <Btn glyph="🖼" onPress={() => void pickImage()} />
        <Btn glyph="📎" onPress={() => void pickFile()} />
        <Btn glyph={recording ? '⏹' : '🎤'} onPress={() => void (recording ? stopRec() : startRec())} active={recording} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message the assistant…"
          placeholderTextColor={sub}
          multiline
          style={{
            flex: 1, backgroundColor: inputBg, color: fg, borderRadius: 18,
            paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontSize: 15, maxHeight: 120,
          }}
        />
        <Pressable
          onPress={() => void send()}
          disabled={!canSend}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#cccccc' : '#ffffff',
            opacity: canSend ? 1 : 0.5,
            paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
            alignItems: 'center', justifyContent: 'center', minWidth: 54,
          })}
        >
          {sending ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontWeight: '700' }}>Send</Text>}
        </Pressable>
      </View>
    </View>
  );
}
