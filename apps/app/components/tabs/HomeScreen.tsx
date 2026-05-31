/** Channels tab — XMTP conversations the local wallet is a member of.
 *  Tapping a row pushes into `/xmtp/[convId]` for the full chat view.
 *  Avatar = stamp.box `eth:<peer-address>` for DMs; stacked stamp avatars of
 *  the other members for groups (excluding the local user). Both are resolved
 *  once per conv during the initial list build and cached in component state. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, Vibration } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import type { SimultaneousRefs } from '../SwipeTabs';
import { Text } from '@metro-labs/kit/text';
import { useRouter } from 'expo-router';
import type { Conversation, DecodedMessage } from '@xmtp/react-native-sdk';
import { DevSettings } from 'react-native';
import {
  getOrCreateXmtpClient, resetXmtpClient,
  peerEthAddressOfDm, groupMemberEthAddresses, memberInboxToAddressMap,
  shortAddress,
  getLastReadNs, syncPreferences,
  primeInboxEthCache, subscribeAllMessages,
  listRequestConvs, streamConvConsent, syncConsent,
} from '../../lib/xmtp';
import { resetAccount } from '../../lib/wallet';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import {
  getCachedRows, hydrateCachedRows, setCachedRows, subscribeCachedRows,
  markConvUnread, markConvRead,
} from '../../lib/channelsCache';
import { usePeerProfiles, getPeerAvatarCb, getPeerName, isPeerResolved } from '../../lib/peerProfiles';
import { isMetroControlBody } from '../../lib/push';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { getActiveAccount } from '../../lib/accounts';
import { Icon } from '@metro-labs/kit/icon';
import { hasDraft, useDraftsVersion } from '../../lib/drafts';
import { previewOfXmtpContent } from '@metro-labs/client/xmtp/humanize';
import { Spinner } from '../Spinner';
import { Avatar } from '../Avatar';
import { ChannelRow } from '../ChannelRow';
import { Box, Col, Row } from '../layout';
import { AppModal } from '../AppModal';
import { loadPinnedIds, isPinned, togglePin, subscribePins } from '../../lib/pins';

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

/** Fixed ChannelRow height: 14px vertical padding ×2 + ~48px content (title 22 +
 *  4 margin + 22 badge-reserve) + 1px separator. Used by getItemLayout (#5). */
const CHANNEL_ROW_HEIGHT = 77;

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
  /** #2: pull only the latest message for the row PREVIEW — we no longer recompute
   *  the unread count from 50 msgs per row (that's now maintained incrementally
   *  from the live stream deltas). A previously-read conv seeds unreadCount=0; the
   *  global stream bumps it on each new inbound. "Marked unread" still surfaces
   *  via the lastReadNs marker below. We fetch 2 so a trailing control DM doesn't blank
   *  the preview. */
  const recent: DecodedMessage[] = await conv.messages({ limit: 2 }).catch(() => []);
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
  /** Explicit "mark unread" flag, derived purely from the per-device
   *  `lastReadNs`: a rewound marker (`lastReadNs === 0`) with an inbound last
   *  message and no timestamp-counted unreads means the user (or a never-read
   *  fresh conv) wants a badge. No XMTP consent involved. */
  const markedUnread = lastReadNs === 0
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

