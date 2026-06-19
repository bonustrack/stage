/**
 * @file Discord-style messenger row bubble: every message left-aligned, avatar at the start, no colored bubble even for the local user's own messages.
 */

import { memo, useState } from 'react';
import { Pressable } from '@metro-labs/kit/pressable';
import { Icon } from '@metro-labs/kit/icon';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { Avatar } from './Avatar';
import { Col } from './layout';
import { REACT_PRESETS } from './MessengerBubble.helpers';
import type { MessengerBubbleProps } from './MessengerBubble.props';
import { BubbleContent } from './MessengerBubble.content';
import { ReactionsRow, ReactionPicker } from './MessengerBubble.reactions';
import { usePalette } from '../lib/theme';
import { useBubbleGestures } from './MessengerBubble.gestures';

export { REACT_PRESETS };

/** Renders the row avatar (tappable when the sender address is known). */
function BubbleAvatar({ address, bg, onPress }: {
  address?: string | null; bg: string; onPress?: (address: string) => void;
}): React.ReactElement {
  if (!address) return <Avatar size="sm" style={{ backgroundColor: bg, marginTop: 2 }}/>;
  return (
    <Pressable onPress={() => onPress?.(address)} hitSlop={6} style={{ marginTop: 2 }}>
      <Avatar address={address} size="sm" style={{ backgroundColor: bg }}/>
    </Pressable>
  );
}

/** Background color of the bubble row (reply-target highlight, unread tint, else transparent). */
function rowBackground(replyTarget: boolean | undefined, unread: boolean | undefined, dark: boolean): string {
  if (replyTarget) return dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.05)';
  if (unread) return dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  return 'transparent';
}

/** Renders the right column: content, reactions row and reaction picker. */
function BubbleColumn({ p, fg, sub, pillBg }: {
  p: MessengerBubbleProps; fg: string; sub: string; pillBg: string;
}): React.ReactElement {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { dark, unread, pending } = p;
  return (
    <Col minWidth={0} flex={1} style={{ opacity: pending ? 0.5 : 1 }}>
      <Col
        style={{
          // Reply-target highlight is a full-row background on the outer View now; keep only the unread outline here.
          borderWidth: unread ? 1.5 : 0,
          borderColor: unread ? (dark ? '#ffffff' : '#000000') : 'transparent',
        }}
      >
        <BubbleContent
          entry={p.entry} dark={dark} pending={pending} fg={fg} sub={sub}
          replyPreview={p.replyPreview} onReplyPreviewPress={p.onReplyPreviewPress}
          transcript={p.transcript} onAnswer={p.onAnswer} votes={p.votes} ownVotes={p.ownVotes}
          onVote={p.onVote} openAnswers={p.openAnswers} onOpenAnswer={p.onOpenAnswer} myUri={p.myUri}
          onPay={p.onPay} paying={p.paying} onSign={p.onSign} signing={p.signing}
          consentAllowed={p.consentAllowed} selectable={p.selectable} highlight={p.highlight}
        />
      </Col>
      {pending ? null : (
        <ReactionsRow
          reactions={p.reactions} pendingReactions={p.pendingReactions} pendingRemovals={p.pendingRemovals}
          ownEmojis={p.ownEmojis} sub={sub} pillBg={pillBg} onReact={p.onReact}
        />
      )}
      {pickerOpen && !pending ? (
        <ReactionPicker
          dark={dark} sub={sub}
          onPick={e => { p.onReact?.(e); setPickerOpen(false); }}
          onClose={() => { setPickerOpen(false); }}
        />
      ) : null}
    </Col>
  );
}

/** The Messenger Bubble Base component: Discord-style row with avatar, gestures, and content column. */
function MessengerBubbleBase(props: MessengerBubbleProps): React.ReactElement {
  const { entry, dark, unread, replyTarget, myUri, senderEthAddress, onAvatarPress } = props;
  // Discord-style layout doesn't visually distinguish own messages — myUri is
  // accepted for forward compatibility (e.g. read-receipts) but not styled-on.
  void (entry.from === myUri);
  // Group system events (rename / member add / image change) get a muted feed color.
  const isSystem = (entry.payload as { system?: boolean } | undefined)?.system === true;
  const pal = usePalette();
  // system → muted body text; else → strong primary.
  const fg = isSystem ? pal.text : pal.link;
  const sub = pal.text; // muted meta (date, 'Sending'); no `muted` token yet.
  const g = useBubbleGestures(props);
  return (
    <GestureDetector gesture={g.tapGestures}>
      <Animated.View
        ref={g.rowRef}
        style={[g.swipeStyle, {
          flexDirection: 'row', alignItems: 'flex-start',
          paddingHorizontal: 12, paddingVertical: 6, gap: 10,
          backgroundColor: rowBackground(replyTarget, unread, dark),
        }]}
      >
        <Animated.View
          pointerEvents="none"
          style={[g.replyHintStyle, { position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' }]}
        >
          <Icon name="reply" size={20} color={sub}/>
        </Animated.View>
        <BubbleAvatar address={senderEthAddress} bg={pal.border} onPress={onAvatarPress} />
        <BubbleColumn p={props} fg={fg} sub={sub} pillBg={pal.border} />
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * Custom memo comparator: the feed's renderItem (useFeedRenderItem) builds
 *  ~10 brand-new arrow-function props for EVERY bubble on every parent render,
 *  so the default shallow memo (which compares those callbacks by identity) is
 *  defeated — one reaction/vote re-rendered the entire visible window. We ignore
 *  callback identity entirely and re-render a bubble only when a render-affecting
 *  DATA prop for its own id actually changes. The per-id Maps/Sets passed in are
 *  the result of `map.get(item.id)`, which returns a stable reference while the
 *  underlying collection is unchanged, so reference equality is correct here.
 */
const DATA_KEYS = [
  'entry', 'dark', 'unread', 'pending', 'replyTarget', 'replyPreview',
  'reactions', 'pendingReactions', 'pendingRemovals', 'ownEmojis',
  'votes', 'ownVotes', 'openAnswers', 'signing', 'paying', 'selectable',
  'highlight', 'senderEthAddress', 'myUri', 'transcript', 'consentAllowed',
] as const satisfies readonly (keyof MessengerBubbleProps)[];

/** Bubble Props Equal. */
function bubblePropsEqual(prev: MessengerBubbleProps, next: MessengerBubbleProps): boolean {
  for (const k of DATA_KEYS) {
    if (prev[k] !== next[k]) return false;
  }
  return true;
}

/** #6: memoised so a single stream tick only re-renders bubbles whose data props changed, not the whole window (callback identity is intentionally ignored). */
export const MessengerBubble = memo(MessengerBubbleBase, bubblePropsEqual);
