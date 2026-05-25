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
import {
  getOrCreateXmtpClient, peerEthAddressOfDm, groupMemberEthAddresses, stampBoxAvatarUrl,
  createAskQuestionGroup,
} from '../../lib/xmtp';
import { useEffectiveColorScheme } from '../../lib/theme';

interface Row {
  convId: string;
  title: string;
  lastTs: number | null;
  lastPreview: string;
  /** DM peer's eth address. Null for group convs. */
  peerAddress: string | null;
  /** Other members' eth addresses for group convs (excludes the local user). Empty for DMs. */
  memberAddresses: string[];
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

async function summarize(conv: Conversation): Promise<Row> {
  const msgs: DecodedMessage[] = await conv.messages({ limit: 1 }).catch(() => []);
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
  /** memberAddresses excludes the local wallet — the title is a human count of
   *  the WHOLE group so add 1 back in for the user themselves. */
  const totalMembers = memberAddresses.length + 1;
  const title = peerAddress
    ?? (memberAddresses.length > 0
      ? `${totalMembers} member${totalMembers === 1 ? '' : 's'}`
      : conv.topic.replace(/^.*\//, '').slice(0, 12));
  return {
    convId: conv.id,
    title,
    lastTs: last?.sentNs ? Math.floor(last.sentNs / 1_000_000) : null,
    lastPreview: preview.slice(0, 80),
    peerAddress,
    memberAddresses,
  };
}

const AVATAR_PX = 36;

function SingleAvatar({ address }: { address: string }): React.ReactElement {
  return (
    <Image
      source={{ uri: stampBoxAvatarUrl(address) }}
      style={{ width: AVATAR_PX, height: AVATAR_PX, borderRadius: 999, backgroundColor: '#1a1f29' }}
    />
  );
}

/** Multi-member avatar stack — overlapping stamp.box circles. Up to 3 members
 *  are rendered; if there are more, the third slot becomes a "+N" count tile.
 *  Fits inside the same 36px square a single avatar uses so row geometry doesn't
 *  shift between DM and group rows. */
function GroupAvatarStack({ addresses, bg }: {
  addresses: string[]; bg: string;
}): React.ReactElement {
  const visible = addresses.slice(0, 3);
  const overflow = addresses.length - 3;
  const size = visible.length === 1 ? AVATAR_PX : 24;
  const overlap = 8;

  if (visible.length === 0) {
    return (
      <View style={{
        width: AVATAR_PX, height: AVATAR_PX, borderRadius: 999,
        backgroundColor: '#3a4250',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: '#ffffff', fontSize: 16, fontFamily: 'Calibre-Semibold' }}>·</Text>
      </View>
    );
  }

  return (
    <View style={{ width: AVATAR_PX, height: AVATAR_PX, flexDirection: 'row', alignItems: 'center' }}>
      {visible.map((addr, i) => (
        <Image
          key={addr.toLowerCase()}
          source={{ uri: stampBoxAvatarUrl(addr) }}
          style={{
            width: size, height: size, borderRadius: 999,
            backgroundColor: '#1a1f29',
            borderWidth: 2, borderColor: bg,
            marginLeft: i === 0 ? 0 : -overlap,
          }}
        />
      ))}
      {overflow > 0 ? (
        <View
          style={{
            width: size, height: size, borderRadius: 999,
            backgroundColor: '#3a4250',
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 2, borderColor: bg,
            marginLeft: -overlap,
          }}
        >
          <Text style={{ color: '#ffffff', fontSize: 10, fontFamily: 'Calibre-Semibold' }}>
            +{overflow}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function RowAvatar({ peerAddress, memberAddresses, rowBg }: {
  peerAddress: string | null; memberAddresses: string[]; rowBg: string;
}): React.ReactElement {
  if (peerAddress) return <SingleAvatar address={peerAddress} />;
  if (memberAddresses.length === 1) return <SingleAvatar address={memberAddresses[0]!} />;
  return <GroupAvatarStack addresses={memberAddresses} bg={rowBg} />;
}

export default function Messenger(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const fg = dark ? '#e8ecf2' : '#1a1f29';
  const sub = dark ? '#8a94a6' : '#5a6477';
  const bg = dark ? '#000000' : '#ffffff';
  const border = dark ? '#262c38' : '#e3e7ef';
  const rowBg = dark ? '#161a22' : '#fafbfd';
  const [rows, setRows] = useState<Row[] | null>(null);
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
      || (r.peerAddress?.toLowerCase().includes(q) ?? false)
      || r.memberAddresses.some(a => a.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  useEffect(() => {
    let cancelled = false;
    let cancelConvStream: (() => void) | null = null;
    let cancelMsgStream: (() => void) | null = null;
    void (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        await client.conversations.syncAllConversations(['allowed', 'unknown']);
        const convs = await client.conversations.list(undefined, undefined, ['allowed', 'unknown']);
        const summarized = await Promise.all(convs.map(summarize));
        if (cancelled) return;
        summarized.sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0));
        setRows(summarized);
        /** Subscribe to newly-created conversations so groups + DMs created
         *  while the tab is mounted show up without a manual refresh. */
        try {
          cancelConvStream = await client.conversations.stream(async (conv) => {
            if (cancelled || !conv) return;
            const r = await summarize(conv);
            setRows(prev => prev
              ? [r, ...prev.filter(x => x.convId !== r.convId)]
              : [r]);
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
              const updated = { ...prev[idx]!, lastTs, lastPreview };
              return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
            });
          }) ?? null;
        } catch { /* message stream init failed — preview will lag */ }
      } catch (e) { setError((e as Error).message); }
    })();
    return (): void => {
      cancelled = true;
      if (cancelConvStream) try { cancelConvStream(); } catch { /* ignore */ }
      if (cancelMsgStream) try { cancelMsgStream(); } catch { /* ignore */ }
    };
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: bg }}>
        <Text style={{ color: fg, fontSize: 15 }}>{error}</Text>
      </View>
    );
  }
  if (!rows) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
        <ActivityIndicator />
        <Text style={{ color: sub, marginTop: 8, fontSize: 12 }}>Initialising XMTP…</Text>
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
              backgroundColor: pressed ? border : rowBg,
              flexDirection: 'row', alignItems: 'center', gap: 12,
              paddingHorizontal: 14, paddingVertical: 12,
              borderBottomWidth: 1, borderBottomColor: border,
            })}
          >
            <RowAvatar
              peerAddress={item.peerAddress}
              memberAddresses={item.memberAddresses}
              rowBg={rowBg}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: fg, fontSize: 14 }} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={{ color: sub, fontSize: 12, marginTop: 4 }} numberOfLines={1}>
                {item.lastPreview || '(no messages yet)'}
              </Text>
            </View>
            <Text style={{ color: sub, fontSize: 12, marginLeft: 8 }}>{fmtTs(item.lastTs)}</Text>
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
        <Text style={{ color: '#000000', fontSize: 17 }}>
          {creatingAsk ? 'Creating group…' : 'Ask a question'}
        </Text>
      </Pressable>
    </View>
  );
}
