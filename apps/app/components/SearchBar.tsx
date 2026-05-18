/** Activity-feed search bar. Case-insensitive substring on text/fromName/lineName. */

import { Pressable, Text, TextInput, View, useColorScheme } from 'react-native';
import type { HistoryEntry } from '../lib/types';

export function matchesSearch(e: HistoryEntry, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return !!(e.text?.toLowerCase().includes(q)
    || e.fromName?.toLowerCase().includes(q)
    || e.lineName?.toLowerCase().includes(q));
}

export function SearchBar({ value, onChange }: {
  value: string; onChange: (v: string) => void;
}): React.ReactElement {
  const dark = useColorScheme() === 'dark';
  const border = dark ? '#262c38' : '#e3e7ef';
  return (
    <View style={{
      paddingHorizontal: 14, paddingVertical: 8,
      borderBottomWidth: 1, borderBottomColor: border,
      flexDirection: 'row', alignItems: 'center', gap: 8,
    }}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Search messages, senders, lines…"
        placeholderTextColor={dark ? '#8a94a6' : '#5a6477'}
        autoCorrect={false}
        autoCapitalize="none"
        style={{
          flex: 1,
          backgroundColor: dark ? '#161a22' : '#fafbfd',
          color: dark ? '#e8ecf2' : '#1a1f29',
          borderWidth: 1, borderColor: border, borderRadius: 8,
          paddingHorizontal: 12, paddingVertical: 8, fontSize: 14,
        }}
      />
      {value ? (
        <Pressable onPress={() => onChange('')} hitSlop={8}>
          <Text style={{ color: '#5aa9ff', fontSize: 13, fontWeight: '600' }}>Clear</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
