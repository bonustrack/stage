import type { ButtonNode, RowNode } from '@stage-labs/kit/kit';
import { compact } from '../node';
import { MEMBER_ADD_CHANGE, MEMBER_ADD_SUBMIT } from '../actions';
import {
  BG_COLOR as BG,
  BORDER_COLOR as BORDER,
  FG_COLOR as FG,
  HEAD_COLOR as HEAD,
  SURFACE_COLOR as SURFACE,
} from '../colors';

export interface MemberAddFormParams {
  draft: string;
  adding: boolean;
  valid: boolean;
  changeType?: string;
  submitType?: string;
}

export function memberAddForm(params: MemberAddFormParams): RowNode {
  const changeType = params.changeType ?? MEMBER_ADD_CHANGE;
  const submitType = params.submitType ?? MEMBER_ADD_SUBMIT;
  const button = compact<ButtonNode>({
    type: 'Button',
    label: params.adding ? 'Adding…' : 'Add',
    background: HEAD,
    foreground: BG,
    radius: 'full',
    size: 'sm',
    fontSize: 14,
    paddingX: 14,
    paddingY: 8,
    disabled: params.adding || !params.valid ? true : undefined,
    onClickAction: { type: submitType },
  });
  return {
    type: 'Row',
    align: 'center',
    gap: 8,
    padding: { x: 16, bottom: 12 },
    children: [
      {
        type: 'Box',
        flex: 1,
        children: [
          {
            type: 'TextField',
            name: 'draft',
            value: params.draft,
            placeholder: '0x… Ethereum address',
            variant: 'outline',
            background: SURFACE,
            borderColor: BORDER,
            color: FG,
            placeholderColor: FG,
            radius: 8,
            paddingX: 12,
            paddingY: 8,
            fontSize: 14,
            fontWeight: 'medium',
            autoCapitalize: 'none',
            autoCorrect: false,
            returnKeyType: 'done',
            onChangeAction: { type: changeType },
            onSubmitAction: { type: submitType },
          },
        ],
      },
      button,
    ],
  };
}
