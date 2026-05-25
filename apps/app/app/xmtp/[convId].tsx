/** XMTP conversation view — opened from the messenger tab list. Talks to the
 *  local XMTP client directly; no daemon hop. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated as RNAnimated, FlatList, Image, Modal, PanResponder, Pressable, Text, View,
} from 'react-native';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardStickyView, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { MessengerBubble } from '../../components/MessengerBubble';
import { MessengerComposer } from '../../components/MessengerComposer';
import { ComposerGradient } from '../../components/ComposerGradient';
import { HeroIcon } from '../../components/HeroIcon';
import {
  XMTP_USER_PREFIX, lineOfConv, useXmtpFeed, xmtpReact, xmtpReply,
  convOfLine, peerEthAddressOfDm, groupMemberEthAddresses, stampBoxAvatarUrl,
} from '../../lib/xmtp';
import { useEffectiveColorScheme } from '../../lib/theme';
import type { HistoryEntry } from '../../lib/types';

/** Reaction events decorate their target msg — fold them into per-message,
 *  per-emoji counts rather than rendering as standalone bubbles. */
function reactionsByMessage(events: HistoryEntry[]): Map<string, Map<string, number>> {
  const latest = new Map<string, { ts: string; removed: boolean }>();
  for (const e of events) {
    const p = e.payload as { reactTo?: string; emoji?: string; removed?: boolean } | undefined;
    if (!p?.reactTo || !p.emoji) continue;
    const k = `${p.reactTo} ${p.emoji} ${e.from}`;
    const cur = latest.get(k);
    if (!cur || cur.ts < e.ts) latest.set(k, { ts: e.ts, removed: !!p.removed });
  }
  const out = new Map<string, Map<string, number>>();
  for (const [k, v] of latest) {
    if (v.removed) continue;
    const [msgId, emoji] = k.split(' ');
    let m = out.get(msgId);
    if (!m) { m = new Map(); out.set(msgId, m); }
    m.set(emoji, (m.get(emoji) ?? 0) + 1);
  }
  return out;
}

function isReaction(e: HistoryEntry): boolean {
  const p = e.payload as { reactTo?: string } | undefined;
  return Boolean(p?.reactTo);
}

/** Stamp.fyi avatars shown in the conversation header. Mirrors the channels-
 *  list row avatar but locked at 24px per the design spec. DMs render a single
 *  circle; groups stack up to 3 member avatars with a "+N" overflow tile. */
