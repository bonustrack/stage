
import { memo, useState } from 'react';
import { Pressable } from '@stage-labs/kit/pressable';
import { Icon } from '@stage-labs/kit/icon';
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

function rowBackground(replyTarget: boolean | undefined, unread: boolean | undefined, dark: boolean): string {
  if (replyTarget) return dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.05)';
  if (unread) return dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  return 'transparent';
}

function BubbleColumn({ p, fg, sub, pillBg }: {
  p: MessengerBubbleProps; fg: string; sub: string; pillBg: string;
}): React.ReactElement {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { dark, unread, pending } = p;
  return (
    <Col minWidth={0} flex={1} style={{ opacity: pending ? 0.5 : 1 }}>
      <Col
        style={{
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

function MessengerBubbleBase(props: MessengerBubbleProps): React.ReactElement {
  const { entry, dark, unread, replyTarget, myUri, senderEthAddress, onAvatarPress } = props;
  void (entry.from === myUri);
  const isSystem = (entry.payload as { system?: boolean } | undefined)?.system === true;
  const pal = usePalette();
  const fg = isSystem ? pal.text : pal.link;
  const sub = pal.text;
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

export const MessengerBubble = memo(MessengerBubbleBase, bubblePropsEqual);
