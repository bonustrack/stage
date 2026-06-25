import type { Color, TextFieldNode } from '@stage-labs/kit/kit';
import view from './composerInput.json';
import { buildView } from '../buildView';
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
  return buildView(view, {
    value: params.value,
    color: params.color,
    placeholderColor: params.placeholderColor,
    fontSize: params.fontSize,
    selStart: params.selStart,
    selEnd: params.selEnd,
    focusNonce: params.focusNonce,
    blurNonce: params.blurNonce,
    changeType: params.changeType ?? COMPOSER_CHANGE,
    selectionType: params.selectionType ?? COMPOSER_SELECTION,
  }) as TextFieldNode;
}
