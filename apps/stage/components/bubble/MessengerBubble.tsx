import { memo, useMemo } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { Avatar } from '../Avatar';
import { bubbleHandlers, type BubbleHandlers, type BubbleModel, type FeedActions } from './model';
import { BubbleContent } from './content';
import { ReactionsRow } from './reactions';
import { contextMenuProps } from '@stage-labs/kit/react-native/context-menu';
import { usePalette } from '../../lib/theme';
import { messageKindOf, type MessageKind } from '@stage-labs/client/xmtp/entryPayload';
import { useBubbleGestures } from './gestures';
import { MessageSelection } from './MessageSelection';
import type { MessageInteraction } from './messageInteraction.model';
import { messageInteraction } from './interaction';
import { IconArrowUndoUp } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowUndoUp';
import { Column, PAGE_GUTTER } from '../layout';

function BubbleAvatar({
  address,
  bg,
  onPress,
}: {
  address?: string | null;
  bg: string;
  onPress?: (address: string) => void;
}): React.ReactElement {
  if (!address) return <Avatar size="sm" style={{ backgroundColor: bg, marginTop: 2 }} />;
  return (
    <Pressable onPress={() => onPress?.(address)} hitSlop={6} style={{ marginTop: 2 }}>
      <Avatar address={address} size="sm" style={{ backgroundColor: bg }} />
    </Pressable>
  );
}

function rowBackground(replyTarget: boolean | undefined, dark: boolean): string {
  if (replyTarget) return dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.05)';
  return 'transparent';
}

function BubbleColumn({
  model,
  h,
  fg,
  sub,
  pillBg,
  interaction,
}: {
  model: BubbleModel;
  h: BubbleHandlers;
  fg: string;
  sub: string;
  pillBg: string;
  interaction: MessageInteraction;
}): React.ReactElement {
  const { pending } = model;
  return (
    <Column minWidth={0} weight={1} style={{ opacity: pending ? 0.5 : 1 }}>
      <Column>
        {(interaction === 'selectableText' || interaction === 'readonlyInput') && h.onEndSelection ? (
          <MessageSelection text={model.entry.text ?? ''} fg={fg} input={interaction === 'readonlyInput'} onClose={h.onEndSelection} />
        ) : (
          <BubbleContent model={model} h={h} fg={fg} sub={sub} />
        )}
      </Column>
      {pending ? null : (
        <ReactionsRow
          reactions={model.reactions}
          pendingReactions={model.pendingReactions}
          pendingRemovals={model.pendingRemovals}
          ownEmojis={model.ownEmojis}
          pillBg={pillBg}
          onReact={h.onReact}
        />
      )}
    </Column>
  );
}

const MUTED_KINDS: ReadonlySet<MessageKind> = new Set(['system', 'deleted', 'frameAction']);

interface MessengerBubbleProps {
  model: BubbleModel;
  actions?: FeedActions;
}

function MessengerBubbleBase({ model, actions }: MessengerBubbleProps): React.ReactElement {
  const { entry, dark, replyTarget, senderEthAddress } = model;
  const h = useMemo(() => bubbleHandlers(model, actions), [model, actions]);
  const muted = MUTED_KINDS.has(messageKindOf(entry));
  const pal = usePalette();
  const fg = muted ? pal.text : pal.link;
  const sub = pal.text;
  const g = useBubbleGestures({ pending: model.pending, onReply: h.onReply, onReact: h.onReact, onOpenMenu: h.onOpenMenu });
  const interaction = messageInteraction(model.selectable && !!h.onEndSelection);
  const row = (
    <Animated.View
      ref={g.rowRef}
      {...contextMenuProps((point) => {
        g.openMenu(point);
      })}
      style={[
        g.swipeStyle,
        {
          flexDirection: 'row',
          alignItems: 'flex-start',
          paddingHorizontal: PAGE_GUTTER,
          paddingVertical: 6,
          gap: 10,
          backgroundColor: rowBackground(replyTarget, dark),
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[g.replyHintStyle, { position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' }]}
      >
        <Glyph icon={IconArrowUndoUp} size={20} color={sub} />
      </Animated.View>
      <BubbleAvatar address={senderEthAddress} bg={pal.border} onPress={h.onAvatarPress} />
      <BubbleColumn model={model} h={h} fg={fg} sub={sub} pillBg={pal.border} interaction={interaction} />
    </Animated.View>
  );
  return interaction === 'gestures' ? <GestureDetector gesture={g.tapGestures}>{row}</GestureDetector> : row;
}

function bubblePropsEqual(prev: MessengerBubbleProps, next: MessengerBubbleProps): boolean {
  return prev.model === next.model && prev.actions === next.actions;
}

export const MessengerBubble = memo(MessengerBubbleBase, bubblePropsEqual);
