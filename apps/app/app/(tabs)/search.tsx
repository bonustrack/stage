/** Search — substring filter across recent history. Loads one page on mount, refilters as you type. */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Text, TextInput, View, useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { EventRow } from '../../components/EventRow';
import { matchesSearch } from '../../components/SearchBar';
import { loadConfig, isConfigured, type Config } from '../../lib/config';
import { fetchHistoryPage } from '../../lib/sse';
import type { HistoryEntry } from '../../lib/types';

const PAGE_SIZE = 200;

export default function Search(): React.ReactElement {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const fg = dark ? '#e8ecf2' : '#1a1f29';
  const sub = dark ? '#8a94a6' : '#5a6477';
  const bg = dark ? '#0f1115' : '#ffffff';
  const border = dark ? '#1f2630' : '#e5e9f0';

  const [cfg, setCfg] = useState<Config | null>(null);
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [query, setQuery] = useState('');
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => { void loadConfig().then(setCfg); }, []);

  const reload = useCallback(async (c: Config) => {
    setLoadErr(null);
    const res = await fetchHistoryPage(c.daemonUrl, c.token, Date.now(), PAGE_SIZE);
    if (!res.ok) { setLoadErr(`failed (${res.status}): ${res.error}`); return; }
    setEntries(res.entries);
  }, []);

  useEffect(() => { if (cfg && isConfigured(cfg)) void reload(cfg); }, [cfg, reload]);

  const results = useMemo(
    () => (entries ?? []).filter(e => matchesSearch(e, query)),
    [entries, query],
  );

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <View style={{ padding: 12, borderBottomColor: border, borderBottomWidth: 1 }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search messages…"
          placeholderTextColor={sub}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            backgroundColor: dark ? '#16191f' : '#f3f5f9',
            color: fg,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 10,
            fontSize: 15,
          }}
        />
      </View>

      {cfg && !isConfigured(cfg) ? (
        <Text style={{ color: sub, textAlign: 'center', padding: 24 }}>
          Open Settings and set the daemon URL + token first.
        </Text>
      ) : loadErr ? (
        <Text style={{ color: '#ff6b6b', textAlign: 'center', padding: 24 }}>{loadErr}</Text>
      ) : entries === null ? (
        <View style={{ paddingTop: 24, alignItems: 'center' }}><ActivityIndicator color={fg} /></View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={e => e.id}
          renderItem={({ item }) => (
            <EventRow
              entry={item}
              onPress={() => router.push({ pathname: '/event/[id]', params: { id: item.id, data: JSON.stringify(item) } })}
            />
          )}
          ListEmptyComponent={
            <Text style={{ color: sub, textAlign: 'center', padding: 24 }}>
              {query ? 'No matches.' : `Loaded ${entries.length} recent events — type to search.`}
            </Text>
          }
          contentContainerStyle={results.length === 0 ? { flexGrow: 1 } : undefined}
        />
      )}
    </View>
  );
}
