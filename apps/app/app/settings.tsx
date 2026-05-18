/** Settings — daemon URL, bearer token, self URI. "Test connection" hits /api/state. */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { loadConfig, saveConfig, type Config } from '../lib/config';
import { fetchState } from '../lib/sse';

const APP_VERSION = (Constants.expoConfig?.version ?? '0.0.0') as string;

export default function Settings(): React.ReactElement {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const fg = dark ? '#e8ecf2' : '#1a1f29';
  const sub = dark ? '#8a94a6' : '#5a6477';
  const bg = dark ? '#0f1115' : '#ffffff';
  const field = dark ? '#161a22' : '#fafbfd';
  const border = dark ? '#262c38' : '#e3e7ef';

  const [cfg, setCfg] = useState<Config>({ daemonUrl: '', token: '', userId: '' });
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string>('');
  const [daemonVersion, setDaemonVersion] = useState<string | null>(null);

  useEffect(() => {
    void loadConfig().then(c => {
      setCfg(c);
      setLoading(false);
      /** Fire-and-forget: fetch daemon version for the footer. */
      if (c.daemonUrl && c.token) {
        void fetchState(c.daemonUrl, c.token).then(r => {
          if (r.ok) setDaemonVersion((r.data as { version?: string }).version ?? null);
        });
      }
    });
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  const test = async (): Promise<void> => {
    setTesting(true); setTestResult('');
    /** Always test against the freshly-typed values, not the persisted ones. */
    const r = await fetchState(cfg.daemonUrl, cfg.token);
    setTesting(false);
    if (!r.ok) { setTestResult(`failed (${r.status || 'network'}): ${r.error}`); return; }
    const d = r.data as { recent_history?: unknown[]; claims?: Record<string, unknown>; version?: string };
    setTestResult(`ok — ${d.recent_history?.length ?? 0} recent events, ${Object.keys(d.claims ?? {}).length} claims`);
    if (d.version) setDaemonVersion(d.version);
  };

  const fieldStyle = {
    backgroundColor: field, borderWidth: 1, borderColor: border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, color: fg, fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  };
  const renderField = (
    label: string, hint: string, value: string, set: (v: string) => void,
    extra: Partial<React.ComponentProps<typeof TextInput>> = {},
  ): React.ReactElement => (
    <View style={{ gap: 4 }}>
      <Text style={{ color: fg, fontWeight: '600', fontSize: 13 }}>{label}</Text>
      <TextInput
        value={value} onChangeText={set} placeholderTextColor={sub} style={fieldStyle} {...extra}
      />
      <Text style={{ color: sub, fontSize: 11 }}>{hint}</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: bg }}
    >
      <ScrollView contentContainerStyle={{ padding: 18, gap: 16 }}>
        {renderField('Daemon URL', 'e.g. https://monitor.metro.box', cfg.daemonUrl,
          v => setCfg({ ...cfg, daemonUrl: v }), { autoCapitalize: 'none', keyboardType: 'url' })}
        {renderField('Bearer token', 'value of METRO_MONITOR_TOKEN on the daemon', cfg.token,
          v => setCfg({ ...cfg, token: v }), { secureTextEntry: true })}
        {renderField('Self URI (optional)', "e.g. metro://claude/user/<id> — enables 'mine + free' filtering",
          cfg.userId, v => setCfg({ ...cfg, userId: v }), { autoCapitalize: 'none' })}

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={test}
            disabled={testing || !cfg.daemonUrl || !cfg.token}
            style={({ pressed }) => ({
              flex: 1, backgroundColor: pressed ? border : field,
              borderWidth: 1, borderColor: border,
              paddingVertical: 12, borderRadius: 8, alignItems: 'center',
              opacity: !cfg.daemonUrl || !cfg.token ? 0.5 : 1,
            })}
          >
            <Text style={{ color: fg, fontWeight: '600' }}>{testing ? 'Testing…' : 'Test connection'}</Text>
          </Pressable>
          <Pressable
            onPress={() => void saveConfig(cfg).then(() => router.back())}
            style={({ pressed }) => ({
              flex: 1, backgroundColor: pressed ? '#4a8fdf' : '#5aa9ff',
              paddingVertical: 12, borderRadius: 8, alignItems: 'center',
            })}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
          </Pressable>
        </View>

        {testResult ? (
          <Text style={{ color: testResult.startsWith('ok') ? '#83c989' : '#d96868', fontSize: 13 }}>
            {testResult}
          </Text>
        ) : null}

        <Text style={{ color: sub, fontSize: 12, marginTop: 12, lineHeight: 18 }}>
          Tokens are stored in your device&apos;s secure store (Keychain on iOS, Keystore on Android).
          They never leave your phone except as the {`\`Authorization: Bearer\``} header on requests
          to the daemon URL above.
        </Text>
        <Text style={{ color: sub, fontSize: 11, marginTop: 16, textAlign: 'center' }}>
          app v{APP_VERSION} · daemon {daemonVersion ? `v${daemonVersion}` : '(unknown — test connection)'}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
