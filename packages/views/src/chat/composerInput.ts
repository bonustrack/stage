import type { Color, TextFieldNode } from '@stage-labs/kit/kit';
import { COMPOSER_CHANGE, COMPOSER_SELECTION } from '../actions';

export interface ComposerInputParams {
  value: string;
  color: Color;
  placeholderColor: Color;
  fontSize: number;
  selStart: number;
  selEnd: number;
  focusNonce: number;
  blurNonce: number;
  changeType?: string;
  selectionType?: string;
}

export function composerInput(params: ComposerInputParams): TextFieldNode {
  return {
    type: 'TextField',
    name: 'composer',
    value: params.value,
    variant: 'plain',
    multiline: true,
    autoGrow: true,
    fontSize: params.fontSize,
    fontWeight: 'medium',
    color: params.color,
    paddingX: 8,
    paddingTop: 4,
    paddingBottom: 8,
    lineHeight: 23,
    minHeight: 24,
    maxHeight: 210,
    autoCapitalize: 'sentences',
    placeholder: 'Message',
    placeholderColor: params.placeholderColor,
    focusNonce: params.focusNonce,
    blurNonce: params.blurNonce,
    selection: { start: params.selStart, end: params.selEnd },
    onChangeAction: { type: params.changeType ?? COMPOSER_CHANGE },
    onSelectionChangeAction: { type: params.selectionType ?? COMPOSER_SELECTION },
  };
}
