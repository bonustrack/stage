/** Activity-feed search bar. Case-insensitive substring on text/fromName/lineName. */

import { Pressable, Text, TextInput, View, useColorScheme } from 'react-native';
import type { HistoryEntry } from '../lib/types';

export function matchesSearch(e: HistoryEntry, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (e.text?.toLowerCase().includes(q)) return true;
  if (e.fromName?.toLowerCase().includes(q)) return true;
  if (e.lineName?.toLowerCase().includes(q)) return true;
  return false;
}

export function SearchBar({
  value, onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}): React.ReactElement {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const colors = {
    fg: dark ? '#e8ecf2' : '#1a1f29',
    sub: dark ? '#8a94a6' : '#5a6477',
    bg: dark ? '#161a22' : '#fafbfd',
    border: dark ? '#262c38' : '#e3e7ef',
    accent: '#5aa9ff',
  };
  return (
    <View style={{
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    }}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Search messages, senders, lines…"
        placeholderTextColor={colors.sub}
        autoCorrect={false}
        autoCapitalize="none"
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          color: colors.fg,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          fontSize: 14,
        }}
      />
      {value ? (
        <Pressable onPress={() => onChange('')} hitSlop={8}>
          <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>Clear</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
