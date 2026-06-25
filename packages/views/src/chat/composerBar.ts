import type { RowNode, WidgetNode } from '@stage-labs/kit/kit';
import { compact, compactList } from '../node';
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
  const hasAttach = params.attachIcon !== undefined && params.attachIcon !== '';
  const hasSend = params.showSend !== false;
  const children = compactList<WidgetNode>([
    hasAttach
      ? {
          type: 'Button',
          iconStart: params.attachIcon ?? '',
          variant: 'ghost',
          size: 'sm',
          onClickAction: { type: COMPOSER_ATTACH, payload: {} },
        }
      : undefined,
    {
      type: 'TextField',
      name: params.fieldName ?? 'message',
      value: params.value ?? '',
      placeholder: params.placeholder ?? 'Message',
      multiline: true,
      autoGrow: true,
      onChangeAction: { type: COMPOSER_CHANGE, payload: {} },
    },
    hasSend
      ? compact({
          type: 'Button' as const,
          iconStart: params.sendIcon ?? 'arrow-up',
          variant: 'solid' as const,
          size: 'sm' as const,
          disabled: params.sendDisabled,
          onClickAction: { type: COMPOSER_SEND, payload: {} },
        })
      : undefined,
  ]);
  return { type: 'Row', align: 'center', gap: 8, children };
}
