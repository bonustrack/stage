import type { Color, RadiusValue, RowNode, TextFieldNode } from '@stage-labs/kit/kit';
import { compact } from '../node';
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
  const changeType = params.changeType ?? GROUP_EDIT_CHANGE;
  const saveType = params.saveType ?? GROUP_EDIT_SAVE;
  const field = compact<TextFieldNode>({
    type: 'TextField',
    name: params.field,
    value: params.value,
    placeholder: params.placeholder,
    variant: 'outline',
    multiline: params.multiline === true ? true : undefined,
    minHeight: params.minHeight,
    autoFocus: true,
    background: params.inputBg,
    borderColor: params.border,
    color: params.fg,
    placeholderColor: params.sub,
    radius: 10 as unknown as RadiusValue,
    paddingX: 10,
    paddingY: 8,
    onChangeAction: { type: changeType, payload: { field: params.field } },
  });
  const button = compact({
    type: 'Button' as const,
    label: params.label,
    variant: 'solid' as const,
    size: 'sm' as const,
    background: params.primary,
    foreground: params.bg,
    paddingX: 14,
    fontSize: 13,
    fontFamily: 'Calibre-Medium',
    disabled: params.disabled ? true : undefined,
    onClickAction: { type: saveType },
  });
  return {
    type: 'Row',
    align: params.multiline === true ? 'start' : 'center',
    gap: 8,
    padding: { top: 6 },
    children: [{ type: 'Box', flex: 1, children: [field] }, button],
  };
}
