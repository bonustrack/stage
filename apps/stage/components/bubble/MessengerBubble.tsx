import { memo } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { Avatar } from '../Avatar';
import { Col, PAGE_GUTTER } from '../layout';
import type { MessengerBubbleProps } from './props';
import { BubbleContent } from './content';
import { ReactionsRow } from './reactions';
import { contextMenuProps } from '../../lib/contextMenu';
import { usePalette } from '../../lib/theme';
import { useBubbleGestures } from './gestures';

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

function rowBackground(replyTarget: boolean | undefined, dark: boolean): string {
  if (replyTarget) return dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.05)';
  return 'transparent';
}

function BubbleColumn({ p, fg, sub, pillBg }: {
  p: MessengerBubbleProps; fg: string; sub: string; pillBg: string;
}): React.ReactElement {
  const { dark, pending } = p;
  return (
    <Col minWidth={0} flex={1} style={{ opacity: pending ? 0.5 : 1 }}>
      <Col>
        <BubbleContent
          entry={p.entry} dark={dark} pending={pending} fg={fg} sub={sub}
          replyPreview={p.replyPreview} onReplyPreviewPress={p.onReplyPreviewPress}
          onAnswer={p.onAnswer} votes={p.votes} ownVotes={p.ownVotes}
          onVote={p.onVote} openAnswers={p.openAnswers} onOpenAnswer={p.onOpenAnswer} myUri={p.myUri}
          onPay={p.onPay} paying={p.paying} onSign={p.onSign} signing={p.signing}
          consentAllowed={p.consentAllowed} selectable={p.selectable} highlight={p.highlight}
        />
      </Col>
      {pending ? null : (
        <ReactionsRow
          reactions={p.reactions} pendingReactions={p.pendingReactions} pendingRemovals={p.pendingRemovals}
          ownEmojis={p.ownEmojis} pillBg={pillBg} onReact={p.onReact}
        />
      )}
    </Col>
  );
}

function MessengerBubbleBase(props: MessengerBubbleProps): React.ReactElement {
  const { entry, dark, replyTarget, senderEthAddress, onAvatarPress } = props;
  const isSystem = (entry.payload as { system?: boolean } | undefined)?.system === true;
  const pal = usePalette();
  const fg = isSystem ? pal.text : pal.link;
  const sub = pal.text;
  const g = useBubbleGestures(props);
  return (
    <GestureDetector gesture={g.tapGestures}>
      <Animated.View
        ref={g.rowRef}
        {...contextMenuProps(point => { g.openMenu(point); })}
        style={[g.swipeStyle, {
          flexDirection: 'row', alignItems: 'flex-start',
          paddingHorizontal: PAGE_GUTTER, paddingVertical: 6, gap: 10,
          backgroundColor: rowBackground(replyTarget, dark),
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
  'entry', 'dark', 'pending', 'replyTarget', 'replyPreview',
  'reactions', 'pendingReactions', 'pendingRemovals', 'ownEmojis',
  'votes', 'ownVotes', 'openAnswers', 'signing', 'paying', 'selectable',
  'highlight', 'senderEthAddress', 'myUri', 'consentAllowed',
] as const satisfies readonly (keyof MessengerBubbleProps)[];

function bubblePropsEqual(prev: MessengerBubbleProps, next: MessengerBubbleProps): boolean {
  for (const k of DATA_KEYS) {
    if (prev[k] !== next[k]) return false;
  }
  return true;
}

export const MessengerBubble = memo(MessengerBubbleBase, bubblePropsEqual);