function HeaderAvatars({ peerAddr, memberAddrs, bg }: {
  peerAddr: string | null; memberAddrs: string[]; bg: string;
}): React.ReactElement | null {
  const SIZE = 24;
  if (peerAddr) {
    return (
      <Image
        source={{ uri: stampBoxAvatarUrl(peerAddr, SIZE * 2) }}
        style={{ width: SIZE, height: SIZE, borderRadius: 999, backgroundColor: '#1a1f29' }}
      />
    );
  }
  const visible = memberAddrs.slice(0, 3);
  const overflow = memberAddrs.length - 3;
  if (visible.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {visible.map((a, i) => (
        <Image
          key={a.toLowerCase()}
          source={{ uri: stampBoxAvatarUrl(a, SIZE * 2) }}
          style={{
            width: SIZE, height: SIZE, borderRadius: 999, backgroundColor: '#1a1f29',
            borderWidth: 2, borderColor: bg, marginLeft: i === 0 ? 0 : -8,
          }}
        />
      ))}
      {overflow > 0 ? (
        <View style={{
          width: SIZE, height: SIZE, borderRadius: 999, backgroundColor: '#3a4250',
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 2, borderColor: bg, marginLeft: -8,
        }}>
          <Text style={{ color: '#ffffff', fontSize: 9 }}>+{overflow}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function XmtpConversation(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const fg = dark ? '#e8ecf2' : '#1a1f29';
  const sub = dark ? '#8a94a6' : '#5a6477';
  const bg = dark ? '#000000' : '#ffffff';

  const { convId } = useLocalSearchParams<{ convId: string }>();
  const activeLine = lineOfConv(convId ?? '');

  const xmtpFeed = useXmtpFeed(activeLine, !!convId);
  const events = xmtpFeed.events;
  const status: 'idle' | 'connecting' | 'open' | 'error' = xmtpFeed.status === 'open' ? 'open'
    : xmtpFeed.status === 'loading' ? 'connecting'
      : xmtpFeed.status === 'error' ? 'error' : 'idle';
  const myUri = xmtpFeed.inboxId ? `${XMTP_USER_PREFIX}${xmtpFeed.inboxId}` : XMTP_USER_PREFIX;

  const [showJump, setShowJump] = useState(false);
  /** Bump to force-remount the FlatList. Used by jump-to-bottom because every variant of
   *  the scroll API (`scrollToOffset`, `scrollToIndex`, `getScrollResponder`,
   *  `getNativeScrollRef`) trips reanimated #3670 "property is not writable" on devices
   *  with Reduce Motion. Remount lands at the inverted list's default offset = bottom. */
  const [listEpoch, setListEpoch] = useState(0);
  const [replyingTo, setReplyingTo] = useState<{ id: string; preview: string } | null>(null);
  const [menuFor, setMenuFor] = useState<HistoryEntry | null>(null);
  /** Optimistic outbound entries — rendered immediately on send, dropped once the composer
   *  resolves its send promise (XMTP self-sends don't always come back via streamMessages). */
  const [optimistic, setOptimistic] = useState<HistoryEntry[]>([]);
  /** Per-conversation member addresses, resolved once on mount. `peerAddr` is
   *  set for DMs (single avatar), `memberAddrs` for groups (stacked). */
  const [peerAddr, setPeerAddr] = useState<string | null>(null);
  const [memberAddrs, setMemberAddrs] = useState<string[]>([]);
  useEffect(() => {
    if (!convId) return;
    let cancelled = false;
    void (async (): Promise<void> => {
      const conv = await convOfLine(activeLine);
      if (cancelled || !conv) return;
      const peer = await peerEthAddressOfDm(conv);
      if (cancelled) return;
      if (peer) { setPeerAddr(peer); return; }
      const members = await groupMemberEthAddresses(conv);
      if (!cancelled) setMemberAddrs(members);
    })();
    return (): void => { cancelled = true; };
  }, [activeLine, convId]);
  const insets = useSafeAreaInsets();
  /** Swipe left→right on the screen → back to the messenger list, with the screen sliding
   *  with the finger. Past 60px on release → navigate back; otherwise spring home.
   *  The bubble's pan only claims left-going drags so right-going ones fall through. */
  const swipeBackX = useRef(new RNAnimated.Value(0)).current;
  const backPan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: (_, g) => { swipeBackX.setValue(Math.max(0, g.dx)); },
    onPanResponderRelease: (_, g) => {
      if (g.dx >= 60) router.replace('/');
      RNAnimated.spring(swipeBackX, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
    },
    onPanResponderTerminate: () => {
      RNAnimated.spring(swipeBackX, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
    },
  }), [router, swipeBackX]);
  /** Reanimated-driven keyboard offset shared with the composer's KeyboardStickyView,
   *  so the FlatList wrapper lifts in lockstep (native thread) with the composer.
   *  Match the composer's `height.value - insets.bottom` translate by subtracting
   *  `insets.bottom` here too — otherwise the feed overshoots. Clamp ≥0. */
  const { height: kbHeightShared } = useReanimatedKeyboardAnimation();
  const listWrapperStyle = useAnimatedStyle(() => ({
    marginBottom: Math.max(0, -kbHeightShared.value - insets.bottom),
  }));
  const listRef = useRef<FlatList<HistoryEntry>>(null);

  /** Reaction events decorate their target msg — don't render as their own bubbles. */
  const reactions = useMemo(() => reactionsByMessage(events), [events]);
  const liveBubbles = useMemo(
    () => events.filter(e => !isReaction(e)),
    [events],
  );
  /** Inverted FlatList expects newest-first → put optimistic at the top. Filter out
   *  optimistic entries inline so the streamed-confirmed bubble never renders
   *  alongside its pending twin even for one frame. */
  const allBubbles = useMemo(() => {
    if (!optimistic.length) return liveBubbles;
    const live = optimistic.filter(o =>
      !liveBubbles.some(e => e.from === myUri && e.text === o.text
        && Math.abs(new Date(e.ts).getTime() - new Date(o.ts).getTime()) < 30_000),
    );
    return [...live, ...liveBubbles];
  }, [liveBubbles, optimistic, myUri]);
  /** Once the live feed has caught up, drop the now-dead optimistic entries from state. */
  useEffect(() => {
    if (!optimistic.length) return;
    const live = optimistic.filter(o =>
      !liveBubbles.some(e => e.from === myUri && e.text === o.text
        && Math.abs(new Date(e.ts).getTime() - new Date(o.ts).getTime()) < 30_000),
    );
    if (live.length !== optimistic.length) setOptimistic(live);
  }, [liveBubbles, optimistic, myUri]);
  /** Sticky-bottom for inbound messages: when a new entry arrives and the user is
   *  already at the visual bottom (`showJump=false` means scroll offset < 200px),
   *  remount the list so it lands at offset 0 again. Skip on initial mount. */
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
    /** XMTP reactions are toggle-by-resend (the same emoji from the same inbox replaces
     *  the previous state). For v1 we always emit `action: 'added'` — the mobile UI
     *  doesn't expose a way to un-react yet. (TODO: long-press own reaction → send
     *  `removed`.) */
    void xmtpReact(activeLine, messageId, emoji)
      .catch((e: unknown) => { console.warn('xmtp react failed', e); });
  }, [activeLine]);

  if (!convId) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
        <Text style={{ color: sub }}>Missing conversation id.</Text>
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
        data={allBubbles}
        inverted
        showsVerticalScrollIndicator={false}
        /** Anchor the bottom-visible item (= newest on inverted) so as new bubbles or the
         *  initial seed lands, scroll stays pinned to the latest message. */
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        keyExtractor={e => e.id}
        style={{ flex: 1 }}
        /** Inverted: paddingTop = visual BOTTOM (composer side), paddingBottom = visual TOP
         *  (nav side). Bump the top so the oldest message clears the absolute top-nav strip. */
        contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.top + 44 + 8 }}
        onScroll={(ev) => { setShowJump(ev.nativeEvent.contentOffset.y > 200); }}
        scrollEventThrottle={32}
        renderItem={({ item }) => (
          <MessengerBubble
            entry={item}
            dark={dark}
            myUri={myUri}
            unread={false}
            pending={item.id.startsWith('tmp_')}
            replyTarget={replyingTo?.id === item.id}
            daemonUrl=""
            token=""
            reactions={reactions.get(item.id)}
            replyPreview={item.replyTo ? previewOf(events.find(e => e.id === item.replyTo) ?? item) : undefined}
            onReact={(emoji) => onReact(item.id, emoji)}
            onReply={() => setReplyingTo({ id: item.id, preview: previewOf(item) })}
            onLongPress={() => setMenuFor(item)}
            onAnswer={(label) => {
              void xmtpReply(activeLine, item.id, label)
                .catch((e: unknown) => { console.warn('xmtp answer failed', e); });
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
       *  status-bar area, so content sliding up under the keyboard doesn't show through
       *  behind the system icons. */}
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
        height: 44 + insets.top, paddingTop: insets.top, paddingHorizontal: 14, backgroundColor: bg,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      }}>
        <Pressable
          onPress={() => router.replace('/')}
          hitSlop={10}
          style={{ position: 'absolute', left: 14, top: insets.top + 4, padding: 6 }}
        >
          <HeroIcon name="arrowLeft" size={22} color={fg} />
        </Pressable>
        {status !== 'open' ? (
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
        ) : (
          <HeaderAvatars peerAddr={peerAddr} memberAddrs={memberAddrs} bg={bg} />
        )}
      </View>
      {/** Fade strip below the top nav — mirrors the composer's top fade. Position it
       *  flush against the nav bottom (which sits at `44 + insets.top`), so the solid
       *  bg fades smoothly into the scrolling content beneath. */}
      <ComposerGradient bg={bg} direction="up" top={44 + insets.top} height={10} />
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
      <KeyboardStickyView offset={{ opened: insets.bottom }}>
      <MessengerComposer
        /** Daemon URL/token are unused in xmtp mode but the composer always expects
         *  the prop pair — pass empty strings. */
        daemonUrl="" token="" dark={dark}
        xmtpLine={activeLine}
        replyingTo={replyingTo ?? undefined}
        onClearReply={() => setReplyingTo(null)}
        onOptimistic={({ localId, text, attachments, replyTo }) => {
          /** Inverted FlatList + `maintainVisibleContentPosition` + prepended optimistic
           *  entry = bubble appears at the visual bottom automatically. */
          setOptimistic(prev => [{
            id: localId, ts: new Date().toISOString(),
            station: 'xmtp', line: activeLine,
            from: myUri, to: activeLine,
            text: text || undefined,
            ...(replyTo ? { replyTo } : {}),
            ...(attachments.length ? { payload: { attachments } } : {}),
          } as HistoryEntry, ...prev]);
          /** Always remount so the user lands on their own bubble — `maintainVisibleContentPosition`
           *  anchors the previously-visible content and the new entry falls below the viewport. */
          setListEpoch(e => e + 1);
          setShowJump(false);
        }}
        onSent={(localId) => {
          /** Drop the optimistic entry as soon as the send resolves — XMTP's streamMessages
           *  doesn't always replay self-sends, so waiting for the feed echo left bubbles
           *  stranded in pending state. */
          setOptimistic(prev => prev.filter(o => o.id !== localId));
        }}
      />
      </KeyboardStickyView>
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
