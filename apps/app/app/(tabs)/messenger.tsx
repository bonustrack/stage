/** Messenger — direct chat with the assistant via `POST /api/messenger/send`. */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Keyboard, Pressable, Text, TextInput, View,
  useColorScheme,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { EventRow } from '../../components/EventRow';
import { loadConfig, isConfigured, type Config } from '../../lib/config';
import { useTail } from '../../lib/sse';

const MESSENGER_LINE = 'metro://messenger/owner';

async function postMessenger(daemonUrl: string, token: string, text: string):
  Promise<{ ok: true } | { ok: false; error: string }>
{
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${daemonUrl.replace(/\/$/, '')}/api/messenger/send`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = (): void => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve({ ok: true });
      let msg = `HTTP ${xhr.status}`;
      try { msg = (JSON.parse(xhr.responseText) as { error?: string }).error ?? msg; } catch { /* */ }
      resolve({ ok: false, error: msg });
    };
    xhr.onerror = (): void => resolve({ ok: false, error: 'network error' });
    xhr.ontimeout = (): void => resolve({ ok: false, error: 'timeout' });
    xhr.timeout = 15_000;
    xhr.send(JSON.stringify({ text, as: 'user' }));
  });
}

export default function Messenger(): React.ReactElement {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const fg = dark ? '#e8ecf2' : '#1a1f29';
  const sub = dark ? '#8a94a6' : '#5a6477';
  const bg = dark ? '#0f1115' : '#ffffff';
  const border = dark ? '#262c38' : '#e3e7ef';

  const [cfg, setCfg] = useState<Config | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /** Manual keyboard tracking — KeyboardAvoidingView is unreliable with Android adjustResize + tabs. */
  const [kbd, setKbd] = useState(0);

  useFocusEffect(useCallback(() => { void loadConfig().then(setCfg); }, []));

  useEffect(() => {
    const onShow = (e: { endCoordinates: { height: number } }): void => setKbd(e.endCoordinates.height);
    const onHide = (): void => setKbd(0);
    const sub1 = Keyboard.addListener('keyboardDidShow', onShow);
    const sub2 = Keyboard.addListener('keyboardDidHide', onHide);
    return (): void => { sub1.remove(); sub2.remove(); };
  }, []);

  const tailOpts = useMemo(() => ({
    daemonUrl: cfg?.daemonUrl ?? '', token: cfg?.token ?? '',
    chat: MESSENGER_LINE, includeWebhooks: false,
  }), [cfg]);

  const enabled = !!cfg && isConfigured(cfg);
  const { events } = useTail(tailOpts, enabled);
  /** Newest at the bottom for a chat UX; the FlatList is inverted so we render newest-first. */

  if (cfg && !isConfigured(cfg)) {
    return (
      <View style={{ flex: 1, padding: 24, gap: 12, justifyContent: 'center', backgroundColor: bg }}>
        <Text style={{ color: fg, fontSize: 18, fontWeight: '700' }}>Set up first</Text>
        <Text style={{ color: sub, lineHeight: 22 }}>
          Open Settings and configure the daemon URL + bearer token to chat with the assistant.
        </Text>
        <Pressable
          onPress={() => router.push('/settings')}
          style={{ backgroundColor: '#5aa9ff', paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Open Settings</Text>
        </Pressable>
      </View>
    );
  }

  const canSend = !sending && !!text.trim();
  const send = async (): Promise<void> => {
    const body = text.trim();
    if (!body || !cfg) return;
    setSending(true); setErr(null);
    const r = await postMessenger(cfg.daemonUrl, cfg.token, body);
    setSending(false);
    if (r.ok) { setText(''); return; }
    setErr(r.error);
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg, paddingBottom: kbd }}>
      <FlatList
        data={events}
        keyExtractor={e => e.id}
        renderItem={({ item }) => (
          <EventRow
            entry={item}
            onPress={() => router.push({ pathname: '/event/[id]', params: { id: item.id, data: JSON.stringify(item) } })}
          />
        )}
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ color: sub }}>Type a message below to start chatting.</Text>
          </View>
        }
        keyboardShouldPersistTaps="handled"
      />
      {err ? (
        <Text style={{ color: '#d96868', fontSize: 12, paddingHorizontal: 14, paddingTop: 8 }}>
          send failed: {err}
        </Text>
      ) : null}
      <View style={{
        flexDirection: 'row', gap: 8, padding: 10, alignItems: 'flex-end',
        borderTopWidth: 1, borderTopColor: border,
      }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message the assistant…"
          placeholderTextColor={sub}
          multiline
          style={{
            flex: 1,
            backgroundColor: dark ? '#16191f' : '#f3f5f9',
            color: fg, borderRadius: 18,
            paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10,
            fontSize: 15, maxHeight: 120,
          }}
        />
        <Pressable
          onPress={() => void send()}
          disabled={!canSend}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#4a8fdf' : '#5aa9ff',
            opacity: canSend ? 1 : 0.5,
            paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18,
            alignItems: 'center', justifyContent: 'center', minWidth: 60,
          })}
        >
          {sending ? <ActivityIndicator color="#fff" /> : (
            <Text style={{ color: '#fff', fontWeight: '700' }}>Send</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
