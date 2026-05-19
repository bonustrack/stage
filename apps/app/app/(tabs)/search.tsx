/** Search — live SSE tail with a query box. Same data source as Home, search-first UX. */

import { useCallback, useMemo, useState } from 'react';
import { FlatList, Text, View, useColorScheme } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { EventRow } from '../../components/EventRow';
import { SearchBar, matchesSearch } from '../../components/SearchBar';
import { loadConfig, isConfigured, type Config } from '../../lib/config';
import { useTail } from '../../lib/sse';

export default function Search(): React.ReactElement {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const sub = dark ? '#8a94a6' : '#5a6477';
  const bg = dark ? '#000000' : '#ffffff';

  const [cfg, setCfg] = useState<Config | null>(null);
  const [query, setQuery] = useState('');

  useFocusEffect(useCallback(() => { void loadConfig().then(setCfg); }, []));

  const tailOpts = useMemo(() => ({
    daemonUrl: cfg?.daemonUrl ?? '', token: cfg?.token ?? '',
    as: cfg?.userId || undefined, includeWebhooks: true,
  }), [cfg]);

  const enabled = !!cfg && isConfigured(cfg);
  const { events } = useTail(tailOpts, enabled);

  const results = useMemo(
    () => (query ? events.filter(e => matchesSearch(e, query)) : events),
    [events, query],
  );

  if (cfg && !isConfigured(cfg)) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center', backgroundColor: bg }}>
        <Text style={{ color: sub, textAlign: 'center' }}>
          Open Settings and set the daemon URL + token first.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <SearchBar value={query} onChange={setQuery} />
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
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ color: sub }}>
              {query ? 'No matches.' : 'Type to search the live event stream…'}
            </Text>
          </View>
        }
      />
    </View>
  );
}
