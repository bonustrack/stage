import type { RowNode, WidgetNode } from '@stage-labs/kit/chatkit';
import { REACTION_PRESS } from '../actions';
import { caption, row, text } from '../primitives';

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

function pill(
  params: ReactionsRowParams,
  reaction: ReactionPill,
): WidgetNode {
  const own = reaction.own === true;
  const content = row(
    [
      text(reaction.emoji, { size: 'xs' }),
      caption(String(reaction.count), { color: 'secondary' }),
    ],
    {
      align: 'center',
      gap: 4,
      padding: { x: 8, y: 2 },
      radius: 'full',
      background: params.pillBackground,
      border:
        own && params.ownBorderColor !== undefined
          ? { size: 1, color: params.ownBorderColor }
          : undefined,
    },
  );
  if (params.dispatchPress !== true) return content;
  return {
    type: 'ListViewItem',
    onClickAction: {
      type: REACTION_PRESS,
      payload: { messageId: params.messageId, emoji: reaction.emoji },
    },
    children: [content],
  };
}

export function reactionsRow(params: ReactionsRowParams): RowNode {
  return row(
    params.reactions.map((reaction) => pill(params, reaction)),
    { gap: 4, wrap: 'wrap', align: 'center' },
  );
}
