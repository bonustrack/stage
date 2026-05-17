/** Activity feed — live SSE tail of `/api/tail`. Newest at the top. */

import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View, useColorScheme,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityHeader } from '../components/ActivityHeader';
import { EventRow } from '../components/EventRow';
import {
  FilterSheet, emptyFilters, filtersAreEmpty, matchesFilters, type Filters,
} from '../components/FilterSheet';
import { loadConfig, isConfigured, type Config } from '../lib/config';
import { fetchHistoryPage, useTail } from '../lib/sse';
import type { HistoryEntry } from '../lib/types';

const PAGE_SIZE = 20;

export default function Activity(): React.ReactElement {
  const router = useRouter();
  const { chat } = useLocalSearchParams<{ chat?: string }>();
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const [cfg, setCfg] = useState<Config | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [older, setOlder] = useState<HistoryEntry[]>([]);
  const [olderExhausted, setOlderExhausted] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const colors = {
    fg: dark ? '#e8ecf2' : '#1a1f29',
    sub: dark ? '#8a94a6' : '#5a6477',
    bg: dark ? '#0f1115' : '#ffffff',
    accent: '#5aa9ff',
  };

  useFocusEffect(useCallback(() => { void loadConfig().then(setCfg); }, []));

  /** Server-side station filter only when exactly one is selected — saves bandwidth. */
  const serverStation = filters.stations.size === 1
    ? [...filters.stations][0]
    : undefined;

  const tailOpts = useMemo(() => ({
    daemonUrl: cfg?.daemonUrl ?? '',
    token: cfg?.token ?? '',
    as: cfg?.userId || undefined,
    chat: chat || undefined,
    station: serverStation,
    includeWebhooks: filters.includeWebhooks,
  }), [cfg, chat, serverStation, filters.includeWebhooks]);

  const enabled = !!cfg && isConfigured(cfg);
  const { events, status, error, reconnect } = useTail(tailOpts, enabled);

  /** Combine live SSE events with paged-in older history; dedupe by id. */
  const allEvents = useMemo(() => {
    if (older.length === 0) return events;
    const seen = new Set(events.map(e => e.id));
    return [...events, ...older.filter(e => !seen.has(e.id))];
  }, [events, older]);

  const filtered = useMemo(
    () => allEvents.filter(e => matchesFilters(e, filters)),
    [allEvents, filters],
  );
  const visible = filtered.slice(0, visibleCount);

  const onEndReached = useCallback((): void => {
    if (visibleCount < filtered.length) {
      setVisibleCount(c => Math.min(c + PAGE_SIZE, filtered.length));
      return;
    }
    /** Local data exhausted — fetch the next server page. */
    if (olderExhausted || loadingOlder || !cfg) return;
    setLoadingOlder(true);
    /** `before` = count of newest entries the server should skip = entries we already have. */
    const before = events.length + older.length;
    void fetchHistoryPage(cfg.daemonUrl, cfg.token, before, PAGE_SIZE).then(r => {
      setLoadingOlder(false);
      if (!r.ok) { setOlderExhausted(true); return; }
      if (r.entries.length === 0) { setOlderExhausted(true); return; }
      setOlder(prev => {
        const seen = new Set([...events, ...prev].map(e => e.id));
        const fresh = r.entries.filter(e => !seen.has(e.id));
        return [...prev, ...fresh];
      });
      setVisibleCount(c => c + PAGE_SIZE);
    });
  }, [visibleCount, filtered.length, olderExhausted, loadingOlder, cfg, events, older]);

  if (!cfg) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!isConfigured(cfg)) {
    return (
      <View style={{ flex: 1, padding: 24, gap: 16, justifyContent: 'center', backgroundColor: colors.bg }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.fg }}>Welcome to Metro</Text>
        <Text style={{ fontSize: 15, color: colors.sub, lineHeight: 22 }}>
          Set the daemon URL + bearer token to start streaming your activity feed.
        </Text>
        <Pressable
          onPress={() => router.push('/settings')}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#4a8fdf' : colors.accent,
            paddingVertical: 14,
            borderRadius: 8,
            alignItems: 'center',
          })}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Open Settings</Text>
        </Pressable>
      </View>
    );
  }

  const filterActive = !filtersAreEmpty(filters);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ActivityHeader
        status={status}
        error={error}
        count={filtered.length}
        chat={chat}
        filterActive={filterActive}
        onClearChat={() => router.setParams({ chat: undefined })}
        onSettings={() => router.push('/settings')}
        onLines={() => router.push('/lines')}
        onFilter={() => setFilterOpen(true)}
      />
      <FlatList
        data={visible}
        keyExtractor={(e: HistoryEntry) => e.id}
        renderItem={({ item }) => (
          <EventRow
            entry={item}
            onPress={() => router.push({ pathname: '/event/[id]', params: { id: item.id, data: JSON.stringify(item) } })}
          />
        )}
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ color: colors.sub }}>
              {filterActive ? 'No events match the active filters.' : 'Waiting for events…'}
            </Text>
          </View>
        }
        ListFooterComponent={
          loadingOlder ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <ActivityIndicator color={colors.sub} />
            </View>
          ) : olderExhausted && visibleCount >= filtered.length ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ color: colors.sub, fontSize: 11 }}>— end of history —</Text>
            </View>
          ) : null
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={status === 'connecting'}
            onRefresh={() => {
              setOlder([]);
              setOlderExhausted(false);
              setVisibleCount(PAGE_SIZE);
              reconnect();
            }}
            tintColor={colors.sub}
          />
        }
      />
      <FilterSheet
        visible={filterOpen}
        filters={filters}
        onChange={(next) => { setFilters(next); setVisibleCount(PAGE_SIZE); }}
        onClose={() => setFilterOpen(false)}
      />
    </View>
  );
}
