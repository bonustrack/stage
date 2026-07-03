import type { RowNode, WidgetNode } from '@stage-labs/kit/kit';
import { compactList } from '../node';
import { CONVERSATION_PRESS } from '../actions';

export interface ConversationHeaderParams {
  conversationId?: string;
  avatarUri?: string;
  avatarSquare?: boolean;
  title: string;
}

export function conversationHeader(params: ConversationHeaderParams): RowNode {
  const hasAvatar = params.avatarUri !== undefined && params.avatarUri !== '';
  const innerChildren = compactList<WidgetNode>([
    hasAvatar
      ? { type: 'Image', src: params.avatarUri ?? '', size: 24, radius: params.avatarSquare === true ? 'md' : 'full' }
      : undefined,
    {
      type: 'Col',
      gap: 2,
      flex: 1,
      children: [
        { type: 'Text', value: params.title, size: '4xl', weight: 'semibold', truncate: true },
      ],
    },
  ]);
  const titleBlock: WidgetNode = {
    type: 'ListViewItem',
    onClickAction: {
      type: CONVERSATION_PRESS,
      payload: { conversationId: params.conversationId },
    },
    align: 'center',
    children: [
      { type: 'Row', align: 'center', gap: 10, flex: 1, children: innerChildren },
    ],
  };
  return {
    type: 'Row',
    align: 'center',
    gap: 8,
    children: [titleBlock],
  };
}
