/** Activity-feed header bar: connection dot, count, and navigation pressables. */

import { Pressable, Text, View, useColorScheme } from 'react-native';

export function ActivityHeader({
  status,
  error,
  count,
  chat,
  filterActive,
  onClearChat,
  onSettings,
  onLines,
  onFilter,
}: {
  status: string;
  error: string | null;
  count: number;
  chat?: string;
  filterActive: boolean;
  onClearChat: () => void;
  onSettings: () => void;
  onLines: () => void;
  onFilter: () => void;
}): React.ReactElement {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const dotColor = status === 'open' ? '#83c989' : status === 'connecting' ? '#c0a06e' : '#d96868';
  return (
    <View
      style={{
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: dark ? '#262c38' : '#e3e7ef',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor }} />
        <Text style={{ color: dark ? '#8a94a6' : '#5a6477', fontSize: 12 }}>
          {status}
          {error ? ` · ${error}` : ''}
          {' · '}{count} event{count === 1 ? '' : 's'}
        </Text>
        <View style={{ flex: 1 }} />
        <Pressable onPress={onFilter} hitSlop={8}>
          <Text style={{
            color: filterActive ? '#83c989' : '#5aa9ff',
            fontSize: 13,
            fontWeight: filterActive ? '700' : '600',
          }}>
            Filter{filterActive ? ' •' : ''}
          </Text>
        </Pressable>
        <Pressable onPress={onLines} hitSlop={8}>
          <Text style={{ color: '#5aa9ff', fontSize: 13, fontWeight: '600' }}>Lines</Text>
        </Pressable>
        <Pressable onPress={onSettings} hitSlop={8}>
          <Text style={{ color: '#5aa9ff', fontSize: 13, fontWeight: '600' }}>Settings</Text>
        </Pressable>
      </View>
      {chat ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: dark ? '#8a94a6' : '#5a6477', fontSize: 11 }} numberOfLines={1}>
            filter: {chat.replace(/^metro:\/\//, '')}
          </Text>
          <Pressable onPress={onClearChat} hitSlop={6}>
            <Text style={{ color: '#5aa9ff', fontSize: 11, fontWeight: '600' }}>clear</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
