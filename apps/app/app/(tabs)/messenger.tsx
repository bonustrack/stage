/** Messenger — direct chat with the assistant via `POST /api/messenger/send`. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated as RNAnimated, AppState,
  FlatList, Modal, PanResponder, Pressable, Text, View, useColorScheme,
} from 'react-native';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardStickyView, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { MessengerBubble } from '../../components/MessengerBubble';
import { MessengerComposer } from '../../components/MessengerComposer';
import { ComposerGradient } from '../../components/ComposerGradient';
import { HeroIcon } from '../../components/HeroIcon';
import { loadConfig, isConfigured, type Config } from '../../lib/config';
import {
  isReaction, isTranscript, reactMessenger, reactionsByMessage, sendMessenger, transcriptsByMessage,
} from '../../lib/messenger';
import { saveBubbleCache, useCachedBubbles } from '../../lib/messenger-cache';
import {
  getMessengerLastRead, markMessengerRead, markMessengerUnreadFrom,
  subscribeMessengerLastRead, unsubscribeMessengerLastRead,
} from '../../lib/messenger-unread';
import { registerForPush, setMessengerActive } from '../../lib/push';
import { fetchHistoryPage, useTail } from '../../lib/sse';
import {
  XMTP_USER_PREFIX, isXmtpLine, useXmtpFeed, xmtpReact, xmtpReply,
} from '../../lib/xmtp';
import type { HistoryEntry } from '../../lib/types';

const MESSENGER_LINE = 'metro://messenger/owner';
const MESSENGER_USER = 'metro://messenger/user/owner';

export default function Messenger(): React.ReactElement {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const fg = dark ? '#e8ecf2' : '#1a1f29';
  const sub = dark ? '#8a94a6' : '#5a6477';
  const bg = dark ? '#000000' : '#ffffff';

  /** When the screen is opened from the Channels tab, `line` is set to a
   *  `metro://xmtp/<convId>` URI — drop straight into the local-XMTP code path
   *  and skip the daemon hop entirely. Anything else (default + the
   *  back-compat assistant chat at `metro://messenger/owner`) keeps the
   *  existing SSE-backed behavior. */
  const { line: lineParam } = useLocalSearchParams<{ line?: string }>();
  const activeLine = lineParam ?? MESSENGER_LINE;
  const xmtpMode = isXmtpLine(activeLine);

  const [cfg, setCfg] = useState<Config | null>(null);
  /** Captured once on mount → entries newer than this render with the unread style. */
  /** Track lastRead reactively so:
   *  - focus auto-mark-read → cutoff jumps to now() → unread highlight clears
   *  - explicit mark-as-unread → cutoff drops → that bubble + newer ones highlight
   *  No snapshot — Less prefers the highlight to disappear as soon as the message
   *  is read, rather than persisting for the whole session. */
  const [unreadCutoff, setUnreadCutoff] = useState(() => getMessengerLastRead());
  useEffect(() => {
    const handler = (iso: string): void => setUnreadCutoff(iso);
    subscribeMessengerLastRead(handler);
    return (): void => unsubscribeMessengerLastRead(handler);
  }, []);

  useFocusEffect(useCallback(() => {
    void loadConfig().then(c => {
      setCfg(c);
      /** Push registration is only useful for the daemon-routed messenger station;
       *  XMTP messages aren't relayed through the daemon's push pipeline (yet). */
      if (!xmtpMode && c && isConfigured(c)) {
        void registerForPush(c.daemonUrl, c.token).catch(() => { /* ignore */ });
      }
    });
    void markMessengerRead();
    /** Mark the messenger tab as foregrounded — the notification handler in
     *  lib/push.ts skips banners + shade entries while this flag is true, since
     *  the user is already seeing inbound bubbles live in the feed. Cleared on
     *  blur so backgrounded users still get notified. */
    setMessengerActive(true);
    return (): void => setMessengerActive(false);
  }, [xmtpMode]));
  /** Messenger tab can be the focused screen but the whole app might be backgrounded
   *  (phone locked, user on another app). In that case we DO want notifications, so
   *  toggle the active flag with AppState — true only when both messenger is focused
   *  AND the app is foreground. */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') setMessengerActive(false);
    });
    return (): void => sub.remove();
  }, []);

  const tailOpts = useMemo(() => ({
    daemonUrl: cfg?.daemonUrl ?? '', token: cfg?.token ?? '',
    chat: MESSENGER_LINE, includeWebhooks: false,
  }), [cfg]);

  /** Both hooks always mount; the unused one stays idle. `useTail` is suppressed
   *  in xmtp mode (enabled=false) so it doesn't open an SSE stream that the
   *  user doesn't care about; same for `useXmtpFeed` in the daemon-line path. */
  const daemonEnabled = !!cfg && isConfigured(cfg) && !xmtpMode;
  const { events: tailEvents, status: tailStatus } = useTail(tailOpts, daemonEnabled);
  const xmtpFeed = useXmtpFeed(xmtpMode ? activeLine : null, xmtpMode);
  /** Unified event stream + connection status — downstream code reads these
   *  without caring which transport produced them. */
  const events = xmtpMode ? xmtpFeed.events : tailEvents;
  const status: 'idle' | 'connecting' | 'open' | 'error' | 'closed' = xmtpMode
    ? (xmtpFeed.status === 'open' ? 'open'
      : xmtpFeed.status === 'loading' ? 'connecting'
        : xmtpFeed.status === 'error' ? 'error' : 'idle')
    : tailStatus;
  /** "My" URI changes per transport: daemon = the messenger user constant,
   *  xmtp = the inbox-id-scoped URI emitted by the daemon-side train. */
  const myUri = xmtpMode
    ? (xmtpFeed.inboxId ? `${XMTP_USER_PREFIX}${xmtpFeed.inboxId}` : XMTP_USER_PREFIX)
    : MESSENGER_USER;
  const enabled = xmtpMode ? true : (!!cfg && isConfigured(cfg));
  const [showJump, setShowJump] = useState(false);
  /** Bump to force-remount the FlatList. Used by jump-to-bottom and on focus because every
   *  variant of the scroll API (`scrollToOffset`, `scrollToIndex`, `getScrollResponder`,
   *  `getNativeScrollRef`) trips reanimated #3670 "property is not writable" on devices
   *  with Reduce Motion. Remount lands at the inverted list's default offset = bottom. */
  const [listEpoch, setListEpoch] = useState(0);
  /** Don't reconnect or remount on focus — SSE keeps streaming in the background while
   *  another tab is open, so we don't miss events. Letting the FlatList persist its
   *  state across tab switches preserves the user's scroll position (Less prefers
   *  this over snap-to-bottom on return; explicit jump button is right there). */
  const [replyingTo, setReplyingTo] = useState<{ id: string; preview: string } | null>(null);
  const [menuFor, setMenuFor] = useState<HistoryEntry | null>(null);
  /** Optimistic outbound entries — rendered immediately on send, dedupe on text+freshness when the
   *  real event arrives via SSE. */
  const [optimistic, setOptimistic] = useState<HistoryEntry[]>([]);
  /** Composer rides on KeyboardStickyView for smooth native-driver translateY. The FlatList
   *  can'​t use the same wrapper — wrapping its scrollView in Animated.View breaks
   *  scrollToOffset (`property is not writable` from inside RN internals). Fall back to
   *  bumping contentContainerStyle.paddingTop via state on keyboardDidShow/Hide; the
   *  resulting JS-thread lag is the trade-off. */
  const insets = useSafeAreaInsets();
  /** Swipe left→right on the screen → back to the Home tab, with the messenger sliding
   *  with the finger. Past 60px on release → navigate back; otherwise spring home.
   *  The bubble'​s pan only claims left-going drags so right-going ones fall through. */
  const swipeBackX = useRef(new RNAnimated.Value(0)).current;
  const backPan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: (_, g) => { swipeBackX.setValue(Math.max(0, g.dx)); },
    onPanResponderRelease: (_, g) => {
      if (g.dx >= 60) router.push('/(tabs)');
      RNAnimated.spring(swipeBackX, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
    },
    onPanResponderTerminate: () => {
      RNAnimated.spring(swipeBackX, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
    },
  }), [router, swipeBackX]);
  /** Reanimated-driven keyboard offset shared with the composer's KeyboardStickyView,
   *  so the FlatList wrapper lifts in lockstep (native thread) with the composer.
   *  The composer's translate at open = `height.value - insets.bottom` (negative),
   *  meaning it lifts by `keyboardHeight - insets.bottom`. Match that for the
   *  feed by subtracting `insets.bottom` here too — otherwise the feed overshoots
   *  by the bottom safe-area amount. Clamp ≥0 so the closed-state doesn't tug
   *  the feed down. */
  const { height: kbHeightShared } = useReanimatedKeyboardAnimation();
  const listWrapperStyle = useAnimatedStyle(() => ({
    marginBottom: Math.max(0, -kbHeightShared.value - insets.bottom),
  }));
  const listRef = useRef<FlatList<HistoryEntry>>(null);
  /** Note: explicit scroll-restore across cold opens is intentionally NOT
   *  implemented. `initialScrollIndex` calls scrollToIndex → scrollToOffset →
   *  scrollTo internally, which trips reanimated #3670 on this device. The
   *  unread separator + composer-draft persistence give the user enough
   *  context to find where they left off without crashing the feed. */

  /** Reaction + transcript events decorate their target msg — don't render as their own bubbles. */
  const reactions = useMemo(() => reactionsByMessage(events), [events]);
  const transcripts = useMemo(() => transcriptsByMessage(events), [events]);
  const cachedBubbles = useCachedBubbles();
  const liveBubbles = useMemo(
    () => events.filter(e => !isReaction(e) && !isTranscript(e)),
    [events],
  );
  /** Show cached bubbles on cold open so the feed isn'​t empty for a frame while SSE
   *  seeds. Once live events arrive, they take over and the cache gets refreshed.
   *  XMTP-mode skips the cache — `useXmtpFeed` seeds from the local sqlite store
   *  directly so there's no flash of empty + no value in re-caching elsewhere. */
  const bubbleEvents = xmtpMode
    ? liveBubbles
    : (liveBubbles.length > 0 ? liveBubbles : cachedBubbles);
  useEffect(() => {
    if (!xmtpMode && liveBubbles.length > 0) saveBubbleCache(liveBubbles);
  }, [liveBubbles, xmtpMode]);
  /** Inverted FlatList expects newest-first → put optimistic at the top. Filter out
   *  optimistic entries inline (not via useEffect) so the SSE-confirmed bubble never
   *  renders alongside its pending twin even for one frame. The useEffect schedule used
   *  to leave both visible until the next paint. */
  /** Older history paged in via /api/state?before=N&limit=M as the user scrolls
   *  up past the initial SSE seed. Deduped against `bubbleEvents` by id. */
  const [older, setOlder] = useState<HistoryEntry[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderExhausted, setOlderExhausted] = useState(false);
  const allBubbles = useMemo(() => {
    const seen = new Set(bubbleEvents.map(e => e.id));
    const olderFiltered = older.filter(e => !seen.has(e.id));
    const combined = [...bubbleEvents, ...olderFiltered];
    if (!optimistic.length) return combined;
    const live = optimistic.filter(o =>
      !combined.some(e => e.from === myUri && e.text === o.text
        && Math.abs(new Date(e.ts).getTime() - new Date(o.ts).getTime()) < 30_000),
    );
    return [...live, ...combined];
  }, [bubbleEvents, optimistic, older, myUri]);
  /** When the inverted list reaches its end (= visual TOP, user scrolled all the
   *  way up), pull the next page of older messenger entries from the daemon.
   *  Skipped in xmtp mode — `useXmtpFeed` already seeds 100 messages and there's
   *  no daemon to page through. (TODO: paginate via `conv.messages({limit, before})`.) */
  const loadOlder = useCallback(() => {
    if (xmtpMode) return;
    if (loadingOlder || olderExhausted || !cfg) return;
    setLoadingOlder(true);
    const before = bubbleEvents.length + older.length;
    void fetchHistoryPage(cfg.daemonUrl, cfg.token, before, 30)
      .then(r => {
        setLoadingOlder(false);
        if (!r.ok) return;
        const messengerOnly = r.entries.filter(e =>
          e.station === 'messenger'
          && !isReaction(e)
          && !isTranscript(e),
        );
        if (r.entries.length === 0) { setOlderExhausted(true); return; }
        if (messengerOnly.length === 0) {
          /** The page had nothing for the messenger filter — try the next one
           *  before giving up so a single sparse page doesn'​t stop pagination. */
          setOlder(prev => [...prev, ...r.entries.filter(e => e.station === 'messenger')]);
          return;
        }
        setOlder(prev => {
          const seen = new Set([...bubbleEvents, ...prev].map(e => e.id));
          return [...prev, ...messengerOnly.filter(e => !seen.has(e.id))];
        });
      })
      .catch(() => setLoadingOlder(false));
  }, [loadingOlder, olderExhausted, cfg, bubbleEvents, older, xmtpMode]);
  /** Insert a Discord-style "NEW MESSAGES" separator between unread and read
   *  entries. Skip the user's OWN messages when locating the boundary — they're
   *  trivially "read" (you sent them) so sending shouldn'​t push the separator.
   *  The separator goes immediately before the first non-mine entry with
   *  ts <= cutoff (= the newest already-read agent message). Suppress when
   *  there are no non-mine unread entries (idx 0) or no non-mine read entries
   *  (idx -1). */
  const allBubblesWithSeparator = useMemo<HistoryEntry[]>(() => {
    let separatorIdx = -1;
    let sawUnreadAgentEntry = false;
    for (let i = 0; i < allBubbles.length; i++) {
      const b = allBubbles[i];
      if (b.from === myUri) continue;
      if (b.ts > unreadCutoff) { sawUnreadAgentEntry = true; continue; }
      separatorIdx = i;
      break;
    }
    /** Only insert the separator when there'​s at least one non-mine UNREAD entry
     *  above the first non-mine read entry. Without this check, sending an own
     *  message after the cutoff would push the separator above the last read
     *  agent message even though there'​s nothing to separate. */
    if (separatorIdx <= 0 || !sawUnreadAgentEntry) return allBubbles;
    const sentinel = { id: '__unread-separator__', ts: '', station: 'messenger',
      line: activeLine, from: '', to: '' } as HistoryEntry;
    return [...allBubbles.slice(0, separatorIdx), sentinel, ...allBubbles.slice(separatorIdx)];
  }, [allBubbles, unreadCutoff, myUri, activeLine]);
  /** Once SSE has caught up, drop the now-dead optimistic entries from state so the
   *  array doesn'​t grow forever. Safe to do via effect because the displayed list
   *  already excluded them above. */
  useEffect(() => {
    if (!optimistic.length) return;
    const live = optimistic.filter(o =>
      !bubbleEvents.some(e => e.from === myUri && e.text === o.text
        && Math.abs(new Date(e.ts).getTime() - new Date(o.ts).getTime()) < 30_000),
    );
    if (live.length !== optimistic.length) setOptimistic(live);
  }, [bubbleEvents, optimistic, myUri]);
  /** Sticky-bottom for inbound messages: when a new entry arrives and the user is
   *  already at the visual bottom (`showJump=false` means scroll offset < 200px),
   *  remount the list so it lands at offset 0 again. Otherwise
   *  `maintainVisibleContentPosition` keeps them anchored to the prior bottom-item
   *  and the new entry stays just below the viewport. Skip on initial mount. */
  const prevBubbleCount = useRef(0);
  useEffect(() => {
    if (allBubbles.length > prevBubbleCount.current && prevBubbleCount.current > 0 && !showJump) {
      setListEpoch(e => e + 1);
    }
    prevBubbleCount.current = allBubbles.length;
  }, [allBubbles.length, showJump]);
  const previewOf = (e: HistoryEntry): string =>
    e.text?.slice(0, 80) || `[${(e.payload as { attachments?: { kind: string }[] } | undefined)?.attachments?.[0]?.kind ?? 'attachment'}]`;
  const onReact = useCallback((messageId: string, emoji: string) => {
    if (xmtpMode) {
      /** XMTP reactions are toggle-by-resend (the same emoji from the same
       *  inbox replaces the previous state, matching the messenger UX). For v1
       *  we always emit `action: 'added'` — the daemon-side `reactionsByMessage`
       *  reducer already handles the removed-event semantics, but the mobile UI
       *  doesn't expose a way to un-react yet. (TODO: long-press own reaction
       *  → send `removed`.) */
      void xmtpReact(activeLine, messageId, emoji)
        .catch((e: unknown) => { console.warn('xmtp react failed', e); });
      return;
    }
    if (!cfg) return;
    void reactMessenger(cfg.daemonUrl, cfg.token, messageId, emoji)
      .catch((e: unknown) => { console.warn('react failed', e); });
  }, [cfg, xmtpMode, activeLine]);

  if (!xmtpMode && cfg && !isConfigured(cfg)) {
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
    <RNAnimated.View
      {...backPan.panHandlers}
      style={{
        flex: 1, backgroundColor: bg, paddingBottom: insets.bottom,
        transform: [{ translateX: swipeBackX }],
      }}
    >
      <Reanimated.View style={[{ flex: 1 }, listWrapperStyle]}>
      <FlatList
        key={listEpoch}
        ref={listRef}
        data={allBubblesWithSeparator}
        inverted
        showsVerticalScrollIndicator={false}
        /** Anchor the bottom-visible item (= newest on inverted) so as new bubbles or the
         *  initial seed lands, scroll stays pinned to the latest message. */
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        keyExtractor={e => e.id}
        /** `flex:1` to fill the animated wrapper above. The wrapper carries the keyboard
         *  marginBottom on the native thread; wrapping the FlatList itself in Reanimated
         *  is unsafe (crashes Fabric / reanimated #3670). */
        style={{ flex: 1 }}
        /** Inverted: paddingTop = visual BOTTOM (composer side), paddingBottom = visual TOP
         *  (nav side). Bump the top so the oldest message clears the absolute top-nav strip
         *  when the user scrolls all the way up. */
        contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.top + 44 + 8 }}
        onScroll={(ev) => { setShowJump(ev.nativeEvent.contentOffset.y > 200); }}
        scrollEventThrottle={32}
        /** Inverted list: end-of-data = visual TOP. Pull the next page of older
         *  messenger entries from the daemon when the user scrolls all the way up. */
        onEndReached={loadOlder}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => item.id === '__unread-separator__' ? (
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 14, paddingVertical: 6, gap: 10,
          }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#d96868' }} />
            <Text style={{ color: '#d96868', fontSize: 11, fontFamily: 'Calibre-Semibold', letterSpacing: 0.5 }}>
              NEW MESSAGES
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#d96868' }} />
          </View>
        ) : (
          <MessengerBubble
            entry={item}
            dark={dark}
            myUri={myUri}
            unread={(xmtpMode || item.station === 'messenger') && item.from !== myUri && item.ts > unreadCutoff && !isReaction(item) && !isTranscript(item)}
            pending={item.id.startsWith('tmp_')}
            replyTarget={replyingTo?.id === item.id}
            daemonUrl={cfg?.daemonUrl ?? ''}
            token={cfg?.token ?? ''}
            reactions={reactions.get(item.id)}
            transcript={transcripts.get(item.id)}
            replyPreview={item.replyTo ? previewOf(events.find(e => e.id === item.replyTo) ?? item) : undefined}
            onReact={(emoji) => onReact(item.id, emoji)}
            onReply={() => setReplyingTo({ id: item.id, preview: previewOf(item) })}
            onLongPress={() => setMenuFor(item)}
            onAnswer={(label) => {
              if (xmtpMode) {
                /** Answer-to-question buttons appear on questions sent by the agent;
                 *  in XMTP mode reply via the local client instead of the daemon. */
                void xmtpReply(activeLine, item.id, label)
                  .catch((e: unknown) => { console.warn('xmtp answer failed', e); });
                return;
              }
              if (!cfg) return;
              void sendMessenger(cfg.daemonUrl, cfg.token, label, [], item.id)
                .catch((e: unknown) => { console.warn('answer send failed', e); });
            }}
          />
        )}
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ color: sub }}>Type a message below to start chatting.</Text>
          </View>
        }
        keyboardShouldPersistTaps="handled"
      />
      </Reanimated.View>
      {/** Top nav: solid bg strip mirrors the composer footer + extends UP to cover the
       *  status-bar area, so content sliding up under the keyboard doesn'​t show through
       *  behind the system icons. */}
      <View style={{
        position: 'absolute', top: -insets.top, left: 0, right: 0, zIndex: 2,
        height: 44 + insets.top, paddingTop: insets.top, paddingHorizontal: 14, backgroundColor: bg,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      }}>
        <Pressable
          onPress={() => router.push('/(tabs)')}
          hitSlop={10}
          style={{ position: 'absolute', left: 14, top: insets.top + 4, padding: 6 }}
        >
          <HeroIcon name="arrowLeft" size={22} color={fg} />
        </Pressable>
        {status !== 'open' && enabled ? (
          <View style={{
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
      </View>
      {/** Fade strip below the top nav — mirrors the composer'​s top fade. */}
      <ComposerGradient bg={bg} direction="up" top={44} height={10} />
      {showJump ? (
        <Pressable
          onPress={() => {
            /** Every variant of FlatList's scroll API trips reanimated #3670 on this
             *  device. Sidestep the scroll API entirely: bump the `key` so the FlatList
             *  remounts. Default offset on an inverted list = 0 = visual bottom = newest. */
            setListEpoch(e => e + 1);
            setShowJump(false);
          }}
          style={{
            position: 'absolute', alignSelf: 'center', bottom: 170, zIndex: 3,
            width: 36, height: 36, borderRadius: 999,
            backgroundColor: '#ffffff',
            alignItems: 'center', justifyContent: 'center',
            shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
          }}
        >
          <HeroIcon name="arrowDown" size={18} color="#000000" />
        </Pressable>
      ) : null}
      {cfg || xmtpMode ? (
        <KeyboardStickyView offset={{ opened: insets.bottom }}>
        <MessengerComposer
          /** Daemon URL/token are unused in xmtp mode but the composer always expects
           *  the prop pair — pass empty strings when we don't have config. */
          daemonUrl={cfg?.daemonUrl ?? ''} token={cfg?.token ?? ''} dark={dark}
          xmtpLine={xmtpMode ? activeLine : undefined}
          replyingTo={replyingTo ?? undefined}
          onClearReply={() => setReplyingTo(null)}
          onOptimistic={({ localId, text, attachments, replyTo }) => {
            /** Inverted FlatList + `maintainVisibleContentPosition` + prepended optimistic
             *  entry = bubble appears at the visual bottom automatically. No scrollToOffset
             *  needed — and avoiding it dodges the reanimated #3670 "property is not
             *  writable" red-box that try/catch can't swallow (it fires through LogBox,
             *  not as a sync throw). */
            setOptimistic(prev => [{
              id: localId, ts: new Date().toISOString(),
              station: xmtpMode ? 'xmtp' : 'messenger', line: activeLine,
              from: myUri, to: activeLine,
              text: text || undefined,
              ...(replyTo ? { replyTo } : {}),
              ...(attachments.length ? { payload: { attachments } } : {}),
            } as HistoryEntry, ...prev]);
            /** Always remount so the user lands on their own bubble — even at the visual
             *  bottom `maintainVisibleContentPosition` anchors the previously-visible
             *  content and the new entry falls below the viewport. Brief flash, but the
             *  bubble is always visible after sending. */
            setListEpoch(e => e + 1);
            setShowJump(false);
          }}
          onSent={(localId) => {
            /** Drop the optimistic entry as soon as the send resolves — XMTP's
             *  streamMessages doesn't always replay self-sends, so waiting for the
             *  feed echo left bubbles stranded in pending state. */
            setOptimistic(prev => prev.filter(o => o.id !== localId));
          }}
        />
        </KeyboardStickyView>
      ) : null}
      <BubbleActionMenu
        target={menuFor}
        dark={dark}
        onClose={() => setMenuFor(null)}
        onReact={emoji => { if (menuFor) onReact(menuFor.id, emoji); setMenuFor(null); }}
        onReply={() => {
          if (menuFor) setReplyingTo({ id: menuFor.id, preview: previewOf(menuFor) });
          setMenuFor(null);
        }}
        onCopy={() => {
          if (menuFor?.text) void Clipboard.setStringAsync(menuFor.text);
          setMenuFor(null);
        }}
        onMarkUnread={() => {
          if (menuFor) void markMessengerUnreadFrom(menuFor.ts);
          setMenuFor(null);
        }}
      />
    </RNAnimated.View>
  );
}

const ACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '🔥', '🎉'] as const;
function BubbleActionMenu({
  target, dark, onClose, onReact, onReply, onCopy, onMarkUnread,
}: {
  target: HistoryEntry | null; dark: boolean; onClose: () => void;
  onReact: (emoji: string) => void; onReply: () => void; onCopy: () => void;
  onMarkUnread: () => void;
}): React.ReactElement {
  const sheetBg = dark ? '#1d2230' : '#ffffff';
  const fg = dark ? '#e8ecf2' : '#1a1f29';
  const sub = dark ? '#8a94a6' : '#5a6477';
  return (
    <Modal visible={!!target} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <Pressable onPress={e => e.stopPropagation()} style={{
          backgroundColor: sheetBg, borderTopLeftRadius: 16, borderTopRightRadius: 16,
          padding: 16, paddingBottom: 24, gap: 10,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 8 }}>
            {ACTION_EMOJIS.map(e => (
              <Pressable key={e} onPress={() => onReact(e)} hitSlop={8}>
                <Text style={{ fontSize: 28 }}>{e}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={onReply} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
            <HeroIcon name="reply" size={20} color={fg} />
            <Text style={{ color: fg, fontSize: 16 }}>Reply</Text>
          </Pressable>
          {target?.text ? (
            <Pressable onPress={onCopy} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
              <HeroIcon name="copy" size={20} color={fg} />
              <Text style={{ color: fg, fontSize: 16 }}>Copy text</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onMarkUnread} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
            <HeroIcon name="arrowDown" size={20} color={fg} />
            <Text style={{ color: fg, fontSize: 16 }}>Mark as unread</Text>
          </Pressable>
          <Pressable onPress={onClose} style={{ paddingVertical: 10, alignItems: 'center' }}>
            <Text style={{ color: sub, fontSize: 14 }}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
