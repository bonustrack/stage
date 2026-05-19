/** Activity-feed header bar: connection dot, count, and navigation pressables. */

import { Pressable, Text, View, useColorScheme } from 'react-native';

const LINK = { color: '#5aa9ff', fontSize: 13, fontWeight: '600' as const };

export function ActivityHeader({
  status, error, count, chat, filterActive,
  onClearChat, onFilter,
}: {
  status: string; error: string | null; count: number;
  chat?: string; filterActive: boolean;
  onClearChat: () => void; onFilter: () => void;
}): React.ReactElement {
  const dark = useColorScheme() === 'dark';
  const sub = dark ? '#8a94a6' : '#5a6477';
  const dotColor = status === 'open' ? '#83c989' : status === 'connecting' ? '#c0a06e' : '#d96868';
  return (
    <View style={{
      gap: 6, paddingHorizontal: 14, paddingVertical: 8,
      borderBottomWidth: 1, borderBottomColor: dark ? '#262c38' : '#e3e7ef',
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor }} />
        <Text style={{ color: sub, fontSize: 12 }}>
          {status}{error ? ` · ${error}` : ''} · {count} event{count === 1 ? '' : 's'}
        </Text>
        <View style={{ flex: 1 }} />
        <Pressable onPress={onFilter} hitSlop={8}>
          <Text style={{
            ...LINK, color: filterActive ? '#83c989' : LINK.color,
            fontWeight: filterActive ? '700' : '600',
          }}>Filter{filterActive ? ' •' : ''}</Text>
        </Pressable>
      </View>
      {chat ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: sub, fontSize: 11 }} numberOfLines={1}>
            filter: {chat.replace(/^metro:\/\//, '')}
          </Text>
          <Pressable onPress={onClearChat} hitSlop={6}>
            <Text style={{ ...LINK, fontSize: 11 }}>clear</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
