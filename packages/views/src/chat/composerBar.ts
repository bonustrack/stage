import type { FormNode } from '@stage-labs/kit/kit';
import view from './composerBar.json';
import { buildView } from '../buildView';
import { COMPOSER_ATTACH, COMPOSER_SEND } from '../actions';

export interface ComposerBarParams {
  fieldName?: string;
  placeholder?: string;
  defaultValue?: string;
  sendIcon?: string;
  sendDisabled?: boolean;
  attachIcon?: string;
}

export function composerBar(params: ComposerBarParams): FormNode {
  return (buildView(view, {
    sendAction: COMPOSER_SEND,
    attachAction: COMPOSER_ATTACH,
    hasAttach:
      (params.attachIcon !== undefined && params.attachIcon !== '') ||
      undefined,
    attachIcon: params.attachIcon,
    fieldName: params.fieldName ?? 'message',
    placeholder: params.placeholder ?? 'Message',
    defaultValue: params.defaultValue,
    sendIcon: params.sendIcon ?? 'arrow-up',
    sendDisabled: params.sendDisabled,
  }) as FormNode);
}
