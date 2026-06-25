import type { RowNode, ThemeColor } from '@stage-labs/kit/kit';
import view from './memberAddForm.json';
import { buildView } from '../buildView';
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
  return buildView(view, {
    draft: params.draft,
    label: params.adding ? 'Adding…' : 'Add',
    disabled: params.adding || !params.valid ? true : undefined,
    surface: SURFACE,
    border: BORDER,
    fg: FG,
    head: HEAD,
    bg: BG,
    changeType: params.changeType ?? MEMBER_ADD_CHANGE,
    submitType: params.submitType ?? MEMBER_ADD_SUBMIT,
  }) as RowNode;
}
