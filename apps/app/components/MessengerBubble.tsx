/** Discord-style messenger row: every message left-aligned, avatar at the start,
 *  no colored bubble even for the local user's own messages. */

import { memo, useMemo, useRef, useState } from 'react';
import { Pressable } from 'react-native';
// eslint-disable-next-line no-restricted-imports -- type-only: rowRef measureInWindow() ref typing
import type { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';
import { getPeerAvatarCb } from '../lib/peerProfiles';
import { Avatar } from './Avatar';
import { Col } from './layout';
import { REACT_PRESETS } from './MessengerBubble.helpers';
import type { MessengerBubbleProps } from './MessengerBubble.props';
import { BubbleContent } from './MessengerBubble.content';
import { ReactionsRow, ReactionPicker } from './MessengerBubble.reactions';

export { REACT_PRESETS };

function MessengerBubbleBase({
  entry, dark, unread, pending, replyTarget, onReact, onReply, onLongPress, onOpenMenu, onAnswer,
  replyPreview, onReplyPreviewPress, reactions, pendingReactions, pendingRemovals, ownEmojis, transcript, myUri, senderEthAddress, onAvatarPress,
  votes, ownVotes, onVote, onPay, paying, onSign, signing,
}: MessengerBubbleProps): React.ReactElement {
  /** Discord-style layout doesn't visually distinguish own messages — myUri is
   *  accepted for forward compatibility (e.g. read-receipts) but not styled-on. */
  void (entry.from === myUri);
  /** Group system events (rename / member add / image change) get a muted feed
   *  color — set when envelopeOfXmtpMessage stamps `payload.system: true`. */
  const isSystem = (entry.payload as { system?: boolean } | undefined)?.system === true;
  const fg = isSystem ? (dark ? '#9f9fa3' : '#57606a') : (dark ? '#ffffff' : '#000000');
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const pillBg = dark ? '#282a2d' : '#e4e4e5';
  const avatarBg = dark ? '#282a2d' : '#e4e4e5';
  const [pickerOpen, setPickerOpen] = useState(false);
  /** Swipe-to-reply (right→left, Telegram-style) on react-native-gesture-handler so
   *  RNGH can arbitrate it against the back gesture + FlatList scroll by direction:
   *    - reply  = LEFTWARD  → `.activeOffsetX(-15)` (arms only on a clear left drag).
   *    - scroll = VERTICAL  → `.failOffsetY([-12,12])` (hands a vertical drag to the list).
   *    - back   = RIGHTWARD → opposite sign, never claimed here.
   *  translateX tracks the finger (clamped [-80,0]) on the UI thread; on release past
   *  ~60px it fires onReply, then springs back. */
  const swipeX = useSharedValue(0);
  const fireReply = (): void => { if (!pending) onReply?.(); };
  const replyPan = useMemo(() => Gesture.Pan()
    .activeOffsetX(-15)
    .failOffsetY([-12, 12])
    .onChange(e => {
      swipeX.value = Math.max(-80, Math.min(0, e.translationX));
    })
    .onEnd(e => {
      if (e.translationX <= -60) runOnJS(fireReply)();
      swipeX.value = withSpring(0, { damping: 18, stiffness: 220 });
    })
    .onFinalize(() => {
      swipeX.value = withSpring(0, { damping: 18, stiffness: 220 });
    }),
    // fireReply closes over onReply+pending; recreate when they change.
    [onReply, pending, swipeX]);
  const swipeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: swipeX.value }] }));
  /** Tap handling is split into discrete RNGH gestures so single-tap, double-tap and
   *  long-press arbitrate cleanly (and against the horizontal swipe-to-reply pan):
   *   - SINGLE tap → open the Telegram-style anchored menu. It `requireExternalGestureToFail`
   *     the double-tap, so a single tap waits ~RNGH's window for a 2nd tap to NOT arrive
   *     before firing — no menu flash on a double-tap.
   *   - DOUBLE tap → quick 👍, reusing the same optimistic onReact toggle path as the
   *     emoji picker/pills (adds if absent, removes your 👍 if already present).
   *   - LONG press → open the menu immediately.
   *  We measure the row's on-screen rect via measureInWindow and hand the parent the
   *  Y + height so it can float the overlay just above/below the bubble; lastAnchor is
   *  the synchronous fallback for the first open before a measure has returned. */
  const rowRef = useRef<View>(null);
  /** Last measured row rect — opens the menu synchronously while a fresh measure flies. */
  const lastAnchor = useRef<{ y: number; height: number }>({ y: 0, height: 0 });
  const openMenu = (): void => {
    if (pending || !onOpenMenu) { if (!onOpenMenu) onLongPress?.(); return; }
    onOpenMenu(lastAnchor.current);
    const node = rowRef.current;
    if (node) node.measureInWindow((_x, y, _w, h) => {
      lastAnchor.current = { y, height: h };
      onOpenMenu({ y, height: h });
    });
  };
  const onSingleTap = (): void => {
    if (pending) return;
    if (!onOpenMenu) { onReact?.('👍'); return; }
    openMenu();
  };
  const onDoubleTap = (): void => { if (!pending) onReact?.('👍'); };
  /** Single-tap: yields to the double-tap so a 2nd tap never flashes the menu. */
  const doubleTap = useMemo(() => Gesture.Tap().numberOfTaps(2).onEnd((_e, ok) => {
    if (ok) runOnJS(onDoubleTap)();
  }), [onDoubleTap]);
  const singleTap = useMemo(() => Gesture.Tap().numberOfTaps(1)
    .requireExternalGestureToFail(doubleTap)
    .onEnd((_e, ok) => { if (ok) runOnJS(onSingleTap)(); }),
    [doubleTap, onSingleTap]);
  const longPress = useMemo(() => Gesture.LongPress().minDuration(300)
    .onStart(() => runOnJS(openMenu)()),
    [openMenu]);
  /** Pan owns horizontal swipe-to-reply; the taps/long-press are mutually exclusive
   *  with each other, and race against the pan (pan only arms on a clear left drag). */
  const tapGestures = useMemo(
    () => Gesture.Race(replyPan, Gesture.Exclusive(longPress, doubleTap, singleTap)),
    [replyPan, longPress, doubleTap, singleTap]);
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
      {/** Discord-style row avatar — `sm` (24px). Tapping surfaces the sender's profile. */}
      {senderEthAddress ? (
        <Pressable onPress={() => onAvatarPress?.(senderEthAddress)} hitSlop={6} style={{ marginTop: 2 }}>
          <Avatar
            address={senderEthAddress}
            size="sm"
            cacheBuster={getPeerAvatarCb(senderEthAddress)}
            style={{ backgroundColor: avatarBg }}
          />
        </Pressable>
      ) : (
        <Avatar size="sm" style={{ backgroundColor: avatarBg, marginTop: 2 }} />
      )}
      {/** Right column: message content + reactions + reaction picker stacked. */}
      <Col flex={1} style={{ minWidth: 0, opacity: pending ? 0.5 : 1 }}>
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
          onPay={onPay}
          paying={paying}
          onSign={onSign}
          signing={signing}
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
          dark={dark}
          onReact={onReact}
        />
      )}
      {pickerOpen && !pending ? (
        <ReactionPicker
          dark={dark}
          sub={sub}
          onPick={e => { onReact?.(e); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
      </Col>
    </Animated.View>
    </GestureDetector>
  );
}

/** #6: memoised so a single stream tick only re-renders bubbles whose props
 *  changed, not the whole window. */
export const MessengerBubble = memo(MessengerBubbleBase);
