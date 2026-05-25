/** Channels tab — XMTP conversations the local wallet is a member of.
 *  Tapping a row pushes into `/xmtp/[convId]` for the full chat view.
 *  Avatar = stamp.box `eth:<peer-address>` for DMs; stacked stamp avatars of
 *  the other members for groups (excluding the local user). Both are resolved
 *  once per conv during the initial list build and cached in component state. */

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Pressable, Text, TextInput, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { Conversation, DecodedMessage } from '@xmtp/react-native-sdk';
import { DevSettings } from 'react-native';
import {
  getOrCreateXmtpClient, resetXmtpClient,
  peerEthAddressOfDm, groupMemberEthAddresses, memberInboxToAddressMap,
  stampBoxAvatarUrl,
  createAskQuestionGroup,
  getLastReadNs,
} from '../../lib/xmtp';
import { resetAccount } from '../../lib/wallet';
import { useEffectiveColorScheme } from '../../lib/theme';
import { getCachedRows, setCachedRows, subscribeCachedRows } from '../../lib/channelsCache';

interface Row {
  convId: string;
  title: string;
  lastTs: number | null;
  lastPreview: string;
  /** Eth address whose stamp.fyi avatar should render in the row. Resolved
   *  to the latest sender when there's a message, else the peer (DMs) or
   *  the first other member (groups). */
  avatarAddress: string | null;
  /** Cached inbox → eth address map, kept so live stream updates can resolve
   *  a new sender's avatar without an extra round-trip. */
  inboxToAddr: Record<string, string>;
  /** Count of messages newer than the per-conv lastReadNs that the LOCAL
   *  user didn't send. 0 hides the badge. */
  unreadCount: number;
  /** Cached lastReadNs — kept so streamAllMessages updates can recompute the
   *  count without a SecureStore round-trip per new msg. */
  lastReadNs: number;
  /** Own inbox id — also needed to filter own messages out of the unread
   *  recount on stream updates. */
  selfInboxId: string;
}

