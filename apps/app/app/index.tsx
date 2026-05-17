/**
 * Activity feed — live SSE tail of `/api/tail`. Newest at the top.
 *
 * On mount: load config; if unconfigured, point the user at /settings. Once
 * configured, open the SSE stream and accumulate events into a FlatList.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View, useColorScheme,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { EventRow } from '../components/EventRow';
import { loadConfig, isConfigured, type Config } from '../lib/config';
import { useTail } from '../lib/sse';
import type { HistoryEntry } from '../lib/types';

export default function Activity(): React.ReactElement {
  const router = useRouter();
  const { chat } = useLocalSearchParams<{ chat?: string }>();
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const [cfg, setCfg] = useState<Config | null>(null);
  const colors = {
    fg: dark ? '#e8ecf2' : '#1a1f29',
    sub: dark ? '#8a94a6' : '#5a6477',
    bg: dark ? '#0f1115' : '#ffffff',
    accent: '#5aa9ff',
  };

  useFocusEffect(useCallback(() => { void loadConfig().then(setCfg); }, []));

  const tailOpts = useMemo(() => ({
    daemonUrl: cfg?.daemonUrl ?? '',
    token: cfg?.token ?? '',
    as: cfg?.userId || undefined,
    chat: chat || undefined,
    includeWebhooks: true,
  }), [cfg, chat]);

  const enabled = !!cfg && isConfigured(cfg);
  const { events, status, error, reconnect } = useTail(tailOpts, enabled);

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header
        status={status}
        error={error}
        count={events.length}
        chat={chat}
        onClearChat={() => router.setParams({ chat: undefined })}
        onSettings={() => router.push('/settings')}
        onLines={() => router.push('/lines')}
      />
      <FlatList
        data={events}
        keyExtractor={(e: HistoryEntry) => e.id}
        renderItem={({ item }) => (
          <EventRow
            entry={item}
            onPress={() => router.push({ pathname: '/event/[id]', params: { id: item.id, data: JSON.stringify(item) } })}
          />
        )}
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ color: colors.sub }}>Waiting for events…</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={status === 'connecting'}
            onRefresh={reconnect}
            tintColor={colors.sub}
          />
        }
      />
    </View>
  );
}

function Header({
  status,
  error,
  count,
  chat,
  onClearChat,
  onSettings,
  onLines,
}: {
  status: string;
  error: string | null;
  count: number;
  chat?: string;
  onClearChat: () => void;
  onSettings: () => void;
  onLines: () => void;
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
