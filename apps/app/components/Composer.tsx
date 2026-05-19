/** Compose + send bar. Shown when a single chat filter is active. */
/** POSTs to /api/call/<train>/<action> with {args:{line,text}}. */

import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View, useColorScheme,
} from 'react-native';

async function sendCall(
  daemonUrl: string, token: string, train: string, args: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${daemonUrl.replace(/\/$/, '')}/api/call/${train}/send`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = (): void => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve({ ok: true });
      let msg = `HTTP ${xhr.status}`;
      try { msg = (JSON.parse(xhr.responseText) as { error?: string }).error ?? msg; } catch { /* ignore */ }
      resolve({ ok: false, error: msg });
    };
    xhr.onerror = (): void => resolve({ ok: false, error: 'network error' });
    xhr.ontimeout = (): void => resolve({ ok: false, error: 'timeout' });
    xhr.timeout = 15_000;
    xhr.send(JSON.stringify({ args }));
  });
}

/** Stations with an actual outbound REST train. `claude`/`codex`/`webhook` are pseudo-lines. */
const CHAT_TRAINS = new Set(['discord', 'telegram']);

export function Composer({ daemonUrl, token, line }: {
  daemonUrl: string;
  token: string;
  line: string;
}): React.ReactElement | null {
  const dark = useColorScheme() === 'dark';
  const train = line.match(/^metro:\/\/([^/]+)/)?.[1] ?? null;
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!train || !CHAT_TRAINS.has(train)) return null;

  const sub = dark ? '#8a94a6' : '#5a6477';
  const border = dark ? '#262c38' : '#e3e7ef';
  const send = async (): Promise<void> => {
    const body = text.trim();
    if (!body) return;
    setSending(true); setErr(null);
    const r = await sendCall(daemonUrl, token, train, { line, text: body });
    setSending(false);
    if (r.ok) { setText(''); return; }
    setErr(r.error);
  };
  const canSend = !sending && !!text.trim();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ borderTopWidth: 1, borderTopColor: border, backgroundColor: dark ? '#161a22' : '#fafbfd' }}
    >
      {err ? (
        <Text style={{ color: '#d96868', fontSize: 12, paddingHorizontal: 14, paddingTop: 8 }}>
          send failed: {err}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, padding: 10, paddingBottom: 14, alignItems: 'flex-end' }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={`Message ${train}…`}
          placeholderTextColor={sub}
          multiline
          style={{
            flex: 1,
            backgroundColor: dark ? '#000000' : '#ffffff',
            color: dark ? '#e8ecf2' : '#1a1f29',
            borderWidth: 1, borderColor: border, borderRadius: 18,
            paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10,
            fontSize: 15, maxHeight: 120,
          }}
        />
        <Pressable
          onPress={() => void send()}
          disabled={!canSend}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#cccccc' : '#ffffff',
            opacity: canSend ? 1 : 0.5,
            paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
            alignItems: 'center', justifyContent: 'center', minWidth: 60,
          })}
        >
          {sending ? <ActivityIndicator color="#000" /> : (
            <Text style={{ color: '#000', fontWeight: '700' }}>Send</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
