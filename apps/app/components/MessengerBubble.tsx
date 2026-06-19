/** Discord-style messenger row: every message left-aligned, avatar at the start,
 *  no colored bubble even for the local user's own messages. */

import { memo, useMemo, useRef, useState } from 'react';
import { Vibration } from 'react-native';
import { Pressable } from '@metro-labs/kit/pressable';
import { Icon } from '@metro-labs/kit/icon';
// type-only: rowRef measureInWindow() ref typing. Imported via the sanctioned
// layout/native escape hatch (ViewType) instead of an eslint-disable.
import type { ViewType as View } from './layout/native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useGestureHandlerRef } from '@react-navigation/stack';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, runOnJS, interpolate, Extrapolation } from 'react-native-reanimated';
import { Avatar } from './Avatar';
import { Col } from './layout';
import { REACT_PRESETS } from './MessengerBubble.helpers';
import type { MessengerBubbleProps } from './MessengerBubble.props';
import { BubbleContent } from './MessengerBubble.content';
import { ReactionsRow, ReactionPicker } from './MessengerBubble.reactions';
import { usePalette } from '../lib/theme';

export { REACT_PRESETS };

function MessengerBubbleBase({
  entry, dark, unread, pending, replyTarget, onReact, onReply, onLongPress, onOpenMenu, onAnswer,
  replyPreview, onReplyPreviewPress, reactions, pendingReactions, pendingRemovals, ownEmojis, transcript, myUri, senderEthAddress, onAvatarPress,
  votes, ownVotes, onVote, openAnswers, onOpenAnswer, onPay, paying, onSign, signing, consentAllowed, selectable, highlight,
}: MessengerBubbleProps): React.ReactElement {
  /** Discord-style layout doesn't visually distinguish own messages — myUri is
   *  accepted for forward compatibility (e.g. read-receipts) but not styled-on. */
  void (entry.from === myUri);
  /** Group system events (rename / member add / image change) get a muted feed
   *  color — set when envelopeOfXmtpMessage stamps `payload.system: true`. */
  const isSystem = (entry.payload as { system?: boolean } | undefined)?.system === true;
  const pal = usePalette();
  // system → muted body text (#9f9fa3/#57606a); else → strong primary (#ffffff/#000000)
  const fg = isSystem ? pal.text : pal.link;
  // `sub` = muted meta (date, 'Sending'); no `muted` token yet → map to `text`. TODO: muted token.
  const sub = pal.text;
  const pillBg = pal.border; // #282a2d / #e4e4e5
  const avatarBg = pal.border;
  const [pickerOpen, setPickerOpen] = useState(false);
  /** Swipe-to-reply (right→left, Telegram-style) on react-native-gesture-handler so
   *  RNGH can arbitrate it against the back gesture + FlatList scroll by direction:
   *    - reply  = LEFTWARD  → `.activeOffsetX(-15)` (arms only on a clear left drag).
   *    - scroll = VERTICAL  → `.failOffsetY([-12,12])` (hands a vertical drag to the list).
   *    - back   = RIGHTWARD → `.failOffsetX(15)` BAILS this gesture on a rightward
   *      drag so the touch falls through to the navigator's full-screen swipe-back
   *      (app/_layout `gestureResponseDistance: 9999`); reply never claims rightward.
   *  translateX tracks the finger on the UI thread (rubber-band past the trigger);
   *  a light haptic fires once when crossing the -64px trigger, and on release past
   *  it onReply sets that message as the reply target + focuses the composer, then
   *  the bubble springs back. */
  /** Light haptic tick via RN's built-in Vibration (no native dep, hot-reloadable;
   *  expo-haptics is not installed). Fired from the JS gesture callbacks. */
  const lightHaptic = (): void => { Vibration.vibrate(10); };
  const swipeX = useSharedValue(0);
  /** Crossed-threshold latch (UI thread) so the haptic fires exactly ONCE per
   *  drag the moment the finger passes the trigger point, Telegram-style, not on
   *  release. Reset on each gesture begin. */
  const crossed = useSharedValue(false);
  const fireReply = (): void => { if (!pending) onReply?.(); };
  /** The navigator's full-screen back-pan (@react-navigation/stack, armed via
   *  `gestureResponseDistance: 9999` in app/_layout) is an ANCESTOR
   *  PanGestureHandler. By RNGH's default arbitration it competes with this
   *  child reply pan and, being an ancestor that samples horizontal movement
   *  first, cancels the bubble's leftward drag before `activeOffsetX(-15)` can
   *  arm it - that's why swipe-to-reply stopped firing once back went
   *  full-screen. react-navigation/stack exposes its PanGestureHandler ref via
   *  `useGestureHandlerRef()` precisely so children can COMPOSE with it. We mark
   *  the reply pan `.simultaneousWithExternalGesture(navGestureRef)` so RNGH lets
   *  both run together instead of one cancelling the other. They then separate
   *  cleanly by sign: rightward arms only the navigator back-pan
   *  (`failOffsetX(15)` bails reply), leftward arms only this reply pan, vertical
   *  goes to the list (`failOffsetY`). */
  /** `useGestureHandlerRef()` is typed as the broad `React.Ref` union (callback |
   *  object | null), but the Stack provider always supplies a RefObject; narrow it
   *  to the object form RNGH's `simultaneousWithExternalGesture` accepts. */
  const navGestureRef = useGestureHandlerRef() as React.RefObject<React.ComponentType | undefined>;
  const replyPan = useMemo(() => Gesture.Pan()
    .activeOffsetX(-15)
    .failOffsetX(15)
    .failOffsetY([-12, 12])
    .simultaneousWithExternalGesture(navGestureRef)
    .onBegin(() => { crossed.value = false; })
    .onChange(e => {
      // Bubble follows the finger leftward; clamp at the trigger then add
      // rubber-band resistance (1/3 travel) past it so it feels "caught".
      // THRESHOLD = -64. Inlined math (no cross-file worklet calls, which crash
      // reanimated in this codebase).
      const raw = Math.min(0, e.translationX);
      const t = -64;
      swipeX.value = raw > t ? raw : t + (raw - t) / 3;
      const past = raw <= t;
      if (past && !crossed.value) { crossed.value = true; runOnJS(lightHaptic)(); }
      else if (!past && crossed.value) { crossed.value = false; }
    })
    .onEnd(e => {
      if (e.translationX <= -64) runOnJS(fireReply)();
      swipeX.value = withSpring(0, { damping: 18, stiffness: 220 });
    })
    .onFinalize(() => {
      swipeX.value = withSpring(0, { damping: 18, stiffness: 220 });
    }),
    // fireReply/lightHaptic close over onReply+pending; recreate when they change.
    [onReply, pending, swipeX, crossed, navGestureRef]);
  const swipeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: swipeX.value }] }));
  /** Reply arrow that fades + scales in behind the bubble as it's pulled left,
   *  reaching full opacity at the trigger point (Telegram-style affordance). */
  const replyHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(swipeX.value, [-64, -20, 0], [1, 0.35, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(swipeX.value, [-64, 0], [1, 0.6], Extrapolation.CLAMP) }],
  }));
  /** Tap handling is split into discrete RNGH gestures so double-tap and long-press
   *  arbitrate cleanly (and against the horizontal swipe-to-reply pan):
   *   - DOUBLE tap → quick 👍, reusing the same optimistic onReact toggle path as the
   *     emoji picker/pills (adds if absent, removes your 👍 if already present).
   *   - LONG press → open the menu immediately. A plain single tap does nothing —
   *     the action menu opens ONLY via press-and-hold.
   *  We measure the row's on-screen rect via measureInWindow and hand the parent the
   *  Y + height so it can float the overlay just above/below the bubble; lastAnchor is
   *  the synchronous fallback for the first open before a measure has returned. */
  const rowRef = useRef<View>(null);
  /** Last measured row rect — opens the menu synchronously while a fresh measure flies. */
  const lastAnchor = useRef<{ y: number; height: number }>({ y: 0, height: 0 });
  const openMenu = (): void => {
    if (pending || !onOpenMenu) { if (!onOpenMenu) onLongPress?.(); return; }
    lightHaptic();
    onOpenMenu(lastAnchor.current);
    const node = rowRef.current;
    if (node) node.measureInWindow((_x, y, _w, h) => {
      lastAnchor.current = { y, height: h };
      onOpenMenu({ y, height: h });
    });
  };
  const onDoubleTap = (): void => { if (!pending) { lightHaptic(); onReact?.('👍'); } };
  const doubleTap = useMemo(() => Gesture.Tap().numberOfTaps(2).onEnd((_e, ok) => {
    if (ok) runOnJS(onDoubleTap)();
  }), [onDoubleTap]);
  const longPress = useMemo(() => Gesture.LongPress().minDuration(300)
    .onStart(() => { runOnJS(openMenu)(); }),
    [openMenu]);
  /** Pan owns horizontal swipe-to-reply; the long-press and double-tap are mutually
   *  exclusive with each other, and race against the pan (pan only arms on a clear
   *  left drag). A plain single tap is intentionally unhandled. */
  const tapGestures = useMemo(
    () => Gesture.Race(replyPan, Gesture.Exclusive(longPress, doubleTap)),
    [replyPan, longPress, doubleTap]);
  return (
    <GestureDetector gesture={tapGestures}>
    <Animated.View
      ref={rowRef}
      style={[swipeStyle, {
        flexDirection: 'row', alignItems: 'flex-start',
        paddingHorizontal: 12, paddingVertical: 6, gap: 10,
        /** Permalink/reply jump target: full-row lighter background spanning the
         *  whole width incl. the avatar gutter. */
        backgroundColor: replyTarget
          ? (dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.05)')
          : (unread ? (dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)') : 'transparent'),
      }]}
>
      {/** Telegram-style reply affordance: a reply arrow pinned to the right gutter
        *  that fades + scales in as the bubble is pulled left toward the trigger. */}
      <Animated.View
        pointerEvents="none"
        style={[replyHintStyle, { position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' }]}
>
        <Icon name="reply" size={20} color={sub}/>
      </Animated.View>
      {/** Discord-style row avatar: `sm` (24px). Tapping surfaces the sender's profile. */}
      {senderEthAddress ? (
        <Pressable onPress={() => onAvatarPress?.(senderEthAddress)} hitSlop={6} style={{ marginTop: 2 }}>
          <Avatar
            address={senderEthAddress}
            size="sm"
            style={{ backgroundColor: avatarBg }}
/>
        </Pressable>
      ) : (
        <Avatar size="sm" style={{ backgroundColor: avatarBg, marginTop: 2 }}/>
      )}
      {/** Right column: message content + reactions + reaction picker stacked. */}
      <Col minWidth={0} flex={1} style={{ opacity: pending ? 0.5 : 1 }}>
      {/** Tap/double-tap/long-press all live on the outer GestureDetector now; this is
        *  just the content wrapper carrying the unread outline. */}
      <Col
        style={{
          /** Reply-target highlight is a full-row background on the outer View now;
           *  keep only the unread outline here. */
          borderWidth: unread ? 1.5 : 0,
          borderColor: unread ? (dark ? '#ffffff' : '#000000') : 'transparent',
        }}
>
        <BubbleContent
          entry={entry}
          dark={dark}
          pending={pending}
          fg={fg}
          sub={sub}
          replyPreview={replyPreview}
          onReplyPreviewPress={onReplyPreviewPress}
          transcript={transcript}
          onAnswer={onAnswer}
          votes={votes}
          ownVotes={ownVotes}
          onVote={onVote}
          openAnswers={openAnswers}
          onOpenAnswer={onOpenAnswer}
          myUri={myUri}
          onPay={onPay}
          paying={paying}
          onSign={onSign}
          signing={signing}
          consentAllowed={consentAllowed}
          selectable={selectable}
          highlight={highlight}
/>
      </Col>
      {pending ? null : (
        <ReactionsRow
          reactions={reactions}
          pendingReactions={pendingReactions}
          pendingRemovals={pendingRemovals}
          ownEmojis={ownEmojis}
          sub={sub}
          pillBg={pillBg}
          onReact={onReact}
/>
      )}
      {pickerOpen && !pending ? (
        <ReactionPicker
          dark={dark}
          sub={sub}
          onPick={e => { onReact?.(e); setPickerOpen(false); }}
          onClose={() => { setPickerOpen(false); }}
/>
      ) : null}
      </Col>
    </Animated.View>
    </GestureDetector>
  );
}

/** Custom memo comparator: the feed's renderItem (useFeedRenderItem) builds
 *  ~10 brand-new arrow-function props for EVERY bubble on every parent render,
 *  so the default shallow memo (which compares those callbacks by identity) is
 *  defeated — one reaction/vote re-rendered the entire visible window. We ignore
 *  callback identity entirely and re-render a bubble only when a render-affecting
 *  DATA prop for its own id actually changes. The per-id Maps/Sets passed in are
 *  the result of `map.get(item.id)`, which returns a stable reference while the
 *  underlying collection is unchanged, so reference equality is correct here. */
const DATA_KEYS = [
  'entry', 'dark', 'unread', 'pending', 'replyTarget', 'replyPreview',
  'reactions', 'pendingReactions', 'pendingRemovals', 'ownEmojis',
  'votes', 'ownVotes', 'openAnswers', 'signing', 'paying', 'selectable',
  'highlight', 'senderEthAddress', 'myUri', 'transcript', 'consentAllowed',
] as const satisfies readonly (keyof MessengerBubbleProps)[];

function bubblePropsEqual(prev: MessengerBubbleProps, next: MessengerBubbleProps): boolean {
  for (const k of DATA_KEYS) {
    if (prev[k] !== next[k]) return false;
  }
  return true;
}

/** #6: memoised so a single stream tick only re-renders bubbles whose data props
 *  changed, not the whole window (callback identity is intentionally ignored). */
export const MessengerBubble = memo(MessengerBubbleBase, bubblePropsEqual);
