import type { ActionConfig, RowNode } from '@stage-labs/kit/kit';
import view from './conversationHeader.json';
import { buildView } from '../buildView';
import { CONVERSATION_PRESS } from '../actions';

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
  const pressable = params.pressable === true;
  return (buildView(view, {
    conversationPressType: CONVERSATION_PRESS,
    conversationId: params.conversationId,
    avatarUri: params.avatarUri,
    title: params.title,
    subtitle: params.subtitle,
    pressable: pressable || undefined,
    static: !pressable || undefined,
    hasAvatar:
      (params.avatarUri !== undefined && params.avatarUri !== '') || undefined,
    hasSubtitle:
      (params.subtitle !== undefined && params.subtitle !== '') || undefined,
    trailing: params.trailingActions ?? [],
  }) as RowNode);
}
