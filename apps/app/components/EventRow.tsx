import { Pressable, Text, View, useColorScheme } from 'react-native';
import { StationIcon } from './StationIcon';
import type { HistoryEntry } from '../lib/types';

const MAX_BODY = 140;

function fmtTs(ts: string): string {
  /** ISO timestamp → HH:MM:SS, in local time (Date does the conversion). */
  try { return new Date(ts).toLocaleTimeString([], { hour12: false }); }
  catch { return ts.slice(11, 19); }
}

export function EventRow({ entry, onPress, unread = false }: {
  entry: HistoryEntry; onPress: () => void; unread?: boolean;
}): React.ReactElement {
  const dark = useColorScheme() === 'dark';
  const sub = dark ? '#8a94a6' : '#5a6477';
  const body = entry.text ?? '(no text)';
  const trunc = body.length > MAX_BODY ? body.slice(0, MAX_BODY - 1) + '…' : body;
  const sender = (entry.fromName ?? entry.from).replace(/^metro:\/\//, '');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? (dark ? '#1d2230' : '#eef1f7') : (dark ? '#161a22' : '#fafbfd'),
        paddingHorizontal: 14, paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: dark ? '#262c38' : '#e3e7ef',
        borderLeftWidth: unread ? 3 : 0,
        borderLeftColor: unread ? '#ffffff' : 'transparent',
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <StationIcon station={entry.station} />
        <Text style={{ fontSize: 11, color: sub, flex: 1 }} numberOfLines={1}>{sender}</Text>
        <Text style={{ fontSize: 11, color: sub }}>{fmtTs(entry.ts)}</Text>
      </View>
      <Text style={{ fontSize: 11, color: sub, marginBottom: 2 }} numberOfLines={1}>
        {entry.lineName ?? entry.line.replace(/^metro:\/\//, '')}
      </Text>
      <Text style={{ fontSize: 14, color: dark ? '#e8ecf2' : '#1a1f29' }} numberOfLines={3}>
        {trunc}
      </Text>
    </Pressable>
  );
}
