import type { ButtonNode, RowNode, ThemeColor } from '@stage-labs/kit/kit';
import { compact } from '../node';
import { MEMBER_ADD_CHANGE, MEMBER_ADD_SUBMIT } from '../actions';

const SURFACE: ThemeColor = { dark: '#282a2d', light: '#e4e4e5' };
const BORDER: ThemeColor = { dark: '#282a2d', light: '#e4e4e5' };
const FG: ThemeColor = { dark: '#9f9fa3', light: '#57606a' };
const HEAD: ThemeColor = { dark: '#ffffff', light: '#000000' };
const BG: ThemeColor = { dark: '#0e0f10', light: '#ffffff' };

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
