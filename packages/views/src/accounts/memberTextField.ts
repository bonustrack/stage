import type { Color, RadiusValue, TextFieldNode } from '@stage-labs/kit/kit';
import view from './memberTextField.json';
import { buildView } from '../buildView';
import { MEMBER_FIELD_CHANGE } from '../actions';

export interface MemberTextFieldParams {
  value: string;
  placeholder: string;
  color: Color;
  placeholderColor: Color;
  inputBg: Color;
  border: Color;
  radius: RadiusValue | number;
  paddingX: number;
  paddingY: number;
  autoFocus?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
  changeType?: string;
  submitType?: string;
}

export function memberTextField(params: MemberTextFieldParams): TextFieldNode {
  return buildView(view, {
    value: params.value,
    placeholder: params.placeholder,
    color: params.color,
    placeholderColor: params.placeholderColor,
    inputBg: params.inputBg,
    border: params.border,
    radius: params.radius,
    paddingX: params.paddingX,
    paddingY: params.paddingY,
    autoFocus: params.autoFocus === true ? true : undefined,
    autoCapitalize: params.autoCapitalize,
    autoCorrect: params.autoCorrect === false ? false : params.autoCorrect,
    returnKeyType: params.returnKeyType,
    changeType: params.changeType ?? MEMBER_FIELD_CHANGE,
    submitType: params.submitType,
  }) as TextFieldNode;
}
