/** Compose + send bar. Shown when a single chat filter is active. */
/** POSTs to /api/call/<train>/<action> with {args:{line,text}}. */

import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View, useColorScheme,
} from 'react-native';

export function trainFromLine(line: string): string | null {
  /** metro://<station>/<id> → station */
  const m = line.match(/^metro:\/\/([^/]+)/);
  return m ? m[1] : null;
}

async function sendCall(
  daemonUrl: string, token: string, train: string, action: string, args: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${daemonUrl.replace(/\/$/, '')}/api/call/${train}/${action}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = (): void => {
      if (xhr.status >= 200 && xhr.status < 300) resolve({ ok: true });
      else {
        let msg = `HTTP ${xhr.status}`;
        try { msg = (JSON.parse(xhr.responseText) as { error?: string }).error ?? msg; } catch { /* ignore */ }
        resolve({ ok: false, error: msg });
      }
    };
    xhr.onerror = (): void => resolve({ ok: false, error: 'network error' });
    xhr.ontimeout = (): void => resolve({ ok: false, error: 'timeout' });
    xhr.timeout = 15_000;
    xhr.send(JSON.stringify({ args }));
  });
}

export function Composer({ daemonUrl, token, line }: {
  daemonUrl: string;
  token: string;
  line: string;
}): React.ReactElement | null {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const colors = {
    fg: dark ? '#e8ecf2' : '#1a1f29',
    sub: dark ? '#8a94a6' : '#5a6477',
    bg: dark ? '#161a22' : '#fafbfd',
    border: dark ? '#262c38' : '#e3e7ef',
    accent: '#5aa9ff',
  };
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const train = trainFromLine(line);
  if (!train) return null;

  const send = async (): Promise<void> => {
    const body = text.trim();
    if (!body) return;
    setSending(true); setErr(null);
    const r = await sendCall(daemonUrl, token, train, 'send', { line, text: body });
    setSending(false);
    if (r.ok) { setText(''); return; }
    setErr(r.error);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg }}
    >
      {err ? (
        <Text style={{ color: '#d96868', fontSize: 12, paddingHorizontal: 14, paddingTop: 8 }}>
          send failed: {err}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, padding: 10, alignItems: 'flex-end' }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={`Message ${train}…`}
          placeholderTextColor={colors.sub}
          multiline
          style={{
            flex: 1,
            backgroundColor: dark ? '#0f1115' : '#ffffff',
            color: colors.fg,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingTop: 10,
            paddingBottom: 10,
            fontSize: 15,
            maxHeight: 120,
          }}
        />
        <Pressable
          onPress={() => void send()}
          disabled={sending || !text.trim()}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#4a8fdf' : colors.accent,
            opacity: sending || !text.trim() ? 0.5 : 1,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 60,
          })}
        >
          {sending ? <ActivityIndicator color="#fff" /> : (
            <Text style={{ color: '#fff', fontWeight: '700' }}>Send</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
