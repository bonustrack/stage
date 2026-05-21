/** Messenger — direct chat with the assistant via `POST /api/messenger/send`. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated as RNAnimated,
  FlatList, Keyboard, Modal, PanResponder, Pressable, RefreshControl, Text, View, useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { MessengerBubble } from '../../components/MessengerBubble';
import { MessengerComposer } from '../../components/MessengerComposer';
import { ComposerGradient } from '../../components/ComposerGradient';
import { HeroIcon } from '../../components/HeroIcon';
import { loadConfig, isConfigured, type Config } from '../../lib/config';
import {
  isReaction, isTranscript, reactMessenger, reactionsByMessage, transcriptsByMessage,
} from '../../lib/messenger';
import { saveBubbleCache, useCachedBubbles } from '../../lib/messenger-cache';
import { getMessengerLastRead, markMessengerRead } from '../../lib/messenger-unread';
import { registerForPush } from '../../lib/push';
import { useTail } from '../../lib/sse';
import type { HistoryEntry } from '../../lib/types';

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
  const [showJump, setShowJump] = useState(false);
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
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const listRef = useRef<FlatList<HistoryEntry>>(null);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    reconnect();
    /** useTail.reconnect is sync; brief spinner pretends until the next render delivers seed. */
    setTimeout(() => setRefreshing(false), 600);
  }, [reconnect]);

  /** Reaction + transcript events decorate their target msg — don't render as their own bubbles. */
  const reactions = useMemo(() => reactionsByMessage(events), [events]);
  const transcripts = useMemo(() => transcriptsByMessage(events), [events]);
  const cachedBubbles = useCachedBubbles();
  const liveBubbles = useMemo(
    () => events.filter(e => !isReaction(e) && !isTranscript(e)),
    [events],
  );
  /** Show cached bubbles on cold open so the feed isn'​t empty for a frame while SSE
   *  seeds. Once live events arrive, they take over and the cache gets refreshed. */
  const bubbleEvents = liveBubbles.length > 0 ? liveBubbles : cachedBubbles;
  useEffect(() => { if (liveBubbles.length > 0) saveBubbleCache(liveBubbles); }, [liveBubbles]);
  /** Drop optimistic entries that a real SSE event now covers (same text + sent within 30s). */
  useEffect(() => {
    if (!optimistic.length) return;
    setOptimistic(prev => prev.filter(o =>
      !bubbleEvents.some(e => e.from === MESSENGER_USER && e.text === o.text
        && Math.abs(new Date(e.ts).getTime() - new Date(o.ts).getTime()) < 30_000),
    ));
  }, [bubbleEvents, optimistic.length]);
  /** Inverted FlatList expects newest-first → put optimistic at the top. */
  const allBubbles = useMemo(() => [...optimistic, ...bubbleEvents], [bubbleEvents, optimistic]);
  const previewOf = (e: HistoryEntry): string =>
    e.text?.slice(0, 80) || `[${(e.payload as { attachments?: { kind: string }[] } | undefined)?.attachments?.[0]?.kind ?? 'attachment'}]`;
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
    <RNAnimated.View
      {...backPan.panHandlers}
      style={{
        flex: 1, backgroundColor: bg, paddingBottom: insets.bottom,
        transform: [{ translateX: swipeBackX }],
      }}
    >
      <FlatList
        ref={listRef}
        data={allBubbles}
        inverted
        showsVerticalScrollIndicator={false}
        /** Anchor the bottom-visible item (= newest on inverted) so as new bubbles or the
         *  initial seed lands, scroll stays pinned to the latest message. */
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        keyExtractor={e => e.id}
        /** Lift the FlatList'​s bottom edge by kbHeight when the keyboard is open so the
         *  newest message stays above the keyboard (rather than getting clipped behind it). */
        style={{ marginBottom: kbHeight }}
        /** Inverted: paddingTop = visual BOTTOM (composer side), paddingBottom = visual TOP
         *  (nav side). Bump the top so the oldest message clears the absolute top-nav strip
         *  when the user scrolls all the way up. */
        contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.top + 44 + 8 }}
        onScroll={(ev) => { setShowJump(ev.nativeEvent.contentOffset.y > 200); }}
        scrollEventThrottle={32}
        renderItem={({ item }) => (
          <MessengerBubble
            entry={item}
            dark={dark}
            unread={item.from !== MESSENGER_USER && item.station === 'messenger' && item.ts > unreadCutoff}
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
            /** scrollToOffset throws on this device (Reanimated freezes a FlatList slot);
             *  swallow so the press at least hides the button cleanly. See
             *  react-native-reanimated #3670 for the upstream story. */
            try { listRef.current?.scrollToOffset({ offset: 0, animated: true }); }
            catch { /* ignore */ }
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
      {cfg ? (
        <KeyboardStickyView offset={{ opened: insets.bottom }}>
        <MessengerComposer
          daemonUrl={cfg.daemonUrl} token={cfg.token} dark={dark}
          replyingTo={replyingTo ?? undefined}
          onClearReply={() => setReplyingTo(null)}
          onOptimistic={({ localId, text, attachments, replyTo }) => {
            setOptimistic(prev => [{
              id: localId, ts: new Date().toISOString(),
              station: 'messenger', line: MESSENGER_LINE,
              from: MESSENGER_USER, to: MESSENGER_LINE,
              text: text || undefined,
              ...(replyTo ? { replyTo } : {}),
              ...(attachments.length ? { payload: { attachments } } : {}),
            } as HistoryEntry, ...prev]);
            /** Snap back to the bottom so the user sees their bubble appear (try/catch
             *  because the scroll API can throw on this device — see commit history). */
            try { listRef.current?.scrollToOffset({ offset: 0, animated: true }); } catch { /* ignore */ }
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
      />
    </RNAnimated.View>
  );
}

const ACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '🔥', '🎉'] as const;
function BubbleActionMenu({
  target, dark, onClose, onReact, onReply, onCopy,
}: {
  target: HistoryEntry | null; dark: boolean; onClose: () => void;
  onReact: (emoji: string) => void; onReply: () => void; onCopy: () => void;
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
          <Pressable onPress={onClose} style={{ paddingVertical: 10, alignItems: 'center' }}>
            <Text style={{ color: sub, fontSize: 14 }}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