export function HomeScreen({ panRef }: { panRef?: SimultaneousRefs } = {}): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { fg, head, sub, bg, border } = usePalette();
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
  /** Row long-pressed → opens the per-conversation action sheet (Mark as
   *  read/unread). Holds the convId + whether it currently reads as unread. */
  const [rowMenu, setRowMenu] = useState<{ convId: string; title: string; isUnread: boolean } | null>(null);
  /** Held across effect re-runs so AppState + poll backstops can call refresh
   *  without re-binding to a stale client. */
  const refreshFromNetworkRef = useRef<(() => Promise<void>) | null>(null);
  /** Device-only pinned conv ids. Loaded once on mount; `subscribePins` bumps
   *  this on every toggle so the display sort below re-derives + re-renders. */
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  /** Active account's own address → topnav avatar. */
  const [myAddress, setMyAddress] = useState<string | null>(null);
  /** Count of pending message requests ('unknown' consent convs). Drives the
   *  "Requests (N)" entry at the top of the list; hidden when 0. */
  const [requestCount, setRequestCount] = useState<number>(0);
  useEffect(() => {
    void loadPinnedIds().then(setPinned);
    /** On toggle the cache is already updated; re-read it (resolves instantly
     *  once loaded) into a fresh Set so React sees a new reference. */
    return subscribePins(() => { void loadPinnedIds().then(s => setPinned(new Set(s))); });
  }, []);

  /** Display ordering: pinned rows float to the top (keeping their own lastTs
   *  desc order), then the rest by lastTs desc. Derived for display only — the
   *  source `rows` state stays untouched so the stream-update logic (which
   *  prepends/reorders by recency) keeps working against the raw list. */
  const sortedRows = useMemo(() => {
    const list = rows ?? [];
    return [...list].sort((a, b) => {
      const ap = pinned.has(a.convId) ? 1 : 0;
      const bp = pinned.has(b.convId) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return (b.lastTs ?? 0) - (a.lastTs ?? 0);
    });
  }, [rows, pinned]);

  /** Batch-resolve the displayed peers' profiles → avatar cache-busters. */
  const channelProfilesVersion = usePeerProfiles(
    (rows ?? []).flatMap(r => [r.avatarAddress, r.peerAddress, r.lastSenderAddress]),
  );
  const draftsVersion = useDraftsVersion();
  /** Re-runs the XMTP init below when the active account changes (in-place switch). */
  const accountEpoch = useAccountEpoch();
  /** Re-resolve the active account's address for the topnav avatar on switch. */
  useEffect(() => {
    let cancelled = false;
    void getActiveAccount().then(acct => {
      if (!cancelled) setMyAddress(acct?.address ?? null);
    });
    return () => { cancelled = true; };
  }, [accountEpoch]);

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

        /** Recount pending message requests ('unknown' consent). Cheap — only
         *  reads the local conv list (synced separately by listRequestConvs). */
        const refreshRequestCount = async (): Promise<void> => {
          try {
            const reqs = await listRequestConvs();
            if (!cancelled) setRequestCount(reqs.length);
          } catch { /* swallow */ }
        };

        /** Reusable refresh that any backstop (AppState resume, slow poll,
         *  pull-to-refresh, unknown-conv stream hit) can call to re-sync +
         *  re-summarise the full list. */
        const refresh = async (): Promise<void> => {
          if (cancelled) return;
          try {
            await client.conversations.syncAllConversations(['allowed', 'unknown']);
            /** Main inbox = only ACCEPTED convs ('allowed'). The 'unknown'
             *  convs are pending message requests, surfaced separately via the
             *  Requests entry (count refreshed alongside). */
            const convs = await client.conversations.list(undefined, undefined, ['allowed']);
            void refreshRequestCount();
            /** #3 BATCH inbox resolution: collect every member inbox id across all
             *  convs in parallel, then resolve the uncached ones in ONE
             *  inboxStates(true, [...]) call so per-row summarise hits the cache
             *  (kills the per-row N+1 GetIdentityUpdates that caused the outage). */
            try {
              const memberLists = await Promise.all(convs.map(c =>
                (c as unknown as { members: () => Promise<{ inboxId: string }[]> })
                  .members().then(ms => ms.map(m => m.inboxId)).catch(() => [] as string[]),
              ));
              await primeInboxEthCache(client, memberLists.flat());
            } catch { /* per-row resolveInboxEth still falls back */ }
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
            /** A streamed conv we haven't accepted yet ('unknown') is a message
             *  request — surface it in the Requests count, not the inbox. */
            const cs = await (conv as unknown as { consentState: () => Promise<string> })
              .consentState().catch(() => 'allowed');
            if (cs !== 'allowed') { void refreshRequestCount(); return; }
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
          /** #1 ONE STREAM: subscribe to the single module-level
           *  streamAllMessages fan-out in lib/xmtp instead of starting our own
           *  (every inbound used to be decoded twice — here + the conv-view
           *  feed). The raw DecodedMessage is routed to us; the conv-view
           *  feedCache slice gets the same message from the same decode. */
          cancelMsgStream = subscribeAllMessages(({ convId: streamConvId, msg }) => {
            if (cancelled || !msg) return;
            void (async (): Promise<void> => {
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
            const msgConvIdForNote = streamConvId
              ?? convIdFromTopic((msg as unknown as { topic?: string }).topic)
              ?? (msg as unknown as { conversationId?: string }).conversationId
              ?? null;
            /** NOTE: The JS local-notification path was REMOVED here. The daemon +
             *  native MetroFcmService are now the SINGLE source of inbound push
             *  notifications — they post one merged MessagingStyle card per
             *  conversation (with sender avatar, deep-link, open-channel
             *  suppression). The old `presentInboundNotification` call posted a
             *  SECOND, avatar-less, per-message local notif for the same message
             *  (the duplicate "M"-logo cards). This stream still owns all the
             *  channel-row / unread-count / cache work below — only the
             *  notification side effect is gone. (An account with no daemon push
             *  registration gets no notifications, which is acceptable: the daemon
             *  pushes for the active account.) */

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
              const senderAddr = cur.inboxToAddr[msg.senderInboxId ?? ''] ?? null;
              /** DM cards are pinned to the PEER's avatar — never the latest
               *  sender. Otherwise a message from self (or the shared-inbox
               *  daemon) would flip the card to the local user's own avatar.
               *  Groups still track the latest sender's stamp. */
              const newAvatar = cur.peerAddress ?? senderAddr ?? cur.avatarAddress;
              /** Attribute the preview to whoever SENT this message — including a
               *  reaction (its own senderInboxId is the reactor, NOT the peer or
               *  the referenced message's author). Without this the row keeps the
               *  stale lastSenderAddress from summarize() — e.g. the DM peer — so a
               *  reaction the local user makes would show "Tony: 👍" instead of the
               *  reactor's name. */
              const lastFromSelf = msg.senderInboxId === cur.selfInboxId;
              /** Bump the unread count when the new msg is newer than what we'd
               *  read AND not authored by the local user. */
              const isUnread = (msg.sentNs ?? 0) > cur.lastReadNs
                && msg.senderInboxId !== cur.selfInboxId;
              const unreadCount = isUnread ? cur.unreadCount + 1 : cur.unreadCount;
              const updated = {
                ...cur, lastTs, lastPreview, avatarAddress: newAvatar,
                lastSenderAddress: senderAddr, lastFromSelf, unreadCount,
              };
              /** A real inbound message supersedes a stale forced-unread flag —
               *  it's now counted in unreadCount, so drop the marker. */
              if (isUnread) updated.markedUnread = false;
              const next = [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
              return next;
            });
            if (needsRefresh) void refresh();
            })();
          });
        } catch { /* message stream init failed — preview will lag */ }

        /** Pull synced preferences from the network on init. Read/unread is now
         *  per-device (lastReadNs), so there's no consent stream to subscribe to. */
        await syncPreferences();
        await syncConsent();

        /** Live-reconcile when a conv is accepted/blocked (here or on another
         *  device): re-pull consent, then re-summarise the inbox + recount
         *  requests so an accepted request appears + the badge drops. */
        try {
          cancelConsentStream = streamConvConsent(() => {
            void (async (): Promise<void> => {
              await syncConsent();
              void refresh();
              void refreshRequestCount();
            })();
          });
        } catch { /* stream init failed — AppState resume backstops it */ }

        /** Foreground resume — the native streams often die while the app is
         *  backgrounded; re-sync on every active transition. */
        appStateSub = AppState.addEventListener('change', (state) => {
          if (state === 'active') {
            void syncPreferences(); void syncConsent();
            void refresh(); void refreshRequestCount();
          }
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

/** #6: stable extraData (an array, identity changes only when one of these
   *  versions does) instead of a freshly-built string every render — so the
   *  FlatList doesn't treat every parent re-render as "data changed" and
   *  re-render the whole window on each stream tick. */
  const listExtraData = useMemo(
    () => [channelProfilesVersion, draftsVersion, pinned] as const,
    [channelProfilesVersion, draftsVersion, pinned],
  );

  /** #6: hoisted renderItem so its identity is stable across stream ticks (only
   *  re-created when a resolution version changes), letting memoised ChannelRow
   *  skip rows whose props are unchanged. */
  const renderRow = useCallback(({ item }: { item: Row }): React.ReactElement => {
    const displayTitle = item.peerAddress ? (getPeerName(item.peerAddress) ?? item.title) : item.title;
    const senderPrefix = item.lastFromSelf
      ? 'You: '
      : item.lastSenderAddress
        ? `${getPeerName(item.lastSenderAddress) ?? shortAddress(item.lastSenderAddress)}: `
        : '';
    const preview = item.lastPreview
      ? `${senderPrefix}${item.lastPreview}`
      : '(no messages yet)';
    const showAddr = !item.avatarUri && item.avatarAddress && isPeerResolved(item.avatarAddress)
      ? item.avatarAddress : null;
    return (
      <ChannelRow
        title={displayTitle}
        avatarUri={item.avatarUri}
        avatarAddress={showAddr}
        cacheBuster={item.avatarAddress ? getPeerAvatarCb(item.avatarAddress) : undefined}
        square={!item.peerAddress}
        lastPreview={preview}
        timestamp={fmtTs(item.lastTs)}
        unreadCount={item.unreadCount}
        markedUnread={item.markedUnread}
        pinned={isPinned(item.convId)}
        hasDraft={hasDraft(item.convId)}
        onPress={() => router.push({ pathname: '/xmtp/[convId]', params: { convId: item.convId } })}
        onLongPress={() => {
          /** Tiny haptic-style buzz when the long-press opens the row menu.
           *  RN core Vibration (no native dep / rebuild needed); ~10ms = a subtle tap. */
          Vibration.vibrate(10);
          setRowMenu({
            convId: item.convId,
            title: item.peerAddress ? (getPeerName(item.peerAddress) ?? item.title) : item.title,
            isUnread: item.unreadCount > 0 || !!item.markedUnread,
          });
        }}
      />
    );
    /** Versions drive re-creation so name/avatar/pin/draft resolutions repaint.
     *  (deps intentionally partial — react-hooks/exhaustive-deps not enabled.) */
  }, [router, channelProfilesVersion, draftsVersion, pinned]);

  /** ChannelRow is fixed-height (#5) → getItemLayout lets the list skip
   *  measuring + jump-scroll without rendering intermediate rows. Keep in sync
   *  with ChannelRow's layout (avatar 40 / 14px vertical padding / 1px border). */
  const getRowLayout = useCallback((_d: ArrayLike<Row> | null | undefined, index: number) => (
    { length: CHANNEL_ROW_HEIGHT, offset: CHANNEL_ROW_HEIGHT * index, index }
  ), []);

  if (error) {
    return (
      <Col flex={1} align="center" justify="center" p={24} bg={bg}>
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
      </Col>
    );
  }
  if (!rows) {
    return (
      <Col flex={1} align="center" justify="center" bg={bg}>
        <Spinner size={28} color={head} />
      </Col>
    );
  }

  return (
    <Col flex={1} bg={bg}>
      {/* Home topnav: title left, search icon right → opens the /search page. */}
      <Row align="center" justify="between" px={16} pt={12} pb={10} style={{
        borderBottomWidth: 1, borderBottomColor: border,
      }}>
        <Pressable onPress={() => router.push('/accounts')} hitSlop={8}>
          <Avatar
            address={myAddress}
            size={24}
            style={{ backgroundColor: border }}
          />
        </Pressable>
        <Pressable onPress={() => router.push('/search')} hitSlop={8}>
          <Icon name="search" size={26} color={head} />
        </Pressable>
      </Row>
      <FlatList
        simultaneousHandlers={panRef}
        data={sortedRows}
        ListHeaderComponent={
          requestCount > 0 ? (
            <Pressable
              onPress={() => router.push('/xmtp/requests')}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 12,
                paddingHorizontal: 16, paddingVertical: 16,
                borderBottomWidth: 1, borderBottomColor: border,
                backgroundColor: pressed ? (dark ? '#1a1a1c' : '#f2f2f4') : 'transparent',
              })}
            >
              <Box radius={20} bg={border} align="center" justify="center" style={{ width: 40, height: 40 }}>
                <Icon name="envelope" size={20} color={head} />
              </Box>
              <Col flex={1}>
                <Text style={{ color: head, fontSize: 16, fontFamily: 'Calibre-Medium' }}>
                  Message requests
                </Text>
                <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>
                  {requestCount} pending
                </Text>
              </Col>
              <Box px={9} py={3} radius={999} bg={dark ? '#3a3a3c' : '#e4e4e8'}>
                <Text style={{ color: head, fontSize: 13, fontFamily: 'Calibre-Medium' }}>{requestCount}</Text>
              </Box>
            </Pressable>
          ) : null
        }
        extraData={[listExtraData, requestCount]}
        keyExtractor={r => r.convId}
        getItemLayout={getRowLayout}
        windowSize={11}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <Col p={32} align="center">
            <Text style={{ color: sub, textAlign: 'center' }}>
              No conversations yet. Share your address from Settings to start one.
            </Text>
          </Col>
        }
        renderItem={renderRow}
      />
      <RowActionSheet
        target={rowMenu}
        dark={dark}
        pinned={rowMenu ? pinned.has(rowMenu.convId) : false}
        onClose={() => setRowMenu(null)}
        onToggleUnread={() => {
          if (!rowMenu) return;
          const { convId, isUnread } = rowMenu;
          setRowMenu(null);
          if (isUnread) void markConvRead(convId);
          else void markConvUnread(convId);
        }}
        onTogglePin={() => {
          if (!rowMenu) return;
          const { convId } = rowMenu;
          setRowMenu(null);
          void togglePin(convId);
        }}
      />
    </Col>
  );
}

