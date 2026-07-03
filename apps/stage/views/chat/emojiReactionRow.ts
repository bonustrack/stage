import type { RowNode, WidgetNode } from '@stage-labs/kit/kit';
import { REACTION_EMOJI_PRESS } from '../actions';

export interface EmojiReactionRowParams {
  emojis: string[];
  pressType?: string;
}

export function emojiReactionRow(params: EmojiReactionRowParams): RowNode {
  const pressType = params.pressType ?? REACTION_EMOJI_PRESS;
  const children = params.emojis.map((emoji): WidgetNode => ({
    type: 'Button',
    label: emoji,
    variant: 'ghost',
    paddingX: 0,
    paddingY: 0,
    fontSize: 30,
    onClickAction: { type: pressType, payload: { emoji } },
  }));
  return {
    type: 'Row',
    justify: 'around',
    align: 'center',
    padding: { bottom: 8 },
    children,
  };
}
