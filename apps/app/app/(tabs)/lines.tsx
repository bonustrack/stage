/** Lines screen — one-shot `/api/state` snapshot. Tap a row to filter the Activity feed. */

import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { loadConfig, isConfigured } from '../../lib/config';
import { fetchState } from '../../lib/sse';
import type { StateSnapshot } from '../../lib/types';

type Row = { line: string; owner: string | null };

export default function Lines(): React.ReactElement {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const fg = dark ? '#e8ecf2' : '#1a1f29';
  const sub = dark ? '#8a94a6' : '#5a6477';
  const bg = dark ? '#0f1115' : '#ffffff';
  const border = dark ? '#262c38' : '#e3e7ef';
  const rowBg = dark ? '#161a22' : '#fafbfd';
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    void (async (): Promise<void> => {
      const cfg = await loadConfig();
      if (!isConfigured(cfg)) { setError('not configured — open Settings'); return; }
      const r = await fetchState(cfg.daemonUrl, cfg.token);
      if (!r.ok) { setError(`failed (${r.status}): ${r.error}`); return; }
      const data = r.data as StateSnapshot;
      const claims = data.claims ?? {};
      setRows((data.lines ?? []).map(line => ({ line, owner: claims[line] ?? null })));
    })();
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: bg }}>
        <Text style={{ color: fg, fontSize: 15 }}>{error}</Text>
      </View>
    );
  }
  if (!rows) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={r => r.line}
      style={{ backgroundColor: bg }}
      ListEmptyComponent={
        <View style={{ padding: 32, alignItems: 'center' }}>
          <Text style={{ color: sub }}>No lines seen yet.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push({ pathname: '/', params: { chat: item.line } })}
          style={({ pressed }) => ({
            backgroundColor: pressed ? border : rowBg,
            paddingHorizontal: 14, paddingVertical: 12,
            borderBottomWidth: 1, borderBottomColor: border,
          })}
        >
          <Text style={{ color: fg, fontSize: 14, fontFamily: 'monospace' }} numberOfLines={1}>
            {item.line.replace(/^metro:\/\//, '')}
          </Text>
          <Text style={{ color: item.owner ? '#83c989' : sub, fontSize: 12, marginTop: 4 }}>
            {item.owner ? `claimed by ${item.owner.replace(/^metro:\/\//, '')}` : 'unclaimed'}
          </Text>
        </Pressable>
      )}
    />
  );
}
