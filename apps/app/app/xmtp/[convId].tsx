/** XMTP conversation view — opened from the messenger tab list. Talks to the
 *  local XMTP client directly; no daemon hop. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated as RNAnimated, FlatList, Image, InteractionManager, Modal, Pressable, Share, Text, View,
} from 'react-native';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardStickyView, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { MessengerBubble } from '../../components/MessengerBubble';
import { usePeerProfiles, getPeerName, getPeerAvatar } from '../../lib/peerProfiles';
import { useConvMeta } from '../../lib/useConvMeta';
import { Spinner } from '../../components/Spinner';
import { avatarRenderUrl } from '@metro-labs/client/profile/snapshot';
import { MessengerComposer } from '../../components/MessengerComposer';
import { ComposerGradient } from '../../components/ComposerGradient';
import { HeroIcon } from '../../components/HeroIcon';
import {
  XMTP_USER_PREFIX, lineOfConv, useXmtpFeed, xmtpReact, xmtpReply,
  stampBoxAvatarUrl,
} from '../../lib/xmtp';
import { markConvRead } from '../../lib/channelsCache';
import { useEffectiveColorScheme } from '../../lib/theme';
import type { HistoryEntry } from '../../lib/types';

/** Whether an entry carries attachments — used to dedup an optimistic
 *  attachment-only send (empty text) against its confirmed twin. */
function hasAttachments(e: HistoryEntry): boolean {
  return (((e.payload as { attachments?: unknown[] } | undefined)?.attachments?.length) ?? 0) > 0;
}

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
function HeaderAvatar({ peerAddr, groupImage, border }: {
  peerAddr: string | null; groupImage: string; border: string;
}): React.ReactElement | null {
  const SIZE = 24;
  /** Show the leading avatar for a 1-1 (the peer's custom avatar, else their
   *  identicon) or for a group that has its own uploaded image. Groups without
   *  an image show nothing — no member-avatar fallback. */
  let uri: string | null = null;
  if (peerAddr) {
    const av = getPeerAvatar(peerAddr);
    uri = av ? avatarRenderUrl(peerAddr, av, SIZE * 2) : stampBoxAvatarUrl(peerAddr, SIZE * 2);
  } else if (groupImage) {
    uri = avatarRenderUrl('', groupImage, SIZE * 2);
  }
  if (!uri) return null;
  return (
    <Image source={{ uri }} style={{ width: SIZE, height: SIZE, borderRadius: 999, backgroundColor: border }} />
  );
}

