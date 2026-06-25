import type { RowNode, WidgetNode } from '@stage-labs/kit/kit';
import { compact } from '../node';
import { REACTION_PRESS } from '../actions';

export interface ReactionPill {
  emoji: string;
  count: number;
  own?: boolean;
}

export interface ReactionsRowParams {
  messageId?: string;
  reactions: ReactionPill[];
  dispatchPress?: boolean;
  pillBackground?: string;
  ownBorderColor?: string;
}

export function reactionsRow(params: ReactionsRowParams): RowNode {
  const pressable = params.dispatchPress === true;
  const children = params.reactions.map((reaction): WidgetNode => {
    const own = reaction.own === true;
    const pill = compact<RowNode>({
      type: 'Row',
      align: 'center',
      gap: 4,
      padding: { x: 8, y: 2 },
      radius: 'full',
      background: params.pillBackground,
      border:
        own && params.ownBorderColor !== undefined
          ? { size: 1, color: params.ownBorderColor }
          : undefined,
      children: [
        { type: 'Text', value: reaction.emoji, size: 'xs' },
        { type: 'Caption', value: String(reaction.count), color: 'secondary' },
      ],
    });
    if (!pressable) return pill;
    return {
      type: 'ListViewItem',
      onClickAction: {
        type: REACTION_PRESS,
        payload: { messageId: params.messageId, emoji: reaction.emoji },
      },
      children: [pill],
    };
  });
  return { type: 'Row', gap: 4, wrap: 'wrap', align: 'center', children };
}
