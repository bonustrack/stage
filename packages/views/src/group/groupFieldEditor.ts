import type { Color, RowNode } from '@stage-labs/kit/kit';
import view from './groupFieldEditor.json';
import { buildView } from '../buildView';
import { GROUP_EDIT_CHANGE, GROUP_EDIT_SAVE } from '../actions';

export interface GroupFieldEditorParams {
  field: 'name' | 'description';
  value: string;
  placeholder: string;
  label: string;
  disabled: boolean;
  multiline?: boolean;
  minHeight?: number;
  primary: Color;
  bg: Color;
  fg: Color;
  sub: Color;
  border: Color;
  inputBg: Color;
  changeType?: string;
  saveType?: string;
}

export function groupFieldEditor(params: GroupFieldEditorParams): RowNode {
  return buildView(view, {
    field: params.field,
    value: params.value,
    placeholder: params.placeholder,
    label: params.label,
    disabled: params.disabled ? true : undefined,
    align: params.multiline === true ? 'start' : 'center',
    multiline: params.multiline === true ? true : undefined,
    minHeight: params.minHeight,
    primary: params.primary,
    bg: params.bg,
    fg: params.fg,
    sub: params.sub,
    border: params.border,
    inputBg: params.inputBg,
    changeType: params.changeType ?? GROUP_EDIT_CHANGE,
    saveType: params.saveType ?? GROUP_EDIT_SAVE,
  }) as RowNode;
}