export default function XmtpConversation(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const fg = dark ? '#9f9fa3' : '#57606a';
  const head = dark ? '#ffffff' : '#000000';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const bg = dark ? '#0e0f10' : '#ffffff';

  const { convId } = useLocalSearchParams<{ convId: string }>();
  const activeLine = lineOfConv(convId ?? '');

  const xmtpFeed = useXmtpFeed(activeLine, !!convId);
  const events = xmtpFeed.events;
  /** Mark the conversation as read whenever the latest event id changes —
   *  uses `Date.now() * 1e6` as an upper bound in nanoseconds so any
   *  not-yet-seen message also flips to read on the next mount. */
  useEffect(() => {
    if (!convId) return;
    void markConvRead(convId);
  }, [convId, events.length]);
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
  /** Conversation metadata via TanStack Query — cached by convId so the topnav
   *  title + avatar render instantly on the second open (groupName: null = not
   *  resolved, '' = no name; isGroup gates the title→/group affordance). */
  const { peerAddr, memberAddrs, inboxToAddr, groupName, groupImage, isGroup } = useConvMeta(convId);
  const senderEthOf = useCallback((from: string): string | null => {
    if (!from.startsWith(XMTP_USER_PREFIX)) return null;
    const inboxId = from.slice(XMTP_USER_PREFIX.length);
    return inboxToAddr[inboxId] ?? null;
  }, [inboxToAddr]);

  /** Resolve peer + member profiles → DM display name + avatar cache-busters. */
  const profilesVersion = usePeerProfiles([peerAddr, ...memberAddrs]);

  const insets = useSafeAreaInsets();
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
  /** An optimistic entry is "confirmed" once a live message from us lands within
   *  30s that matches either its text or (for attachment-only sends, where text
   *  is empty) its attachment presence — so optimistic images solidify into the
   *  real bubble instead of lingering as a faded duplicate. */
  const isConfirmed = useCallback((o: HistoryEntry): boolean =>
    liveBubbles.some(e => e.from === myUri
      && Math.abs(new Date(e.ts).getTime() - new Date(o.ts).getTime()) < 30_000
      && (e.text === o.text || (hasAttachments(o) && hasAttachments(e)))),
  [liveBubbles, myUri]);
  const allBubbles = useMemo(() => {
    if (!optimistic.length) return liveBubbles;
    return [...optimistic.filter(o => !isConfirmed(o)), ...liveBubbles];
  }, [liveBubbles, optimistic, isConfirmed]);
  /** Once the live feed has caught up, drop the now-dead optimistic entries from state. */
  useEffect(() => {
    if (!optimistic.length) return;
    const live = optimistic.filter(o => !isConfirmed(o));
    if (live.length !== optimistic.length) setOptimistic(live);
  }, [liveBubbles, optimistic, isConfirmed]);
  /** Sticky-bottom for inbound messages: when a new entry arrives and the user is
   *  already at the visual bottom (`showJump=false` means scroll offset < 200px),
   *  remount the list so it lands at offset 0 again. Skip on initial mount. */
  const prevBubbleCount = useRef(0);
  useEffect(() => {
    if (allBubbles.length > prevBubbleCount.current && prevBubbleCount.current > 0) {
      /** New message arrived while we were at the visual bottom — keep us pinned
       *  by force-remounting + clearing the jump-button. Without the explicit
       *  setShowJump(false) the inverted list sometimes reports a stale large
       *  offset after maintainVisibleContentPosition shifts content, leaving
       *  the button visible despite the user being at offset 0. */
      if (!showJump) {
        setListEpoch(e => e + 1);
      }
      setShowJump(false);
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
      style={{
        flex: 1, backgroundColor: bg, paddingBottom: insets.bottom,
      }}
    >
      <Reanimated.View style={[{ flex: 1 }, listWrapperStyle]}>
      <FlatList
        key={listEpoch}
        ref={listRef}
        data={allBubbles}
        extraData={profilesVersion}
        inverted
        showsVerticalScrollIndicator={false}
        /** Anchor the bottom-visible item (= newest on inverted) so as new bubbles or the
         *  initial seed lands, scroll stays pinned to the latest message. */
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        keyExtractor={e => e.id}
        style={{ flex: 1 }}
        /** Inverted: paddingTop = visual BOTTOM (composer side), paddingBottom = visual TOP
         *  (nav side). Bump the top so the oldest message clears the absolute top-nav strip. */
        contentContainerStyle={{ paddingTop: 24, paddingBottom: insets.top + 52 + 24 }}
        onScroll={(ev) => { setShowJump(ev.nativeEvent.contentOffset.y > 200); }}
        scrollEventThrottle={32}
        /** Silent fallback — `scrollToIndex` on a virtualised inverted list
         *  can fire before the target row has rendered. Without this handler
         *  RN's red-screen pops on the dev build. We just no-op; the bubble
         *  still highlights via `replyTarget`, so the user finds it on
         *  manual scroll. */
        onScrollToIndexFailed={() => undefined}
        renderItem={({ item }) => (
          <MessengerBubble
            entry={item}
            dark={dark}
            myUri={myUri}
            senderEthAddress={senderEthOf(item.from)}
            onAvatarPress={(addr) => router.push({ pathname: '/user/[address]', params: { address: addr } })}
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
            {status === 'open'
              ? <Text style={{ color: sub }}>Type a message below to start chatting.</Text>
              : <Spinner size={28} color={head} />}
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
        height: 52 + insets.top, paddingTop: insets.top, backgroundColor: bg,
        flexDirection: 'row', alignItems: 'stretch',
        borderBottomWidth: 1, borderBottomColor: dark ? '#282a2d' : '#e4e4e5',
      }}>
        <Pressable
          onPress={() => router.replace('/')}
          style={{ paddingLeft: 14, paddingRight: 8, justifyContent: 'center' }}
        >
          <HeroIcon name="arrowLeft" size={22} color={fg} />
        </Pressable>
        {/** Everything right of the back arrow is one tap target → the
         *   group/channel detail page (or the peer's profile for a DM).
         *   Fills full height + to the right edge so 100% is clickable. */}
        <Pressable
          onPress={() => {
            if (isGroup) router.push({ pathname: '/group/[convId]', params: { convId: convId ?? '' } });
            else if (peerAddr) router.push({ pathname: '/user/[address]', params: { address: peerAddr } });
          }}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 14 }}
        >
          <HeaderAvatar peerAddr={peerAddr} groupImage={groupImage} border={dark ? '#282a2d' : '#e4e4e5'} />
          <Text style={{ color: head, fontSize: 19, fontFamily: 'Calibre-Semibold', flex: 1 }} numberOfLines={1}>
            {isGroup ? (groupName === null ? '' : (groupName || 'Untitled group'))
              : peerAddr ? (getPeerName(peerAddr) ?? `${peerAddr.slice(0, 6)}…${peerAddr.slice(-4)}`) : ''}
          </Text>
        </Pressable>
      </View>
      {/** Fade strip below the top nav — mirrors the composer's top fade. The nav is
       *  `52 + insets.top` tall; start the fade 1px higher so its solid-bg top edge
       *  overlaps the nav bottom by 1px, closing the hairline seam between the two
       *  absolute bg layers (the "1px missing"). The fade then ramps down to
       *  transparent over the content beneath. */}
      <ComposerGradient bg={bg} direction="up" top={52 + insets.top - 1} height={24} />
      <KeyboardStickyView offset={{ opened: insets.bottom }}>
      <View>
      {/** Jump-to-bottom: anchored just above the composer (bottom:'100%') and inside
       *   the KeyboardStickyView, so it tracks the composer's height + the keyboard
       *   instead of a fixed offset that floated in the middle of a tall composer.
       *   Bump the FlatList key to remount → inverted offset 0 = newest at the bottom. */}
      {showJump ? (
        <Pressable
          onPress={() => { setListEpoch(e => e + 1); setShowJump(false); }}
          style={{
            position: 'absolute', alignSelf: 'center', bottom: '100%', marginBottom: 8, zIndex: 3,
            width: 36, height: 36, borderRadius: 999,
            backgroundColor: dark ? '#ffffff' : '#000000',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <HeroIcon name="arrowDown" size={18} color={dark ? '#000000' : '#ffffff'} />
        </Pressable>
      ) : null}
      <MessengerComposer
        /** Daemon URL/token are unused in xmtp mode but the composer always expects
         *  the prop pair — pass empty strings. */
        daemonUrl="" token="" dark={dark}
        xmtpLine={activeLine}
        replyingTo={replyingTo ?? undefined}
        onClearReply={() => setReplyingTo(null)}
        onReplyPreviewPress={() => {
          /** Tap on the composer's "Replying to …" slab → jump the inverted
           *  feed to the target bubble. `allBubbles` is newest-first, so the
           *  message index IS the inverted-list index.
           *
           *  Two reliability hacks needed for devices with Reduce Motion ON
           *  (reanimated #3670 throws "property is not writable" on the
           *  animated path of every scroll API):
           *  - `animated: false` — bypasses the reanimated mutator.
           *  - InteractionManager defer — lets the keyboard/composer settle
           *    first so the scroll dispatch is on a clean frame.
           *  Errors are swallowed (`onScrollToIndexFailed` below also
           *  silently no-ops); the bubble still gets the `replyTarget`
           *  highlight via state so the user sees it once they scroll. */
          if (!replyingTo) return;
          const idx = allBubbles.findIndex(b => b.id === replyingTo.id);
          if (idx < 0) return;
          InteractionManager.runAfterInteractions(() => {
            try { listRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0.5 }); }
            catch { /* fallback: row stays highlighted via replyTarget */ }
          });
        }}
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
      </View>
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
        onShareLink={() => {
          /** Shareable permalink to this message. Opens the conversation on the
           *  web today; the metro:// universal-link handling is the follow-up. */
          if (menuFor) void Share.share({ message: `https://metro.box/#/xmtp/${convId}?m=${menuFor.id}` });
          setMenuFor(null);
        }}
      />
    </RNAnimated.View>
  );
}

const ACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '🔥', '🎉'] as const;
function BubbleActionMenu({
  target, dark, onClose, onReact, onReply, onCopy, onShareLink,
}: {
  target: HistoryEntry | null; dark: boolean; onClose: () => void;
  onReact: (emoji: string) => void; onReply: () => void; onCopy: () => void;
  onShareLink: () => void;
}): React.ReactElement {
  const sheetBg = dark ? '#282a2d' : '#ffffff';
  const fg = dark ? '#9f9fa3' : '#57606a';
  const sub = dark ? '#7a7a7e' : '#8a929d';
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
            <Text style={{ color: fg, fontSize: 16 , fontFamily: 'Calibre-Medium'}}>Reply</Text>
          </Pressable>
          {target?.text ? (
            <Pressable onPress={onCopy} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
              <HeroIcon name="copy" size={20} color={fg} />
              <Text style={{ color: fg, fontSize: 16 , fontFamily: 'Calibre-Medium'}}>Copy text</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onShareLink} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
            <HeroIcon name="send" size={20} color={fg} />
            <Text style={{ color: fg, fontSize: 16 , fontFamily: 'Calibre-Medium'}}>Share link</Text>
          </Pressable>
          <Pressable onPress={onClose} style={{ paddingVertical: 10, alignItems: 'center' }}>
            <Text style={{ color: sub, fontSize: 14 , fontFamily: 'Calibre-Medium'}}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
