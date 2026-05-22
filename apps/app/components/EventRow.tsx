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

  const fg = dark ? '#e8ecf2' : '#1a1f29';
  const bubbleBg = dark ? '#16191f' : '#f3f5f9';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 14, paddingVertical: 6,
        opacity: pressed ? 0.7 : 1,
        flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      })}
    >
      <View style={{ paddingTop: 4 }}><StationIcon station={entry.station} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text style={{ fontSize: 13, color: fg, fontFamily: 'Calibre-Semibold' }} numberOfLines={1}>{sender}</Text>
          <Text style={{ fontSize: 11, color: sub }}>{fmtTs(entry.ts)}</Text>
        </View>
        <Text style={{ fontSize: 11, color: sub }} numberOfLines={1}>
          {entry.lineName ?? entry.line.replace(/^metro:\/\//, '')}
        </Text>
        {/** Messenger-style bubble for the body. */}
        <View style={{
          backgroundColor: bubbleBg, paddingHorizontal: 12, paddingVertical: 8,
          borderRadius: 16, borderTopLeftRadius: 4, marginTop: 4,
          borderLeftWidth: unread ? 2 : 0, borderLeftColor: unread ? '#ffffff' : 'transparent',
        }}>
          <Text style={{ fontSize: 15, color: fg, lineHeight: 21 }} numberOfLines={4}>
            {trunc}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
