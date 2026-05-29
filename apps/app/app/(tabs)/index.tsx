/** Channels tab — XMTP conversations the local wallet is a member of.
 *  Tapping a row pushes into `/xmtp/[convId]` for the full chat view.
 *  Avatar = stamp.box `eth:<peer-address>` for DMs; stacked stamp avatars of
 *  the other members for groups (excluding the local user). Both are resolved
 *  once per conv during the initial list build and cached in component state. */

import { useEffect, useRef, useState } from 'react';
import {
  AppState, FlatList, Modal, Pressable, RefreshControl,
  Text, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { Conversation, DecodedMessage } from '@xmtp/react-native-sdk';
import { DevSettings } from 'react-native';
import {
  getOrCreateXmtpClient, resetXmtpClient,
  peerEthAddressOfDm, groupMemberEthAddresses, memberInboxToAddressMap,
  shortAddress,
  getLastReadNs, getConvConsent, syncPreferences, streamConvConsent,
} from '../../lib/xmtp';
import { resetAccount } from '../../lib/wallet';
import { useEffectiveColorScheme } from '../../lib/theme';
import {
  getCachedRows, hydrateCachedRows, setCachedRows, subscribeCachedRows,
  markConvUnread, markConvRead, applyConsentToRows,
} from '../../lib/channelsCache';
import { usePeerProfiles, getPeerAvatarCb, getPeerName, isPeerResolved } from '../../lib/peerProfiles';
import { presentInboundNotification, isMetroControlBody } from '../../lib/push';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { HeroIcon } from '../../components/HeroIcon';
import { hasDraft, useDraftsVersion } from '../../lib/drafts';
import { previewOfXmtpContent } from '@metro-labs/client/xmtp/humanize';
import { Spinner } from '../../components/Spinner';
import { Avatar } from '../../components/Avatar';

interface Row {
  convId: string;
  title: string;
  lastTs: number | null;
  lastPreview: string;
  /** Eth address whose stamp.fyi avatar should render in the row. Resolved
   *  to the latest sender when there's a message, else the peer (DMs) or
   *  the first other member (groups). Ignored when `avatarUri` is set. */
  avatarAddress: string | null;
  /** Group-uploaded image (ipfs:// or http URL). Takes precedence over
   *  `avatarAddress` — when set, the row renders this image directly so
   *  groups show their own avatar instead of a member's stamp. */
  avatarUri: string | null;
  /** DM peer address (null for groups) — drives showing the peer's display name. */
  peerAddress: string | null;
  /** Eth address of the latest message's sender (null if self/unknown). */
  lastSenderAddress: string | null;
  /** Whether the local user sent the latest message → "You: …" preview prefix. */
  lastFromSelf: boolean;
  /** Cached inbox → eth address map, kept so live stream updates can resolve
   *  a new sender's avatar without an extra round-trip. */
  inboxToAddr: Record<string, string>;
  /** Count of messages newer than the per-conv lastReadNs that the LOCAL
   *  user didn't send. 0 hides the badge. */
  unreadCount: number;
  /** Cached lastReadNs — kept so streamAllMessages updates can recompute the
   *  count without a SecureStore round-trip per new msg. */
  lastReadNs: number;
  /** Synced (cross-device) "explicitly marked unread" flag from XMTP consent
   *  state. Forces the badge on even when the timestamp count is 0. */
  markedUnread: boolean;
  /** Own inbox id — also needed to filter own messages out of the unread
   *  recount on stream updates. */
  selfInboxId: string;
  /** Make Row a structural superset of `CachedRow` so we can pass it
   *  straight through `setCachedRows` without casting. */
  [key: string]: unknown;
}

/** Extract the conversation id from an XMTP MLS topic. Stream `DecodedMessage`s
 *  only expose `topic` (`/xmtp/mls/1/g-<hexId>/proto`), not `conversationId`, so
 *  the `g-<id>` segment is the bridge back to `Row.convId` (which stores
 *  `conv.id`). Returns null when the topic doesn't match the expected shape. */
function convIdFromTopic(topic: string | undefined): string | null {
  if (!topic) return null;
  const m = /\/g-([0-9a-fA-F]+)\//.exec(topic);
  return m ? m[1]! : null;
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
  /** Skip our own register-push control DMs (plain-text, magic-prefixed) when
   *  choosing the row's "last message" so the preview never shows METRO_CTRL:. */
  const last = msgs.find(m => {
    try { const c = m.content(); return !(typeof c === 'string' && isMetroControlBody(c)); }
    catch { return true; }
  }) ?? msgs[0];
  let preview = '';
  if (last) {
    try { preview = previewOfXmtpContent(last.content(), last.contentTypeId); }
    catch { preview = `[${last.contentTypeId ?? 'unknown'}]`; }
  }
  const peerAddress = await peerEthAddressOfDm(conv);
  const memberAddresses = peerAddress ? [] : await groupMemberEthAddresses(conv);
  const inboxToAddr = await memberInboxToAddressMap(conv);
  const totalMembers = memberAddresses.length + 1;
  /** Read group metadata (name + uploaded image) in one shot for groups. */
  const groupMeta = peerAddress
    ? { name: '', imageUrl: '' }
    : await (async (): Promise<{ name: string; imageUrl: string }> => {
        const g = conv as unknown as { name?: () => Promise<string>; imageUrl?: () => Promise<string> };
        const [n, img] = await Promise.all([
          g.name?.() ?? Promise.resolve(''),
          g.imageUrl?.().catch(() => '') ?? Promise.resolve(''),
        ]);
        return { name: n ?? '', imageUrl: img ?? '' };
      })();
  const title = peerAddress
    ? shortAddress(peerAddress)
    : (groupMeta.name.trim()
      ? groupMeta.name.trim()
      : memberAddresses.length > 0
        ? `${totalMembers} member${totalMembers === 1 ? '' : 's'}`
        : conv.topic.replace(/^.*\//, '').slice(0, 12));
  /** For DMs: use the peer's stamp. For groups with an uploaded image:
   *  use that image (via avatarUri). Otherwise fall back to the latest
   *  sender / first member stamp. */
  const lastSenderAddress = last?.senderInboxId
    ? inboxToAddr[last.senderInboxId] ?? null
    : null;
  const lastFromSelf = !!last && last.senderInboxId === selfInboxId;
  const avatarAddress = peerAddress
    ?? lastSenderAddress
    ?? memberAddresses[0]
    ?? null;
  const avatarUri = peerAddress ? null : (groupMeta.imageUrl.trim() || null);
  /** Unread count = msgs newer than the persisted lastReadNs not sent by us. */
  const lastReadNs = await getLastReadNs(conv.id);
  let unreadCount = 0;
  for (const m of msgs) {
    if (!m.sentNs || m.sentNs <= lastReadNs) break;
    if (m.senderInboxId === selfInboxId) continue;
    unreadCount += 1;
  }
  /** Cross-device read flag: consent 'unknown' = unread on the inbox level. We
   *  only let it FORCE a badge when this device has NO local read marker yet
   *  (`lastReadNs === 0`) and there's an inbound last message. Once a device has
   *  read the conv (lastReadNs > 0) we trust the local timestamp count and only
   *  surface an *explicit* "mark unread" (which resets lastReadNs to 0). This
   *  avoids phantom badges on conversations read before this feature existed,
   *  while still propagating a genuine cross-device "mark unread". */
  const consent = await getConvConsent(conv.id).catch(() => 'unknown' as const);
  const markedUnread = consent === 'unknown' && lastReadNs === 0
    && unreadCount === 0 && !!last && !lastFromSelf;
  return {
    convId: conv.id,
    title,
    lastTs: last?.sentNs ? Math.floor(last.sentNs / 1_000_000) : null,
    lastPreview: preview.slice(0, 80),
    avatarAddress,
    avatarUri,
    peerAddress,
    lastSenderAddress,
    lastFromSelf,
    inboxToAddr,
    unreadCount,
    lastReadNs,
    selfInboxId,
    markedUnread,
  };
}


/** Channels-list cache lives in lib/channelsCache so the conversation view
 *  can reach in to clear unread on mount without an import cycle. The Row[]
 *  shape is a superset of CachedRow — write through directly. */

export default function Messenger(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const fg = dark ? '#9f9fa3' : '#57606a';
  const head = dark ? '#ffffff' : '#000000';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const bg = dark ? '#0e0f10' : '#ffffff';
  const border = dark ? '#282a2d' : '#e4e4e5';
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
  const [refreshing, setRefreshing] = useState(false);
  /** Row long-pressed → opens the per-conversation action sheet (Mark as
   *  read/unread). Holds the convId + whether it currently reads as unread. */
  const [rowMenu, setRowMenu] = useState<{ convId: string; title: string; isUnread: boolean } | null>(null);
  /** Held across effect re-runs so AppState + poll backstops can call refresh
   *  without re-binding to a stale client. */
  const refreshFromNetworkRef = useRef<(() => Promise<void>) | null>(null);

  /** Batch-resolve the displayed peers' profiles → avatar cache-busters. */
  const channelProfilesVersion = usePeerProfiles(
    (rows ?? []).flatMap(r => [r.avatarAddress, r.peerAddress, r.lastSenderAddress]),
  );
  const draftsVersion = useDraftsVersion();
  /** Re-runs the XMTP init below when the active account changes (in-place switch). */
  const accountEpoch = useAccountEpoch();

  useEffect(() => {
    let cancelled = false;
    let cancelConvStream: (() => void) | null = null;
    let cancelMsgStream: (() => void) | null = null;
    let cancelConsentStream: (() => void) | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let appStateSub: { remove: () => void } | null = null;

    /** Hydrate the persisted cache first — if we have rows from a previous
     *  session, render them immediately so the user sees the channels list
     *  before XMTP finishes initialising. The network refresh below then
     *  reconciles any changes. */
    void hydrateCachedRows().then(cached => {
      if (cancelled) return;
      if (cached && Array.isArray(cached) && cached.length > 0 && !rows) {
        setRowsState(cached as Row[]);
      }
    });

    /** Outer init timeout — if XMTP boot+sync hasn't finished in 30s AND we
     *  have no cached rows to render, surface an error + recovery UI instead
     *  of leaving the user staring at a spinner. Skipped when cache is warm. */
    const initTimer = setTimeout(() => {
      if (cancelled || (rows && rows.length > 0)) return;
      setError('XMTP failed to initialise (timed out). Tap Reset below to wipe the local identity and start fresh.');
    }, 30_000);

    void (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        const selfInboxId = client.inboxId;

        /** Reusable refresh that any backstop (AppState resume, slow poll,
         *  pull-to-refresh, unknown-conv stream hit) can call to re-sync +
         *  re-summarise the full list. */
        const refresh = async (): Promise<void> => {
          if (cancelled) return;
          try {
            await client.conversations.syncAllConversations(['allowed', 'unknown']);
            const convs = await client.conversations.list(undefined, undefined, ['allowed', 'unknown']);
            const summarized = await Promise.all(convs.map(c => summarize(c, selfInboxId)));
            if (cancelled) return;
            summarized.sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0));
            setRows(summarized);
            clearTimeout(initTimer);
          } catch { /* swallow — backstops keep firing */ }
        };
        refreshFromNetworkRef.current = refresh;

        await refresh();

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
        } catch { /* stream init failed — backstops will pick it up */ }

        /** Subscribe to every new message across all convs so the per-row
         *  lastTs + lastPreview reflect activity in real time. When the msg
         *  belongs to a conv we haven't summarised yet (just-received from
         *  a peer), trigger a full refresh so it shows up. */
        try {
          cancelMsgStream = await client.conversations.streamAllMessages(async (msg) => {
            if (cancelled || !msg) return;
            let decoded: unknown;
            let preview = '';
            try { decoded = msg.content(); preview = previewOfXmtpContent(decoded, msg.contentTypeId); }
            catch { preview = `[${msg.contentTypeId ?? 'unknown'}]`; }
            /** Our own register-push control DMs ride plain text — ignore them
             *  entirely so they neither bump a row nor fire a notification. */
            if (typeof decoded === 'string' && isMetroControlBody(decoded)) return;
            const lastTs = msg.sentNs ? Math.floor(msg.sentNs / 1_000_000) : Date.now();
            const lastPreview = preview.slice(0, 80);

            /** Foreground local notification (option b) — phone-only wallets get
             *  notified without the daemon. Skip our own messages, system/silent
             *  types, and our private register-push control payloads. The daemon
             *  separately background-pushes daemon-run inboxes; this covers the
             *  app-running case for every account.
             *
             *  The RN `DecodedMessage` only carries `topic` (e.g.
             *  `/xmtp/mls/1/g-<id>/proto`), NOT `conversationId` — so derive the
             *  conv id from the topic (with the native `conversationId`, when
             *  present, as a fallback). The conv id is best-effort: it only enriches
             *  the title + deep-link payload, so a miss still notifies. */
            const msgConvIdForNote = convIdFromTopic((msg as unknown as { topic?: string }).topic)
              ?? (msg as unknown as { conversationId?: string }).conversationId
              ?? null;
            const isOwn = msg.senderInboxId === selfInboxId;
            const isSystem = /group_updated|groupUpdated|read_receipt|readReceipt/.test(msg.contentTypeId ?? '');
            if (!isOwn && !isSystem && preview) {
              /** Read the latest rows from the shared cache (the effect closure's
               *  `rows` is stale — deps are [accountEpoch]). */
              const latestRows = getCachedRows() as Row[] | null;
              const row = msgConvIdForNote ? latestRows?.find(r => r.convId === msgConvIdForNote) : undefined;
              const senderAddr = row?.inboxToAddr?.[msg.senderInboxId ?? ''] ?? null;
              const title = row?.title
                || (senderAddr ? shortAddress(senderAddr) : 'New message');
              void presentInboundNotification({
                title, body: preview.slice(0, 140),
                convId: msgConvIdForNote ?? '', messageId: msg.id,
              });
            }

            let needsRefresh = false;
            setRows(prev => {
              if (!prev) return prev;
              /** Derive the conv id from the topic (see `convIdFromTopic`); the
               *  native `conversationId`, when present, is a fallback. Reuse the
               *  value already computed above for the notification. */
              const msgConvId = msgConvIdForNote;
              const idx = msgConvId ? prev.findIndex(r => r.convId === msgConvId) : -1;
              if (idx === -1) { needsRefresh = true; return prev; }
              const cur = prev[idx]!;
              const newAvatar = cur.inboxToAddr[msg.senderInboxId ?? ''] ?? cur.avatarAddress;
              /** Bump the unread count when the new msg is newer than what we'd
               *  read AND not authored by the local user. */
              const isUnread = (msg.sentNs ?? 0) > cur.lastReadNs
                && msg.senderInboxId !== cur.selfInboxId;
              const unreadCount = isUnread ? cur.unreadCount + 1 : cur.unreadCount;
              const updated = { ...cur, lastTs, lastPreview, avatarAddress: newAvatar, unreadCount };
              /** A real inbound message supersedes a stale forced-unread flag —
               *  it's now counted in unreadCount, so drop the marker. */
              if (isUnread) updated.markedUnread = false;
              const next = [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
              return next;
            });
            if (needsRefresh) void refresh();
          }) ?? null;
        } catch { /* message stream init failed — preview will lag */ }

        /** Cross-device read/unread: pull synced consent from the network, then
         *  subscribe to live consent changes so a "mark unread" on another device
         *  reconciles the badge here without a full refetch. */
        await syncPreferences();
        try {
          cancelConsentStream = streamConvConsent((convId, state) => {
            if (cancelled) return;
            applyConsentToRows(convId, state === 'unknown');
          });
        } catch { /* consent stream unavailable — refresh backstop covers it */ }

        /** Foreground resume — the native streams often die while the app is
         *  backgrounded; re-sync on every active transition. Also pull synced
         *  consent so cross-device read state lands on resume. */
        appStateSub = AppState.addEventListener('change', (state) => {
          if (state === 'active') { void syncPreferences(); void refresh(); }
        });

        /** Slow poll as a last-resort backstop. Catches anything the stream
         *  dropped (network blip, push-without-stream, etc.). 30s is gentle
         *  on battery + bandwidth while still feeling live. */
        pollTimer = setInterval(() => { void refresh(); }, 30_000);
      } catch (e) {
        if (!rows || rows.length === 0) setError((e as Error).message);
      }
    })();

    return (): void => {
      cancelled = true;
      clearTimeout(initTimer);
      refreshFromNetworkRef.current = null;
      if (cancelConvStream) try { cancelConvStream(); } catch { /* ignore */ }
      if (cancelMsgStream) try { cancelMsgStream(); } catch { /* ignore */ }
      if (cancelConsentStream) try { cancelConsentStream(); } catch { /* ignore */ }
      if (appStateSub) try { appStateSub.remove(); } catch { /* ignore */ }
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [accountEpoch]);

  const onPullToRefresh = async (): Promise<void> => {
    if (refreshing) return;
    setRefreshing(true);
    try { await refreshFromNetworkRef.current?.(); } finally { setRefreshing(false); }
  };

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
        <Spinner size={28} color={head} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Home topnav: title left, search icon right → opens the /search page. */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: border,
      }}>
        <Text style={{ color: head, fontSize: 22, fontFamily: 'Calibre-Semibold' }}>Channels</Text>
        <Pressable onPress={() => router.push('/search')} hitSlop={8}>
          <HeroIcon name="search" size={26} color={head} />
        </Pressable>
      </View>
      <FlatList
        data={rows ?? []}
        extraData={`${channelProfilesVersion}:${draftsVersion}`}
        keyExtractor={r => r.convId}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { void onPullToRefresh(); }}
            tintColor={sub}
          />
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ color: sub, textAlign: 'center' }}>
              No conversations yet. Share your address from Settings to start one.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/xmtp/[convId]', params: { convId: item.convId } })}
            onLongPress={() => setRowMenu({
              convId: item.convId,
              title: item.peerAddress ? (getPeerName(item.peerAddress) ?? item.title) : item.title,
              isUnread: item.unreadCount > 0 || !!item.markedUnread,
            })}
            delayLongPress={300}
            style={({ pressed }) => ({
              backgroundColor: pressed ? border : 'transparent',
              paddingHorizontal: 14,
            })}
          >
            {/* Inner row carries the separator: it starts at the avatar's left
                edge (inset by paddingHorizontal), not the full card width. */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              paddingVertical: 14,
              borderBottomWidth: 1, borderBottomColor: border,
            }}>
            {/** Group-uploaded image OR (only once the peer profile has
             *   resolved) the peer's stamp/custom avatar — gating on
             *   `isPeerResolved` avoids the wrong-avatar flash when the
             *   cache-buster lands after the first paint. */}
            <Avatar
              imageUri={item.avatarUri}
              address={!item.avatarUri && item.avatarAddress && isPeerResolved(item.avatarAddress) ? item.avatarAddress : null}
              size={40}
              cacheBuster={item.avatarAddress ? getPeerAvatarCb(item.avatarAddress) : undefined}
              style={{ backgroundColor: border }}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {hasDraft(item.convId) ? <HeroIcon name="pencil" size={14} color={sub} /> : null}
                <Text style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Semibold', flex: 1 }} numberOfLines={1}>
                  {item.peerAddress ? (getPeerName(item.peerAddress) ?? item.title) : item.title}
                </Text>
                <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>{fmtTs(item.lastTs)}</Text>
              </View>
              {/** Reserve the badge's height (22) regardless of whether one is shown,
               *   so rows with/without the unread indicator are the same total height. */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, minHeight: 22 }}>
                <Text style={{ color: sub, fontSize: 15, fontFamily: 'Calibre-Medium', flex: 1 }} numberOfLines={1}>
                  {item.lastPreview
                    ? `${item.lastFromSelf ? 'You' : item.lastSenderAddress ? (getPeerName(item.lastSenderAddress) ?? shortAddress(item.lastSenderAddress)) : ''}${(item.lastFromSelf || item.lastSenderAddress) ? ': ' : ''}${item.lastPreview}`
                    : '(no messages yet)'}
                </Text>
                {item.unreadCount > 0 ? (
                  <View style={{
                    minWidth: 22, height: 22, borderRadius: 999, backgroundColor: head,
                    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7,
                  }}>
                    <Text style={{ color: bg, fontSize: 12, fontFamily: 'Calibre-Semibold' }}>
                      {item.unreadCount > 99 ? '99+' : item.unreadCount}
                    </Text>
                  </View>
                ) : item.markedUnread ? (
                  /** Explicitly marked unread (cross-device) but no counted msgs
                   *  → show a plain dot rather than a number. */
                  <View style={{
                    width: 12, height: 12, borderRadius: 999, backgroundColor: head,
                  }} />
                ) : null}
              </View>
            </View>
            </View>
          </Pressable>
        )}
      />
      <RowActionSheet
        target={rowMenu}
        dark={dark}
        onClose={() => setRowMenu(null)}
        onToggleUnread={() => {
          if (!rowMenu) return;
          const { convId, isUnread } = rowMenu;
          setRowMenu(null);
          if (isUnread) void markConvRead(convId);
          else void markConvUnread(convId);
        }}
      />
    </View>
  );
}

