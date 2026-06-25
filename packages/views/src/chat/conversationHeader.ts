import type { ActionConfig, RowNode, WidgetNode } from '@stage-labs/kit/kit';
import { CONVERSATION_PRESS } from '../actions';
import { button, caption, col, image, row, text } from '../primitives';

export interface ConversationHeaderAction {
  icon: string;
  action: ActionConfig;
}

export interface ConversationHeaderParams {
  conversationId?: string;
  avatarUri?: string;
  title: string;
  subtitle?: string;
  pressable?: boolean;
  trailingActions?: ConversationHeaderAction[];
}

export function conversationHeader(params: ConversationHeaderParams): RowNode {
  const lines: WidgetNode[] = [text(params.title, { weight: 'semibold', truncate: true })];
  if (params.subtitle !== undefined && params.subtitle !== '') {
    lines.push(caption(params.subtitle, { color: 'secondary', truncate: true }));
  }

  const lead: WidgetNode[] = [];
  if (params.avatarUri !== undefined && params.avatarUri !== '') {
    lead.push(image(params.avatarUri, { size: 32, radius: 'full' }));
  }

  const titleBlock = col(lines, { gap: 2, flex: 1 });

  const inner = row([...lead, titleBlock], { align: 'center', gap: 10, flex: 1 });

  const main: WidgetNode =
    params.pressable === true
      ? {
          type: 'ListViewItem',
          onClickAction: {
            type: CONVERSATION_PRESS,
            payload: { conversationId: params.conversationId },
          },
          align: 'center',
          children: [inner],
        }
      : inner;

  const trailing = (params.trailingActions ?? []).map((entry) =>
    button({ iconStart: entry.icon, variant: 'ghost', size: 'sm', onClickAction: entry.action }),
  );

  return row([main, ...trailing], { align: 'center', gap: 8 });
}
