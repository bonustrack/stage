/** Event detail — receives the entry as a stringified `data` query param. Read-only. */

import { ScrollView, Text, View, useColorScheme } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { HistoryEntry } from '../../lib/types';

export default function EventDetail(): React.ReactElement {
  const { data } = useLocalSearchParams<{ id: string; data?: string }>();
  const dark = useColorScheme() === 'dark';
  const fg = dark ? '#e8ecf2' : '#1a1f29';
  const sub = dark ? '#8a94a6' : '#5a6477';
  const bg = dark ? '#000000' : '#ffffff';

  let entry: HistoryEntry | null = null;
  if (data) { try { entry = JSON.parse(data) as HistoryEntry; } catch { /* leave null */ } }
  if (!entry) {
    return (
      <View style={{ flex: 1, padding: 24, backgroundColor: bg }}>
        <Text style={{ color: fg }}>Event data unavailable.</Text>
      </View>
    );
  }

  const rows: [string, string][] = [
    ['id', entry.id], ['ts', entry.ts], ['kind', entry.kind], ['station', entry.station],
    ['line', entry.line], ['lineName', entry.lineName ?? ''],
    ['from', entry.from], ['fromName', entry.fromName ?? ''],
    ['to', entry.to],
    ['messageId', entry.messageId ?? ''], ['replyTo', entry.replyTo ?? ''], ['emoji', entry.emoji ?? ''],
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ padding: 16 }}>
      {entry.text ? (
        <View style={{ marginBottom: 18 }}>
          <Text style={{ color: sub, fontSize: 12, marginBottom: 6 }}>text</Text>
          <Text style={{ color: fg, fontSize: 15, lineHeight: 22 }}>{entry.text}</Text>
        </View>
      ) : null}
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <View key={k} style={{ marginBottom: 10 }}>
          <Text style={{ color: sub, fontSize: 11, marginBottom: 2 }}>{k}</Text>
          <Text style={{ color: fg, fontSize: 13, fontFamily: 'monospace' }} selectable>{v}</Text>
        </View>
      ))}
      {entry.display ? (
        <View style={{ marginTop: 12 }}>
          <Text style={{ color: sub, fontSize: 11, marginBottom: 4 }}>display</Text>
          <View style={{ backgroundColor: dark ? '#161a22' : '#f3f5f9', padding: 10, borderRadius: 6 }}>
            <Text style={{ color: fg, fontSize: 12, fontFamily: 'monospace' }} selectable>
              {entry.display}
            </Text>
          </View>
        </View>
      ) : null}
      {entry.payload ? (
        <View style={{ marginTop: 12 }}>
          <Text style={{ color: sub, fontSize: 11, marginBottom: 4 }}>payload</Text>
          <View style={{ backgroundColor: dark ? '#161a22' : '#f3f5f9', padding: 10, borderRadius: 6 }}>
            <Text style={{ color: fg, fontSize: 12, fontFamily: 'monospace' }} selectable>
              {JSON.stringify(entry.payload, null, 2)}
            </Text>
          </View>
        </View>
      ) : null}
      <View style={{ marginTop: 12 }}>
        <Text style={{ color: sub, fontSize: 11, marginBottom: 4 }}>raw</Text>
        <View style={{ backgroundColor: dark ? '#161a22' : '#f3f5f9', padding: 10, borderRadius: 6 }}>
          <Text style={{ color: fg, fontSize: 12, fontFamily: 'monospace' }} selectable>
            {JSON.stringify(entry, null, 2)}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
