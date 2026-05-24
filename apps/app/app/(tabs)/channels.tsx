/** Channels screen — list every messenger channel the signed-in identity is a member of. */

import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { channelShortId, listChannels, shortMember, type Channel } from '../../lib/channels';
import { loadConfig, isConfigured } from '../../lib/config';

function fmtTs(ts: string | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function Channels(): React.ReactElement {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const fg = dark ? '#e8ecf2' : '#1a1f29';
  const sub = dark ? '#8a94a6' : '#5a6477';
  const bg = dark ? '#000000' : '#ffffff';
  const border = dark ? '#262c38' : '#e3e7ef';
  const rowBg = dark ? '#161a22' : '#fafbfd';
  const [rows, setRows] = useState<Channel[] | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    void (async (): Promise<void> => {
      const cfg = await loadConfig();
      if (!isConfigured(cfg)) { setError('not configured — open Settings'); return; }
      try { setRows(await listChannels(cfg.daemonUrl, cfg.token)); }
      catch (e) { setError((e as Error).message); }
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
          <Text style={{ color: sub }}>No channels yet.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push({ pathname: '/messenger', params: { line: item.line } })}
          style={({ pressed }) => ({
            backgroundColor: pressed ? border : rowBg,
            flexDirection: 'row', alignItems: 'center', gap: 10,
            paddingHorizontal: 14, paddingVertical: 12,
            borderBottomWidth: 1, borderBottomColor: border,
          })}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: fg, fontSize: 14, fontFamily: 'monospace' }} numberOfLines={1}>
              {channelShortId(item.line)}
            </Text>
            <Text style={{ color: sub, fontSize: 12, marginTop: 4 }} numberOfLines={1}>
              {item.members.map(shortMember).join(' · ')}
            </Text>
          </View>
          <Text style={{ color: sub, fontSize: 12, marginLeft: 8 }}>{fmtTs(item.lastTs)}</Text>
        </Pressable>
      )}
    />
  );
}
