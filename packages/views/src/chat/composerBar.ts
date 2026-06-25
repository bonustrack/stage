import type { RowNode } from '@stage-labs/kit/kit';
import view from './composerBar.json';
import { buildView } from '../buildView';
import { COMPOSER_ATTACH, COMPOSER_CHANGE, COMPOSER_SEND } from '../actions';

export interface ComposerBarParams {
  fieldName?: string;
  placeholder?: string;
  value?: string;
  sendIcon?: string;
  sendDisabled?: boolean;
  showSend?: boolean;
  attachIcon?: string;
}

export function composerBar(params: ComposerBarParams): RowNode {
  return buildView(view, {
    sendAction: COMPOSER_SEND,
    attachAction: COMPOSER_ATTACH,
    changeAction: COMPOSER_CHANGE,
    hasAttach:
      (params.attachIcon !== undefined && params.attachIcon !== '') || undefined,
    hasSend: params.showSend !== false || undefined,
    attachIcon: params.attachIcon,
    fieldName: params.fieldName ?? 'message',
    placeholder: params.placeholder ?? 'Message',
    value: params.value ?? '',
    sendIcon: params.sendIcon ?? 'arrow-up',
    sendDisabled: params.sendDisabled,
  }) as RowNode;
}