function fmtTs(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

async function summarize(conv: Conversation, selfInboxId: string): Promise<Row> {
  await conv.sync().catch(() => undefined);
  /** Pull the latest 50 messages — enough to compute an accurate unread count
   *  for active conversations without ballooning each row fetch. */
  const recent: DecodedMessage[] = await conv.messages({ limit: 50 }).catch(() => []);
  const msgs = recent;
  const last = msgs[0];
  let preview = '';
  if (last) {
    try {
      const decoded: unknown = last.content();
      preview = typeof decoded === 'string' ? decoded : `[${last.contentTypeId ?? 'unknown'}]`;
    } catch { preview = `[${last.contentTypeId ?? 'unknown'}]`; }
  }
  const peerAddress = await peerEthAddressOfDm(conv);
  const memberAddresses = peerAddress ? [] : await groupMemberEthAddresses(conv);
  const inboxToAddr = await memberInboxToAddressMap(conv);
  const totalMembers = memberAddresses.length + 1;
  const groupName = peerAddress ? '' : await ((conv as unknown as { name?: () => Promise<string> }).name?.() ?? Promise.resolve(''));
  const title = peerAddress
    ?? (groupName && groupName.trim()
      ? groupName.trim()
      : memberAddresses.length > 0
        ? `${totalMembers} member${totalMembers === 1 ? '' : 's'}`
        : conv.topic.replace(/^.*\//, '').slice(0, 12));
  /** Avatar follows the most recent activity. Falls back to the static DM
   *  peer / first other member when there's no message yet. */
  const lastSenderAddress = last?.senderInboxId
    ? inboxToAddr[last.senderInboxId] ?? null
    : null;
  const avatarAddress = lastSenderAddress
    ?? peerAddress
    ?? memberAddresses[0]
    ?? null;
  /** Unread count = msgs newer than the persisted lastReadNs not sent by us. */
  const lastReadNs = await getLastReadNs(conv.id);
  let unreadCount = 0;
  for (const m of msgs) {
    if (!m.sentNs || m.sentNs <= lastReadNs) break;
    if (m.senderInboxId === selfInboxId) continue;
    unreadCount += 1;
  }
  return {
    convId: conv.id,
    title,
    lastTs: last?.sentNs ? Math.floor(last.sentNs / 1_000_000) : null,
    lastPreview: preview.slice(0, 80),
    avatarAddress,
    inboxToAddr,
    unreadCount,
    lastReadNs,
    selfInboxId,
  };
}


/** Channels-list cache lives in lib/channelsCache so the conversation view
 *  can reach in to clear unread on mount without an import cycle. The Row[]
 *  shape is a superset of CachedRow — write through directly. */

export default function Messenger(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const fg = dark ? '#e8ecf2' : '#1a1f29';
  const sub = dark ? '#8a94a6' : '#5a6477';
  const bg = dark ? '#000000' : '#ffffff';
  const border = dark ? '#262c38' : '#e3e7ef';
  const rowBg = dark ? '#161a22' : '#fafbfd';
  const [rows, setRowsState] = useState<Row[] | null>(getCachedRows() as Row[] | null);
  /** Wrap setRows so every state update also lands in the shared cache + fans
   *  out to subscribers (e.g. the conv view'​s markConvRead can mutate the
   *  cache and we'll re-render via the subscription below). */
  const setRows = (next: Row[] | null | ((p: Row[] | null) => Row[] | null)): void => {
    if (typeof next === 'function') {
      setRowsState(prev => {
        const v = (next as (p: Row[] | null) => Row[] | null)(prev);
        setCachedRows(v);
        return v;
      });
    } else {
      setRowsState(next);
      setCachedRows(next);
    }
  };
  useEffect(() => subscribeCachedRows(r => setRowsState(r as Row[] | null)), []);
  const [error, setError] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [creatingAsk, setCreatingAsk] = useState(false);

  const onAskPress = async (): Promise<void> => {
    if (creatingAsk) return;
    setCreatingAsk(true);
    try {
      const convId = await createAskQuestionGroup();
      router.push({ pathname: '/xmtp/[convId]', params: { convId } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreatingAsk(false);
    }
  };

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.title.toLowerCase().includes(q)
      || r.lastPreview.toLowerCase().includes(q)
      || (r.avatarAddress?.toLowerCase().includes(q) ?? false)
      || Object.values(r.inboxToAddr).some(a => a.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  useEffect(() => {
    let cancelled = false;
    let cancelConvStream: (() => void) | null = null;
    let cancelMsgStream: (() => void) | null = null;
    /** Outer init timeout — if XMTP boot+sync hasn't finished in 30s, surface
     *  an error + recovery UI instead of leaving the user staring at a spinner. */
    const initTimer = setTimeout(() => {
      if (cancelled) return;
      setError('XMTP failed to initialise (timed out). Tap Reset below to wipe the local identity and start fresh.');
    }, 30_000);
    void (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        const selfInboxId = client.inboxId;
        await client.conversations.syncAllConversations(['allowed', 'unknown']);
        const convs = await client.conversations.list(undefined, undefined, ['allowed', 'unknown']);
        const summarized = await Promise.all(convs.map(c => summarize(c, selfInboxId)));
        if (cancelled) return;
        clearTimeout(initTimer);
        summarized.sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0));
        setRows(summarized);
        /** Subscribe to newly-created conversations so groups + DMs created
         *  while the tab is mounted show up without a manual refresh. */
        try {
          cancelConvStream = await client.conversations.stream(async (conv) => {
            if (cancelled || !conv) return;
            const r = await summarize(conv, selfInboxId);
            setRows(prev => {
              const next = prev ? [r, ...prev.filter(x => x.convId !== r.convId)] : [r];
              return next;
            });
          }) ?? null;
        } catch { /* stream init failed — the next mount will pick things up */ }
        /** Subscribe to every new message across all convs so the per-row
         *  lastTs + lastPreview reflect activity in real time. */
        try {
          cancelMsgStream = await client.conversations.streamAllMessages(async (msg) => {
            if (cancelled || !msg) return;
            let preview = '';
            try {
              const decoded: unknown = msg.content();
              preview = typeof decoded === 'string' ? decoded : `[${msg.contentTypeId ?? 'unknown'}]`;
            } catch { preview = `[${msg.contentTypeId ?? 'unknown'}]`; }
            const lastTs = msg.sentNs ? Math.floor(msg.sentNs / 1_000_000) : Date.now();
            const lastPreview = preview.slice(0, 80);
            setRows(prev => {
              if (!prev) return prev;
              const idx = prev.findIndex(r => r.convId === msg.conversationId);
              if (idx === -1) return prev;
              const cur = prev[idx]!;
              const newAvatar = cur.inboxToAddr[msg.senderInboxId ?? ''] ?? cur.avatarAddress;
              /** Bump the unread count when the new msg is newer than what we'd
               *  read AND not authored by the local user. */
              const isUnread = (msg.sentNs ?? 0) > cur.lastReadNs
                && msg.senderInboxId !== cur.selfInboxId;
              const unreadCount = isUnread ? cur.unreadCount + 1 : cur.unreadCount;
              const updated = { ...cur, lastTs, lastPreview, avatarAddress: newAvatar, unreadCount };
              const next = [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
              return next;
            });
          }) ?? null;
        } catch { /* message stream init failed — preview will lag */ }
      } catch (e) { setError((e as Error).message); }
    })();
    return (): void => {
      cancelled = true;
      clearTimeout(initTimer);
      if (cancelConvStream) try { cancelConvStream(); } catch { /* ignore */ }
      if (cancelMsgStream) try { cancelMsgStream(); } catch { /* ignore */ }
    };
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: bg }}>
        <Text style={{ color: fg, fontSize: 15, textAlign: 'center', marginBottom: 16 , fontFamily: 'Calibre-Medium'}}>{error}</Text>
        <Pressable
          onPress={() => {
            void (async (): Promise<void> => {
              await resetXmtpClient();
              await resetAccount();
              DevSettings.reload?.();
            })();
          }}
          style={({ pressed }) => ({
            paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999,
            backgroundColor: pressed ? '#5c2231' : 'transparent',
            borderWidth: 1, borderColor: dark ? '#5c2231' : '#e9bbc4',
          })}
        >
          <Text style={{ color: dark ? '#ff6b80' : '#b91c1c', fontSize: 14 , fontFamily: 'Calibre-Medium'}}>
            Reset XMTP identity
          </Text>
        </Pressable>
      </View>
    );
  }
  if (!rows) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
        <ActivityIndicator />
        <Text style={{ color: sub, marginTop: 8, fontSize: 12 , fontFamily: 'Calibre-Medium'}}>Initialising XMTP…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search channels…"
          placeholderTextColor={sub}
          autoCorrect={false}
          autoCapitalize="none"
          style={{
            backgroundColor: rowBg,
            borderWidth: 1, borderColor: border, borderRadius: 10,
            paddingHorizontal: 12, paddingVertical: 8,
            color: fg, fontSize: 14,
          }}
        />
      </View>
      <FlatList
        data={filtered ?? rows}
        keyExtractor={r => r.convId}
        /** Leave room at the bottom for the floating "Ask a question" pill. */
        contentContainerStyle={{ paddingBottom: 88 }}
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ color: sub, textAlign: 'center' }}>
              {query ? `No matches for "${query}"` : 'No conversations yet. Share your address from Settings to start one.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/xmtp/[convId]', params: { convId: item.convId } })}
            style={({ pressed }) => ({
              backgroundColor: pressed ? border : 'transparent',
              flexDirection: 'row', alignItems: 'center', gap: 12,
              paddingHorizontal: 14, paddingVertical: 12,
              borderBottomWidth: 1, borderBottomColor: border,
            })}
          >
            {item.avatarAddress ? (
              <Image
                source={{ uri: stampBoxAvatarUrl(item.avatarAddress, 64) }}
                style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: '#1a1f29' }}
              />
            ) : (
              <View style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: '#1a1f29' }} />
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text style={{ color: fg, fontSize: 18, fontFamily: 'Calibre-Semibold', flex: 1 }} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>{fmtTs(item.lastTs)}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <Text style={{ color: sub, fontSize: 15, fontFamily: 'Calibre-Medium', flex: 1 }} numberOfLines={1}>
                  {item.lastPreview || '(no messages yet)'}
                </Text>
                {item.unreadCount > 0 ? (
                  <View style={{
                    minWidth: 22, height: 22, borderRadius: 999, backgroundColor: '#ffffff',
                    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7,
                  }}>
                    <Text style={{ color: '#000000', fontSize: 12, fontFamily: 'Calibre-Semibold' }}>
                      {item.unreadCount > 99 ? '99+' : item.unreadCount}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        )}
      />
      {/** Floating "Ask a question" pill — full-width, anchored above the tab
       *   bar so it stays reachable while the channel list scrolls underneath. */}
      <Pressable
        onPress={() => { void onAskPress(); }}
        disabled={creatingAsk}
        style={({ pressed }) => ({
          position: 'absolute', left: 16, right: 16, bottom: 16,
          backgroundColor: '#ffffff',
          borderRadius: 999, paddingVertical: 14,
          alignItems: 'center', justifyContent: 'center',
          shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
          elevation: 4,
          opacity: pressed ? 0.85 : creatingAsk ? 0.6 : 1,
        })}
      >
        <Text style={{ color: '#000000', fontSize: 16, fontFamily: 'Calibre-Medium' }}>
          {creatingAsk ? 'Creating group…' : 'Ask a question'}
        </Text>
      </Pressable>
    </View>
  );
}
