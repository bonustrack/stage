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
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const colors = {
    fg: dark ? '#e8ecf2' : '#1a1f29',
    sub: dark ? '#8a94a6' : '#5a6477',
    bg: dark ? '#0f1115' : '#ffffff',
    field: dark ? '#161a22' : '#fafbfd',
    border: dark ? '#262c38' : '#e3e7ef',
    accent: '#5aa9ff',
  };

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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  const save = async (then: 'back' | 'stay'): Promise<void> => {
    await saveConfig(cfg);
    if (then === 'back') router.back();
  };

  const test = async (): Promise<void> => {
    setTesting(true);
    setTestResult('');
    /** Always test against the freshly-typed values, not the persisted ones. */
    const r = await fetchState(cfg.daemonUrl, cfg.token);
    setTesting(false);
    if (r.ok) {
      const data = r.data as { recent_history?: unknown[]; claims?: Record<string, unknown>; version?: string };
      const events = data.recent_history?.length ?? 0;
      const claims = Object.keys(data.claims ?? {}).length;
      setTestResult(`ok — ${events} recent events, ${claims} claims`);
      if (data.version) setDaemonVersion(data.version);
    } else {
      setTestResult(`failed (${r.status || 'network'}): ${r.error}`);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <ScrollView contentContainerStyle={{ padding: 18, gap: 16 }}>
        <Field
          label="Daemon URL"
          hint="e.g. https://monitor.metro.box"
          value={cfg.daemonUrl}
          onChangeText={(v: string) => setCfg({ ...cfg, daemonUrl: v })}
          autoCapitalize="none"
          keyboardType="url"
          colors={colors}
        />
        <Field
          label="Bearer token"
          hint="value of METRO_MONITOR_TOKEN on the daemon"
          value={cfg.token}
          onChangeText={(v: string) => setCfg({ ...cfg, token: v })}
          secureTextEntry
          colors={colors}
        />
        <Field
          label="Self URI (optional)"
          hint="e.g. metro://claude/user/<id> — enables 'mine + free' filtering"
          value={cfg.userId}
          onChangeText={(v: string) => setCfg({ ...cfg, userId: v })}
          autoCapitalize="none"
          colors={colors}
        />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={test}
            disabled={testing || !cfg.daemonUrl || !cfg.token}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: pressed ? colors.border : colors.field,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: 12,
              borderRadius: 8,
              alignItems: 'center',
              opacity: !cfg.daemonUrl || !cfg.token ? 0.5 : 1,
            })}
          >
            <Text style={{ color: colors.fg, fontWeight: '600' }}>
              {testing ? 'Testing…' : 'Test connection'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void save('back')}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: pressed ? '#4a8fdf' : colors.accent,
              paddingVertical: 12,
              borderRadius: 8,
              alignItems: 'center',
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

        <Text style={{ color: colors.sub, fontSize: 12, marginTop: 12, lineHeight: 18 }}>
          Tokens are stored in your device&apos;s secure store (Keychain on iOS, Keystore on Android).
          They never leave your phone except as the {`\`Authorization: Bearer\``} header on requests
          to the daemon URL above.
        </Text>

        <Text style={{ color: colors.sub, fontSize: 11, marginTop: 16, textAlign: 'center' }}>
          app v{APP_VERSION} · daemon {daemonVersion ? `v${daemonVersion}` : '(unknown — test connection)'}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldColors = {
  fg: string; sub: string; field: string; border: string;
};

function Field(props: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'url' | 'email-address';
  colors: FieldColors;
}): React.ReactElement {
  const { label, hint, colors, ...input } = props;
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: colors.fg, fontWeight: '600', fontSize: 13 }}>{label}</Text>
      <TextInput
        {...input}
        placeholderTextColor={colors.sub}
        style={{
          backgroundColor: colors.field,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: colors.fg,
          fontSize: 15,
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        }}
      />
      {hint ? <Text style={{ color: colors.sub, fontSize: 11 }}>{hint}</Text> : null}
    </View>
  );
}