/** Bottom action sheet shown on long-pressing a channel row. v1 exposes a
 *  single toggle: Mark as read / Mark as unread (per-device via lastReadNs). */
function RowActionSheet({
  target, dark, pinned, onClose, onToggleUnread, onTogglePin,
}: {
  target: { convId: string; title: string; isUnread: boolean } | null;
  dark: boolean; pinned: boolean; onClose: () => void;
  onToggleUnread: () => void; onTogglePin: () => void;
}): React.ReactElement {
  const fg = dark ? '#9f9fa3' : '#57606a';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const head = dark ? '#ffffff' : '#000000';
  return (
    <AppModal visible={!!target} onClose={onClose}>
      <Col gap={4}>
        <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium', paddingHorizontal: 4, paddingBottom: 6 }} numberOfLines={1}>
          {target?.title ?? ''}
        </Text>
        <Pressable onPress={onToggleUnread} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
          <Icon name={target?.isUnread ? 'check' : 'envelope'} size={20} color={head} />
          <Text style={{ color: head, fontSize: 16, fontFamily: 'Calibre-Medium' }}>
            {target?.isUnread ? 'Mark as read' : 'Mark as unread'}
          </Text>
        </Pressable>
        <Pressable onPress={onTogglePin} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
          <Icon name="mapPin" size={20} color={head} />
          <Text style={{ color: head, fontSize: 16, fontFamily: 'Calibre-Medium' }}>
            {pinned ? 'Unpin' : 'Pin'}
          </Text>
        </Pressable>
        <Pressable onPress={onClose} style={{ paddingVertical: 10, alignItems: 'center' }}>
          <Text style={{ color: fg, fontSize: 14, fontFamily: 'Calibre-Medium' }}>Cancel</Text>
        </Pressable>
      </Col>
    </AppModal>
  );
}
