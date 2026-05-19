/** Messenger — direct chat with the assistant via `POST /api/messenger/send`. */

import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View, useColorScheme } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MessengerBubble } from '../../components/MessengerBubble';
import { MessengerComposer } from '../../components/MessengerComposer';
import { loadConfig, isConfigured, type Config } from '../../lib/config';
import {
  isReaction, isTranscript, reactMessenger, reactionsByMessage, transcriptsByMessage,
} from '../../lib/messenger';
import { getMessengerLastRead, markMessengerRead } from '../../lib/messenger-unread';
import { registerForPush } from '../../lib/push';
import { useTail } from '../../lib/sse';

const MESSENGER_LINE = 'metro://messenger/owner';
const MESSENGER_USER = 'metro://messenger/user/owner';

export default function Messenger(): React.ReactElement {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const fg = dark ? '#e8ecf2' : '#1a1f29';
  const sub = dark ? '#8a94a6' : '#5a6477';
  const bg = dark ? '#000000' : '#ffffff';

  const [cfg, setCfg] = useState<Config | null>(null);
  /** Captured once on mount → entries newer than this render with the unread style. */
  const [unreadCutoff] = useState(() => getMessengerLastRead());

  useFocusEffect(useCallback(() => {
    void loadConfig().then(c => {
      setCfg(c);
      if (c && isConfigured(c)) void registerForPush(c.daemonUrl, c.token).catch(() => { /* ignore */ });
    });
    void markMessengerRead();
  }, []));

  const tailOpts = useMemo(() => ({
    daemonUrl: cfg?.daemonUrl ?? '', token: cfg?.token ?? '',
    chat: MESSENGER_LINE, includeWebhooks: false,
  }), [cfg]);

  const enabled = !!cfg && isConfigured(cfg);
  const { events, reconnect, status } = useTail(tailOpts, enabled);
  /** Re-fetch the seed every time the tab regains focus so stale events get refreshed. */
  useFocusEffect(useCallback(() => { if (enabled) reconnect(); }, [enabled, reconnect]));
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    reconnect();
    /** useTail.reconnect is sync; brief spinner pretends until the next render delivers seed. */
    setTimeout(() => setRefreshing(false), 600);
  }, [reconnect]);

  /** Reaction + transcript events decorate their target msg — don't render as their own bubbles. */
  const reactions = useMemo(() => reactionsByMessage(events), [events]);
  const transcripts = useMemo(() => transcriptsByMessage(events), [events]);
  const bubbleEvents = useMemo(
    () => events.filter(e => !isReaction(e) && !isTranscript(e)),
    [events],
  );
  const onReact = useCallback((messageId: string, emoji: string) => {
    if (!cfg) return;
    void reactMessenger(cfg.daemonUrl, cfg.token, messageId, emoji)
      .catch((e: unknown) => { console.warn('react failed', e); });
  }, [cfg]);

  if (cfg && !isConfigured(cfg)) {
    return (
      <View style={{ flex: 1, padding: 24, gap: 12, justifyContent: 'center', backgroundColor: bg }}>
        <Text style={{ color: fg, fontSize: 18, fontWeight: '700' }}>Set up first</Text>
        <Text style={{ color: sub, lineHeight: 22 }}>
          Open Settings and configure the daemon URL + bearer token to chat with the assistant.
        </Text>
        <Pressable
          onPress={() => router.push('/settings')}
          style={{ backgroundColor: '#ffffff', paddingVertical: 12, borderRadius: 999, alignItems: 'center' }}
        >
          <Text style={{ color: '#000', fontWeight: '700' }}>Open Settings</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <FlatList
        data={bubbleEvents}
        inverted
        keyExtractor={e => e.id}
        /** Inverted list: paddingTop is visually the BOTTOM — leave room for the floating composer
         *  plus a comfortable gap so the latest message doesn't hug the composer card. */
        contentContainerStyle={{ paddingTop: 140, paddingBottom: 6 }}
        renderItem={({ item }) => (
          <MessengerBubble
            entry={item}
            dark={dark}
            unread={item.from !== MESSENGER_USER && item.station === 'messenger' && item.ts > unreadCutoff}
            daemonUrl={cfg?.daemonUrl ?? ''}
            token={cfg?.token ?? ''}
            reactions={reactions.get(item.id)}
            transcript={transcripts.get(item.id)}
            onReact={(emoji) => onReact(item.id, emoji)}
            onPress={() => router.push({ pathname: '/event/[id]', params: { id: item.id, data: JSON.stringify(item) } })}
          />
        )}
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ color: sub }}>Type a message below to start chatting.</Text>
          </View>
        }
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={sub} />}
      />
      {status !== 'open' && enabled ? (
        <View style={{
          position: 'absolute', top: 8, alignSelf: 'center',
          flexDirection: 'row', alignItems: 'center', gap: 6,
          paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
          backgroundColor: dark ? 'rgba(40,46,58,0.92)' : 'rgba(238,241,247,0.95)',
        }}>
          <View style={{
            width: 6, height: 6, borderRadius: 999,
            backgroundColor: status === 'connecting' ? '#c0a06e' : '#d96868',
          }} />
          <Text style={{ color: sub, fontSize: 11 }}>
            {status === 'connecting' ? 'Connecting…' : status === 'error' ? 'Reconnecting…' : 'Offline'}
          </Text>
        </View>
      ) : null}
      {cfg ? (
        /** Absolute-positioned so messages flow under it (Claude-mobile style). */
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
          <MessengerComposer daemonUrl={cfg.daemonUrl} token={cfg.token} dark={dark} />
        </View>
      ) : null}
    </View>
  );
}
