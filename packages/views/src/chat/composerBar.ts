import type { FormNode, WidgetNode } from '@stage-labs/kit/chatkit';
import { COMPOSER_ATTACH, COMPOSER_SEND } from '../actions';
import { button } from '../primitives';

export interface ComposerBarParams {
  fieldName?: string;
  placeholder?: string;
  defaultValue?: string;
  sendIcon?: string;
  sendDisabled?: boolean;
  attachIcon?: string;
}

export function composerBar(params: ComposerBarParams): FormNode {
  const children: WidgetNode[] = [];
  if (params.attachIcon !== undefined && params.attachIcon !== '') {
    children.push(
      button({
        iconStart: params.attachIcon,
        variant: 'ghost',
        size: 'sm',
        onClickAction: { type: COMPOSER_ATTACH, payload: {} },
      }),
    );
  }
  children.push({
    type: 'Input',
    name: params.fieldName ?? 'message',
    placeholder: params.placeholder ?? 'Message',
    defaultValue: params.defaultValue,
    variant: 'soft',
    pill: true,
  });
  children.push(
    button({
      iconStart: params.sendIcon ?? 'arrow-up',
      variant: 'solid',
      size: 'sm',
      submit: true,
      disabled: params.sendDisabled,
    }),
  );
  return {
    type: 'Form',
    direction: 'row',
    align: 'center',
    gap: 8,
    onSubmitAction: { type: COMPOSER_SEND, payload: {} },
    children,
  };
}
