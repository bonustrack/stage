import { Pressable, Text, View, useColorScheme } from 'react-native';
import { StationIcon } from './StationIcon';
import type { HistoryEntry } from '../lib/types';

const MAX_BODY = 140;

function bodyOf(e: HistoryEntry): string {
  if (e.text) return e.text;
  if (e.emoji) return `[react ${e.emoji}]`;
  return '(no text)';
}

function shortLine(line: string): string {
  /** Drop the `metro://` prefix for compactness. */
  return line.replace(/^metro:\/\//, '');
}

function shortSender(e: HistoryEntry): string {
  const name = e.fromName ?? e.from;
  return name.replace(/^metro:\/\//, '');
}

function fmtTs(ts: string): string {
  /** ISO timestamp → HH:MM:SS, in local time (Date does the conversion). */
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour12: false });
  } catch {
    return ts.slice(11, 19);
  }
}

export function EventRow({
  entry,
  onPress,
}: {
  entry: HistoryEntry;
  onPress: () => void;
}): React.ReactElement {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const colors = {
    fg: dark ? '#e8ecf2' : '#1a1f29',
    sub: dark ? '#8a94a6' : '#5a6477',
    bg: dark ? '#161a22' : '#fafbfd',
    border: dark ? '#262c38' : '#e3e7ef',
  };
  const body = bodyOf(entry);
  const trunc = body.length > MAX_BODY ? body.slice(0, MAX_BODY - 1) + '…' : body;
  const kindColor = entry.kind === 'inbound' ? '#5aa9ff' : entry.kind === 'outbound' ? '#83c989' : '#c0a06e';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? (dark ? '#1d2230' : '#eef1f7') : colors.bg,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <StationIcon station={entry.station} />
        <Text style={{ fontSize: 11, fontWeight: '600', color: kindColor }}>{entry.kind}</Text>
        <Text style={{ fontSize: 11, color: colors.sub, flex: 1 }} numberOfLines={1}>
          {shortSender(entry)}
        </Text>
        <Text style={{ fontSize: 11, color: colors.sub }}>{fmtTs(entry.ts)}</Text>
      </View>
      <Text style={{ fontSize: 11, color: colors.sub, marginBottom: 2 }} numberOfLines={1}>
        {entry.lineName ?? shortLine(entry.line)}
      </Text>
      <Text style={{ fontSize: 14, color: colors.fg }} numberOfLines={3}>
        {trunc}
      </Text>
    </Pressable>
  );
}
