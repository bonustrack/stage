import type { RowNode } from '@stage-labs/kit/kit';
import view from './emojiReactionRow.json';
import { buildView } from '../buildView';
import { REACTION_EMOJI_PRESS } from '../actions';

export interface EmojiReactionRowParams {
  emojis: string[];
  pressType?: string;
}

export function emojiReactionRow(params: EmojiReactionRowParams): RowNode {
  return buildView(view, {
    emojis: params.emojis,
    pressType: params.pressType ?? REACTION_EMOJI_PRESS,
  }) as RowNode;
}
