import type { ActionConfig, RowNode, WidgetNode } from '@stage-labs/kit/kit';
import { compactList } from '../node';
import { CONVERSATION_PRESS } from '../actions';

export interface ConversationHeaderAction {
  icon: string;
  action: ActionConfig;
}

export interface ConversationHeaderParams {
  conversationId?: string;
  avatarUri?: string;
  avatarSquare?: boolean;
  title: string;
  subtitle?: string;
  pressable?: boolean;
  trailingActions?: ConversationHeaderAction[];
}

export function conversationHeader(params: ConversationHeaderParams): RowNode {
  const pressable = params.pressable === true;
  const hasAvatar = params.avatarUri !== undefined && params.avatarUri !== '';
  const hasSubtitle = params.subtitle !== undefined && params.subtitle !== '';
  const innerChildren = compactList<WidgetNode>([
    hasAvatar
      ? { type: 'Image', src: params.avatarUri ?? '', size: 24, radius: params.avatarSquare === true ? 'md' : 'full' }
      : undefined,
    {
      type: 'Col',
      gap: 2,
      flex: 1,
      children: compactList<WidgetNode>([
        { type: 'Text', value: params.title, size: '4xl', weight: 'semibold', truncate: true },
        hasSubtitle
          ? {
              type: 'Caption',
              value: params.subtitle ?? '',
              color: 'secondary',
              truncate: true,
            }
          : undefined,
      ]),
    },
  ]);
  const titleBlock: WidgetNode = pressable
    ? {
        type: 'ListViewItem',
        onClickAction: {
          type: CONVERSATION_PRESS,
          payload: { conversationId: params.conversationId },
        },
        align: 'center',
        children: [
          { type: 'Row', align: 'center', gap: 10, flex: 1, children: innerChildren },
        ],
      }
    : { type: 'Row', align: 'center', gap: 10, flex: 1, children: innerChildren };
  const trailing = (params.trailingActions ?? []).map((action): WidgetNode => ({
    type: 'Button',
    iconStart: action.icon,
    variant: 'ghost',
    size: 'sm',
    onClickAction: action.action,
  }));
  return {
    type: 'Row',
    align: 'center',
    gap: 8,
    children: [titleBlock, ...trailing],
  };
}
