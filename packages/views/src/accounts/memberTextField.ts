import type { Color, RadiusValue, TextFieldNode } from '@stage-labs/kit/kit';
import { compact } from '../node';
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
  return compact<TextFieldNode>({
    type: 'TextField',
    name: 'field',
    value: params.value,
    placeholder: params.placeholder,
    variant: 'outline',
    autoFocus: params.autoFocus === true ? true : undefined,
    background: params.inputBg,
    borderColor: params.border,
    color: params.color,
    placeholderColor: params.placeholderColor,
    radius: params.radius as RadiusValue,
    paddingX: params.paddingX,
    paddingY: params.paddingY,
    fontSize: 15,
    fontWeight: 'medium',
    minHeight: 0,
    autoCapitalize: params.autoCapitalize,
    autoCorrect: params.autoCorrect === false ? false : params.autoCorrect,
    returnKeyType: params.returnKeyType,
    onChangeAction: { type: params.changeType ?? MEMBER_FIELD_CHANGE },
    onSubmitAction:
      params.submitType !== undefined ? { type: params.submitType } : undefined,
  });
}
