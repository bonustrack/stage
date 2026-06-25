import type { RowNode } from '@stage-labs/kit/kit';
import view from './reactionsRow.json';
import { buildView } from '../buildView';
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
  const reactions = params.reactions.map((reaction) => {
    const own = reaction.own === true;
    return {
      emoji: reaction.emoji,
      count: String(reaction.count),
      background: params.pillBackground,
      border:
        own && params.ownBorderColor !== undefined
          ? { size: 1, color: params.ownBorderColor }
          : undefined,
      bare: !pressable || undefined,
      pressable: pressable || undefined,
    };
  });
  return (buildView(view, {
    reactions,
    messageId: params.messageId,
    reactionPressType: REACTION_PRESS,
  }) as RowNode);
}