/** Bottom action sheet shown on long-pressing a channel row. v1 exposes a
 *  single toggle: Mark as read / Mark as unread (cross-device via XMTP consent). */
function RowActionSheet({
  target, dark, onClose, onToggleUnread,
}: {
  target: { convId: string; title: string; isUnread: boolean } | null;
  dark: boolean; onClose: () => void; onToggleUnread: () => void;
}): React.ReactElement {
  const sheetBg = dark ? '#282a2d' : '#ffffff';
  const fg = dark ? '#9f9fa3' : '#57606a';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const head = dark ? '#ffffff' : '#000000';
  return (
    <Modal visible={!!target} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <Pressable onPress={e => e.stopPropagation()} style={{
          backgroundColor: sheetBg, borderTopLeftRadius: 16, borderTopRightRadius: 16,
          padding: 16, paddingBottom: 24, gap: 4,
        }}>
          <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium', paddingHorizontal: 4, paddingBottom: 6 }} numberOfLines={1}>
            {target?.title ?? ''}
          </Text>
          <Pressable onPress={onToggleUnread} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
            <HeroIcon name={target?.isUnread ? 'check' : 'envelope'} size={20} color={head} />
            <Text style={{ color: head, fontSize: 16, fontFamily: 'Calibre-Medium' }}>
              {target?.isUnread ? 'Mark as read' : 'Mark as unread'}
            </Text>
          </Pressable>
          <Pressable onPress={onClose} style={{ paddingVertical: 10, alignItems: 'center' }}>
            <Text style={{ color: fg, fontSize: 14, fontFamily: 'Calibre-Medium' }}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
