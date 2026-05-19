/** ChatGPT-dark-style chat bubble — right for owner, left for everyone else. */

import { Pressable, Text, View } from 'react-native';
import type { HistoryEntry } from '../lib/types';

const MESSENGER_USER = 'metro://messenger/user/owner';

function fmtTs(ts: string): string {
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch { return ts.slice(11, 16); }
}

export function MessengerBubble({ entry, dark, unread, onPress }: {
  entry: HistoryEntry; dark: boolean; unread: boolean; onPress: () => void;
}): React.ReactElement {
  const mine = entry.from === MESSENGER_USER;
  const bg = mine ? (dark ? '#ffffff' : '#1a1f29') : (dark ? '#2a2d33' : '#eef1f7');
  const fg = mine ? (dark ? '#000000' : '#ffffff') : (dark ? '#e8ecf2' : '#1a1f29');
  return (
    <View style={{
      flexDirection: 'row',
      justifyContent: mine ? 'flex-end' : 'flex-start',
      paddingHorizontal: 12, paddingVertical: 3,
    }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          maxWidth: '78%',
          backgroundColor: bg,
          opacity: pressed ? 0.85 : 1,
          paddingHorizontal: 14, paddingVertical: 9,
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          borderBottomLeftRadius: mine ? 20 : 6,
          borderBottomRightRadius: mine ? 6 : 20,
          borderWidth: unread ? 1.5 : 0,
          borderColor: unread ? (dark ? '#ffffff' : '#1a1f29') : 'transparent',
        })}
      >
        <Text style={{ color: fg, fontSize: 15, lineHeight: 20 }}>
          {entry.text ?? '(no text)'}
        </Text>
        <Text style={{
          color: fg, opacity: 0.55, fontSize: 10, marginTop: 3,
          textAlign: mine ? 'right' : 'left',
        }}>{fmtTs(entry.ts)}</Text>
      </Pressable>
    </View>
  );
}
